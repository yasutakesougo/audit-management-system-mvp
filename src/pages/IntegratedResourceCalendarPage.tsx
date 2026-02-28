/**
 * 統合リソースカレンダーページ
 * 管理者向け Plan vs Actual 統合ビュー
 */

import type {
    DateSelectArg,
    DateSpanApi,
    EventApi,
    EventClickArg,
    EventContentArg,
    EventInput,
    EventMountArg,
} from '@fullcalendar/core';
import interactionPlugin from '@fullcalendar/interaction';
import FullCalendar from '@fullcalendar/react';
import type { ResourceLabelContentArg } from '@fullcalendar/resource';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';
import {
    Alert,
    Box,
    Button,
    Chip,
    Container,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    LinearProgress,
    Paper,
    Snackbar,
    Stack,
    Switch,
    Typography
} from '@mui/material';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useFeatureFlags } from '@/config/featureFlags';
import { isE2E } from '@/env';
import { HYDRATION_FEATURES, estimatePayloadSize, startFeatureSpan } from '@/hydration/features';
import { getAppConfig } from '@/lib/env';
import { useLocation } from 'react-router-dom';
import {
    PvsAStatus,
    ResourceInfo,
    UnifiedResourceEvent
} from '../features/resources/types';
import { classifySchedulesError, type SchedulesErrorInfo } from '../features/schedules/errors';
import { createIrcSpClient, useSP } from '../lib/spClient';

/**
 * リソース警告情報
 */
type ResourceWarning = {
  totalHours: number;
  isOver: boolean;
};

type EventAllowInfo = {
  start: Date | null;
  end: Date | null;
  resource?: { id?: string };
};
type SelectAllowInfo = DateSpanApi & { resource?: { id?: string } };
type CalendarExtendedProps = UnifiedResourceEvent['extendedProps'] & { resourceId?: string };

export type SimpleResourceEvent = {
  id: string;
  resourceId: string;
  start: Date;
  end: Date;
  display?: string;
  hasActual: boolean;
};

export type MoveWindow = {
  resourceId: string;
  start: Date;
  end: Date;
};

export type MoveDecisionReason = 'locked' | 'overlap';

export type MoveDecision = { allowed: true } | { allowed: false; reason: MoveDecisionReason };

export type SelectDecisionReason = 'no-resource' | 'overlap';

export type SelectDecision = { allowed: true } | { allowed: false; reason: SelectDecisionReason };

/**
 * ドラッグ＆リサイズ時のロジック判定（実績ロック + ダブルブッキング禁止）
 */
export function evaluateMoveEvent(
  window: MoveWindow,
  dragged: SimpleResourceEvent,
  allEvents: SimpleResourceEvent[],
): MoveDecision {
  if (dragged.hasActual) {
    return { allowed: false, reason: 'locked' };
  }

  const hasOverlap = allEvents.some((event) => {
    if (event.id === dragged.id) return false;
    if (event.display === 'background') return false;
    if (event.resourceId !== window.resourceId) return false;
    return window.start < event.end && window.end > event.start;
  });

  if (hasOverlap) {
    return { allowed: false, reason: 'overlap' };
  }

  return { allowed: true };
}

/**
 * ドラッグ選択での新規作成ロジック（ダブルブッキング禁止）
 */
export function evaluateSelectEvent(
  window: MoveWindow,
  allEvents: SimpleResourceEvent[],
): SelectDecision {
  if (!window.resourceId) {
    return { allowed: false, reason: 'no-resource' };
  }

  const hasOverlap = allEvents.some((event) => {
    if (event.display === 'background') return false;
    if (event.resourceId !== window.resourceId) return false;
    return window.start < event.end && window.end > event.start;
  });

  if (hasOverlap) {
    return { allowed: false, reason: 'overlap' };
  }

  return { allowed: true };
}

/**
 * Issue 9: 背景警告イベント（キャパシティ超過警告）
 */
const fetchWarningEvents = (
  fetchInfo: { startStr: string; endStr: string },
  successCallback: (events: EventInput[]) => void,
  failureCallback: (error: Error) => void,
) => {
  try {
    // E2E時はハードコードされた警告イベントをスキップ
    if (isE2E) {
      successCallback([]);
      return;
    }

    // 本来は fetchInfo.start / end を使ってサーバ側で判定
    // ここでは「staff-1 の 09:00 - 18:00 が危険ゾーン」というモック
    const startDateStr = fetchInfo.startStr.slice(0, 10); // YYYY-MM-DD

    const warnings: EventInput[] = [
      {
        id: 'warn-staff-1',
        resourceId: 'staff-1',
        start: `${startDateStr}T09:00:00`,
        end: `${startDateStr}T18:00:00`,
        title: 'キャパシティ超過の可能性',
      },
    ];

    successCallback(warnings);
  } catch (error) {
    if (error instanceof Error) {
      failureCallback(error);
      return;
    }
    failureCallback(new Error('Failed to load warning events'));
  }
};

/**
 * PvsAステータスアイコン
 */
const getStatusIcon = (status?: PvsAStatus): string => {
  switch (status) {
    case 'waiting': return '⏳';
    case 'in-progress': return '🔄';
    case 'completed': return '✅';
    case 'delayed': return '⚠️';
    case 'cancelled': return '❌';
    default: return '📅';
  }
};

/**
 * 時刻フォーマット (HH:MM)
 */
const formatTime = (isoString: string): string => {
  return new Date(isoString).toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * PvsAイベント表示コンポーネント
 */
function PvsAEventContent({ event }: EventContentArg) {
  const props = event.extendedProps as UnifiedResourceEvent['extendedProps'];
  const { status, actualStart, actualEnd, percentComplete, diffMinutes } = props;

  return (
    <Box
      className="pvsA-event-content"
      sx={{
        p: 0.5,
        fontSize: '11px',
        lineHeight: 1.2,
        overflow: 'hidden'
      }}
    >
      <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block' }}>
        {getStatusIcon(status)} {event.title}
      </Typography>

      <Box className="time-info">
        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
          計画: {formatTime(event.startStr)} - {formatTime(event.endStr || '')}
        </Typography>

        {actualStart && actualEnd && (
          <Typography variant="caption" sx={{ display: 'block', color: 'primary.main' }}>
            実績: {formatTime(actualStart)} - {formatTime(actualEnd)}
          </Typography>
        )}
      </Box>

      {status === 'in-progress' && percentComplete !== undefined && (
        <Box sx={{ mt: 0.5 }}>
          <LinearProgress
            variant="determinate"
            value={percentComplete}
            sx={{ height: 3 }}
          />
          <Typography variant="caption" sx={{ fontSize: '10px' }}>
            {percentComplete}%
          </Typography>
        </Box>
      )}

      {status === 'delayed' && diffMinutes && diffMinutes > 0 && (
        <Chip
          label={`+${diffMinutes}分`}
          size="small"
          color="warning"
          sx={{ fontSize: '9px', height: 16, mt: 0.5 }}
        />
      )}

      {status === 'completed' && (
        <Chip
          label="完了"
          size="small"
          color="success"
          sx={{ fontSize: '9px', height: 16, mt: 0.5 }}
        />
      )}
    </Box>
  );
}

/**
 * 動的イベントクラス付与
 */
const getDynamicEventClasses = (arg: { event: { extendedProps: Record<string, unknown> } }): string[] => {
  const event = arg.event;
  const props = event.extendedProps as UnifiedResourceEvent['extendedProps'];
  const { planType, status } = props;

  const classes = ['unified-event'];

  // Plan種別クラス
  if (planType) {
    classes.push(`event-type-${planType}`);
  }

  // PvsAステータスクラス
  if (status) {
    classes.push(`event-status-${status}`);
  }

  return classes;
};

/**
 * モックデータ
 */
// (mockResources removed, now dynamic)

/**
 * 統合リソースカレンダーページ
 */

/**
 * 統合リソースカレンダーページ
 */
export default function IntegratedResourceCalendarPage() {
  const location = useLocation();
  const { schedules } = useFeatureFlags();
  const appConfig = useMemo(() => getAppConfig(), []);

  // 1️⃣ デバッグマーカー: この関数が確実に実行されているかを確認
  if (import.meta.env.DEV) {
    console.log('[IRC] mounted', {
      pathname: location.pathname,
      isE2E: isE2E,
      timestamp: new Date().toISOString(),
    });

    // E2E テスト用デバッグ情報
    console.log('[IRC] Page loading with E2E flag:', isE2E);
    console.log('[IRC] Current environment:', {
      VITE_E2E: isE2E,
      VITE_SP_RESOURCE: appConfig.VITE_SP_RESOURCE,
      VITE_FEATURE_SCHEDULES: schedules,
    });
  }

  const _sp = useSP();
  const ircSpClient = useMemo(() => {
    const client = createIrcSpClient();
    if (import.meta.env.DEV) {
      console.log('[IRC] SpClient created:', { isE2E: isE2E, client });
    }
    return client;
  }, []);

  const calendarRef = useRef<FullCalendar>(null);
  const [resources, setResources] = useState<ResourceInfo[]>([]);
  const [events, setEvents] = useState<UnifiedResourceEvent[]>([]);
  const [lastError, setLastError] = useState<SchedulesErrorInfo | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<UnifiedResourceEvent | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [showOnlyUnrecorded, setShowOnlyUnrecorded] = useState(false);

  // Issue 9 & 10 用: リソース毎の総計画時間と8h超過フラグ
  const [resourceWarnings, setResourceWarnings] = useState<Record<string, ResourceWarning>>({});

  // IRC データ読み込み (Lanes first, then events)
  useEffect(() => {
    const loadData = async () => {
      const dataSpan = startFeatureSpan(HYDRATION_FEATURES.integratedResourceCalendar.events, {
        status: 'pending',
        source: 'ircSpClient',
      });
      try {
        // Step 1: Resources (placeholder - not yet in client API)
        const fetchedResources: ResourceInfo[] = [];
        setResources(fetchedResources);

        // Step 2: Fetch events
        const unifiedEvents = await ircSpClient.getUnifiedEvents();
        setEvents(unifiedEvents);

        setLastError(null); // Clear error on success

        if (import.meta.env.DEV) {
          console.log('[IRC] Loaded resources:', fetchedResources.length);
          console.log('[IRC] Loaded events count:', unifiedEvents.length);
        }

        dataSpan({
          meta: {
            status: 'ok',
            resourceCount: fetchedResources.length,
            eventCount: unifiedEvents.length,
          },
        });
      } catch (error) {
        console.error('[IRC] Failed to load IRC data:', error);

        const errorInfo = classifySchedulesError(error);
        setLastError(errorInfo);
        setSnackbarOpen(true);

        dataSpan({
          meta: { status: 'error' },
          error: error instanceof Error ? error.message : String(error),
        });

        setFeedbackMessage(errorInfo.message || 'データの読み込みに失敗しました');
      }
    };

    loadData();
  }, [ircSpClient]);

  /**
   * 記録済みイベント数と表示対象イベントのメモ化
   */
  const recordedEventsCount = useMemo(
    () => events.filter((event) => !!event.extendedProps?.actualStart).length,
    [events]
  );

  const visibleEvents = useMemo(
    () => (showOnlyUnrecorded
      ? events.filter((event) => !event.extendedProps?.actualStart)
      : events
    ),
    [showOnlyUnrecorded, events]
  );

  /**
   * Issue 10: イベント変更時に総計画時間を計算（無限ループ防止）
   */
  useEffect(() => {
    if (events.length === 0) return;

    const warningSpan = startFeatureSpan(HYDRATION_FEATURES.integratedResourceCalendar.warnings, {
      status: 'pending',
      events: events.length,
    });

    try {
      const totals: Record<string, ResourceWarning> = {};

      for (const event of events) {
        if (!event.resourceId) continue;

        const startTime = new Date(event.start).getTime();
        const endTime = new Date(event.end).getTime();
        const durationHours = (endTime - startTime) / (1000 * 60 * 60);

        if (!totals[event.resourceId]) {
          totals[event.resourceId] = { totalHours: 0, isOver: false };
        }
        totals[event.resourceId].totalHours += durationHours;
      }

      const WORK_HOUR_LIMIT = 8;
      for (const resourceId of Object.keys(totals)) {
        const rounded = Math.round(totals[resourceId].totalHours * 10) / 10;
        totals[resourceId].totalHours = rounded;
        totals[resourceId].isOver = rounded > WORK_HOUR_LIMIT;
      }

      setResourceWarnings(totals);
      warningSpan({
        meta: {
          status: 'ok',
          resources: Object.keys(totals).length,
          bytes: estimatePayloadSize(totals),
        },
      });
    } catch (error) {
      warningSpan({
        meta: { status: 'error' },
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }, [events]);

  /**
   * E2E テスト用: eventDidMount で実績の有無に応じて testid を付与
   */
  const handleEventDidMount = useCallback((info: EventMountArg) => {
    const event = info.event;
    const element = info.el;
    const eventProps = event.extendedProps as UnifiedResourceEvent['extendedProps'];
    const hasActual = eventProps?.actualStart;

    // 全てのイベントでログ出力
    if (import.meta.env.DEV) {
      console.log('[IRC] eventDidMount called', {
        id: event.id,
        title: event.title,
        allEventsLength: visibleEvents.length
      });
    }

    // イベントの実際の編集可能性を判定
    // 1. 実績がある場合は編集不可
    // 2. extendedPropsでeditableが明示的にfalseの場合は編集不可
    const eventData = events.find(e => e.id === event.id);
    const isLocked = hasActual || (eventData && eventData.editable === false);

    if (isE2E) {
      // E2E用のdata-testid属性を設定
      let testId: string;

      if (isLocked) {
        testId = 'irc-event-locked';
      } else {
        // 編集可能なイベントには一意性を持たせる
        testId = `irc-event-editable-${event.id}`;
      }

      element.setAttribute('data-testid', testId);
      if (import.meta.env.DEV) {
        console.log('[IRC] eventDidMount E2E testid set', {
          id: event.id,
          title: event.title,
          hasActual: !!hasActual,
          isLocked,
          eventDataEditable: eventData?.editable,
          testId,
        });
      }
    }
  }, [events, visibleEvents]);

  /**
   * スナックバー表示
   */
  const showSnackbar = (message: string) => {
    setSnackbarMessage(message);
    setSnackbarOpen(true);
  };

  /**
   * ダブルブッキング・実績ロック判定（ドラッグ&リサイズ用）
   */
  const handleEventAllow = useCallback(
    (dropInfo: EventAllowInfo, draggedEvent: EventApi | null): boolean => {
      if (!draggedEvent) {
        return false;
      }

      const { start, end, resource } = dropInfo;
      if (!start || !end) {
        return false;
      }

      const calendarApi = calendarRef.current?.getApi();
      if (!calendarApi) return false;

      const allEvents = calendarApi.getEvents();
      const draggedProps = draggedEvent.extendedProps as CalendarExtendedProps;
      const targetResourceId =
        resource?.id ??
        draggedEvent.getResources?.()[0]?.id ??
        draggedProps?.resourceId;

      if (!targetResourceId) {
        setFeedbackMessage('リソースが特定できない場所には予定を移動できません。');
        return false;
      }

      const simpleDragged: SimpleResourceEvent = {
        id: draggedEvent.id,
        resourceId: targetResourceId,
        start,
        end,
        display: draggedEvent.display,
        hasActual: !!draggedProps?.actualStart,
      };

      const simpleEvents: SimpleResourceEvent[] = allEvents
        .map((eventApi) => {
          const eventProps = eventApi.extendedProps as CalendarExtendedProps;
          const resourceId =
            eventApi.getResources?.()[0]?.id ??
            eventProps?.resourceId ??
            '';

          if (!resourceId || !eventApi.start || !eventApi.end) {
            return null;
          }

          return {
            id: eventApi.id,
            resourceId,
            start: eventApi.start,
            end: eventApi.end,
            display: eventApi.display,
            hasActual: !!eventProps?.actualStart,
          } as SimpleResourceEvent;
        })
        .filter((event): event is SimpleResourceEvent => event !== null);

      const decision = evaluateMoveEvent(
        { resourceId: targetResourceId, start, end },
        simpleDragged,
        simpleEvents,
      );

      if (!decision.allowed) {
        if (decision.reason === 'locked') {
          setFeedbackMessage('実績登録済みのため編集できません');
        } else if (decision.reason === 'overlap') {
          setFeedbackMessage('同じスタッフの同じ時間帯に重複する予定は登録できません。');
        }
        return false;
      }

      return true;
    },
    [setFeedbackMessage],
  );

  /**
   * 新規作成（ドラッグ選択）用重複判定
   */
  const handleSelectAllow = useCallback(
    (selectInfo: SelectAllowInfo): boolean => {
      const { start, end, resource } = selectInfo;

      if (!start || !end) {
        return false;
      }

      const calendarApi = calendarRef.current?.getApi();
      if (!calendarApi) return false;

      const allEvents = calendarApi.getEvents();
      const targetResourceId = resource?.id ?? '';

      if (!targetResourceId) {
        setFeedbackMessage('リソース行上でのみ予定を作成できます。');
        return false;
      }

      const simpleEvents: SimpleResourceEvent[] = allEvents
        .map((eventApi) => {
          const eventProps = eventApi.extendedProps as CalendarExtendedProps;
          const resourceId =
            eventApi.getResources?.()[0]?.id ??
            eventProps?.resourceId ??
            '';

          if (!resourceId || !eventApi.start || !eventApi.end) {
            return null;
          }

          return {
            id: eventApi.id,
            resourceId,
            start: eventApi.start,
            end: eventApi.end,
            display: eventApi.display,
            hasActual: !!eventProps?.actualStart,
          } as SimpleResourceEvent;
        })
        .filter((event): event is SimpleResourceEvent => event !== null);

      const decision = evaluateSelectEvent(
        { resourceId: targetResourceId, start, end },
        simpleEvents,
      );

      if (!decision.allowed) {
        if (decision.reason === 'no-resource') {
          setFeedbackMessage('リソース行上でのみ予定を作成できます。');
        } else if (decision.reason === 'overlap') {
          setFeedbackMessage('すでに予定が入っている時間帯には新しい予定を作成できません。');
        }
        return false;
      }

      return true;
    },
    [setFeedbackMessage],
  );

  /**
   * Issue 10: resourceAreaColumns で「総計画時間 h + ⚠️」を表示
   */
  const resourceAreaColumns = useMemo(
    () => [
      { field: 'title', headerContent: 'スタッフ' },
      {
        headerContent: '総計画時間',
        field: 'id', // resource の id を受け取る用
        cellContent: (arg: ResourceLabelContentArg) => {
          const resourceId = String(arg.resource.id ?? '');
          const warning = resourceWarnings[resourceId];

          if (!warning || warning.totalHours === 0) {
            return React.createElement('span', {
              'data-testid': `irc-resource-warning-${resourceId}`
            }, '0h');
          }

          if (warning.isOver) {
            return React.createElement('span', {
              style: { color: 'red', fontWeight: 'bold' },
              'data-testid': `irc-resource-warning-${resourceId}`
            }, `⚠️ ${warning.totalHours.toFixed(1)}h`);
          }

          return React.createElement('span', {
            'data-testid': `irc-resource-warning-${resourceId}`
          }, `${warning.totalHours.toFixed(1)}h`);
        },
      },
    ],
    [resourceWarnings],
  );

  /**
   * イベント表示カスタマイズ
   */
  const renderEventContent = (arg: EventContentArg) => (
    <PvsAEventContent {...arg} />
  );

  /**
   * イベントクリック
   */
  const handleEventClick = (info: EventClickArg) => {
    const props = info.event.extendedProps as UnifiedResourceEvent['extendedProps'];

    // UnifiedResourceEventオブジェクトを構築
    const unifiedEvent: UnifiedResourceEvent = {
      id: info.event.id,
      resourceId: info.event.getResources()[0]?.id || '',
      title: info.event.title,
      start: info.event.startStr,
      end: info.event.endStr || '',
      extendedProps: props
    };

    setSelectedEvent(unifiedEvent);
    setDialogOpen(true);
  };

  /**
   * 新規作成（日付選択）
   */
  const handleDateSelect = (info: DateSelectArg) => {
    const title = prompt('予定のタイトルを入力してください:');
    if (!title) return;

    const newEvent: UnifiedResourceEvent = {
      id: `plan-${Date.now()}`,
      resourceId: info.resource?.id || '',
      title,
      start: info.startStr,
      end: info.endStr,
      editable: true,
      extendedProps: {
        planId: `plan-${Date.now()}`,
        planType: 'visit',
        status: 'waiting'
      }
    };

    setEvents(prev => [...prev, newEvent]);
    showSnackbar('予定を作成しました');

    // 新規作成時に未記録フィルターがONなら自動で表示されるよう調整
    if (showOnlyUnrecorded) {
      console.log('[IRC] New event created in unrecorded filter mode');
    }
  };

  /**
   * リアルタイム更新のモック
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!calendarRef.current || typeof calendarRef.current.getApi !== 'function') return;
      const calendarApi = calendarRef.current.getApi();

      const event = calendarApi.getEventById('plan-1');
      if (!event) return;

      // 実績開始をシミュレート
      event.setExtendedProp('actualStart', new Date().toISOString());
      event.setExtendedProp('status', 'in-progress');
      event.setExtendedProp('percentComplete', 30);

      showSnackbar('実績が更新されました（モック）');
    }, 5000); // 5秒後に更新

    return () => clearTimeout(timer);
  }, []);

  return (
    <Container
      maxWidth="xl"
      sx={{ py: 2 }}
      data-testid="irc-page"
    >
      {/* 一時的デバッグバナー：E2E環境でページが正しく表示されているかの確認 */}
      <Typography
        variant="overline"
        data-testid="irc-debug-banner"
        sx={{
          display: 'block',
          mb: 1,
          color: 'primary.main',
          fontWeight: 'bold',
          backgroundColor: 'primary.50',
          padding: 1,
          borderRadius: 1
        }}
      >
        IRC PAGE MOUNTED (debug) - E2E: {isE2E ? 'YES' : 'NO'}
      </Typography>

      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          統合リソースカレンダー
        </Typography>
        <Typography variant="subtitle1" component="span" color="text.secondary">
          Plan vs Actual 管理ビュー
        </Typography>
      </Box>

      {/* 警告表示エリア */}
      <Alert severity="info" sx={{ mb: 2 }}>
        💡 Sprint 3 実装中: PvsA統合表示・リアルタイム更新機能
      </Alert>

      {/* フィルタリングコントロール */}
      <Paper elevation={0} sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="subtitle2" component="span" color="text.secondary">
              表示設定
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={showOnlyUnrecorded}
                  onChange={(_event, checked) => setShowOnlyUnrecorded(checked)}
                  color="primary"
                  data-testid="irc-filter-toggle"
                />
              }
              label="未記録のみ表示"
            />
          </Stack>
          <Stack direction="row" spacing={2} alignItems="center">
            <Chip
              label={`総イベント: ${events.length}件`}
              size="small"
              variant="outlined"
              color="default"
              data-testid="irc-total-events"
            />
            <Chip
              label={`記録済み: ${recordedEventsCount}件`}
              size="small"
              variant="outlined"
              color="success"
              data-testid="irc-recorded-events"
            />
            <Chip
              label={`表示中: ${visibleEvents.length}件`}
              size="small"
              variant="filled"
              color="primary"
              data-testid="irc-visible-events"
            />
          </Stack>
        </Stack>
      </Paper>

      <Paper elevation={1}>
        <Box sx={{ height: '70vh' }}>
          <style>
            {`
            .unified-event {
              border-radius: 4px;
              overflow: hidden;
            }

            .event-type-visit {
              background-color: #e3f2fd;
              border-left: 4px solid #1976d2;
            }

            .event-type-travel {
              background-color: #f3e5f5;
              border-left: 4px solid #7b1fa2;
            }

            .event-type-break {
              background-color: #e8f5e8;
              border-left: 4px solid #388e3c;
            }

            .event-status-waiting {
              opacity: 0.7;
            }

            .event-status-in-progress {
              border: 2px solid #1976d2;
              animation: pulse 2s infinite;
            }

            .event-status-completed {
              border: 2px solid #4caf50;
            }

            .event-status-delayed {
              border: 2px solid #ff9800;
              background-color: #fff3e0 !important;
            }

            .event-status-cancelled {
              background-color: #ffebee !important;
              opacity: 0.5;
              text-decoration: line-through;
            }

            .fc-event-warning-bg {
              background-color: rgba(255, 0, 0, 0.15) !important;
              border: none !important;
            }

            .fc-event-warning-bg:hover {
              background-color: rgba(255, 0, 0, 0.25) !important;
            }

            @keyframes pulse {
              0% { border-color: #1976d2; }
              50% { border-color: #42a5f5; }
              100% { border-color: #1976d2; }
            }
            `}
          </style>

          <FullCalendar
            ref={calendarRef}
            key={`calendar-${visibleEvents.length}`} // visibleEvents更新時に強制再レンダー
            plugins={[resourceTimelinePlugin, interactionPlugin]}
            initialView="resourceTimelineDay"
            initialDate="2025-11-16" // 固定日付でテスト
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'resourceTimelineDay,resourceTimelineWeek'
            }}
            resources={resources}
            resourceAreaColumns={resourceAreaColumns}

            // --- イベントソース（フィルタリング適用） ---
            events={visibleEvents}

            eventSources={[
              {
                id: 'warning-events',
                events: fetchWarningEvents,
                display: 'background',
                color: 'rgba(255, 0, 0, 0.15)',
                className: 'fc-event-warning-bg',
              },
            ]}

            eventContent={renderEventContent}
            eventClassNames={getDynamicEventClasses}
            eventDidMount={handleEventDidMount}
            editable={true}
            selectable={true}
            selectMirror={true}

            // --- 物理的ダブルブッキング禁止 + 実績ロック ---
            eventAllow={handleEventAllow}
            selectAllow={handleSelectAllow}
            eventOverlap={true} // 判定は eventAllow に集約

            select={handleDateSelect}
            eventClick={handleEventClick}
            height="auto"
            slotMinTime="07:00:00"
            slotMaxTime="20:00:00"
            slotDuration="00:30:00"
            resourceAreaWidth="300px"
            resourceAreaHeaderContent="リソース"
            locale="ja"
            timeZone="Asia/Tokyo"
            nowIndicator={true}
          />
        </Box>
      </Paper>

      {/* イベント詳細ダイアログ */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          予定詳細 {selectedEvent && getStatusIcon(selectedEvent.extendedProps.status)}
        </DialogTitle>
        <DialogContent>
          {selectedEvent && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography><strong>タイトル:</strong> {selectedEvent.title}</Typography>
              <Typography><strong>計画時間:</strong> {formatTime(selectedEvent.start)} - {formatTime(selectedEvent.end)}</Typography>
              <Typography><strong>種別:</strong> {selectedEvent.extendedProps.planType}</Typography>
              <Typography><strong>ステータス:</strong> {selectedEvent.extendedProps.status}</Typography>

              {selectedEvent.extendedProps.actualStart && (
                <>
                  <Typography><strong>実績開始:</strong> {formatTime(selectedEvent.extendedProps.actualStart)}</Typography>
                  {selectedEvent.extendedProps.actualEnd && (
                    <Typography><strong>実績終了:</strong> {formatTime(selectedEvent.extendedProps.actualEnd)}</Typography>
                  )}
                  {selectedEvent.extendedProps.diffMinutes !== undefined && selectedEvent.extendedProps.diffMinutes !== null && (
                    <Typography><strong>差分:</strong> {selectedEvent.extendedProps.diffMinutes > 0 ? '+' : ''}{selectedEvent.extendedProps.diffMinutes}分</Typography>
                  )}
                </>
              )}

              {selectedEvent.extendedProps.notes && (
                <Typography><strong>備考:</strong> {selectedEvent.extendedProps.notes}</Typography>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          {selectedEvent && !selectedEvent.extendedProps.actualStart && (
            <Button
              color="error"
              onClick={() => {
                setEvents(prev => prev.filter(e => e.id !== selectedEvent.id));
                setDialogOpen(false);
                showSnackbar('予定を削除しました');
              }}
            >
              削除
            </Button>
          )}
          <Button onClick={() => setDialogOpen(false)}>
            閉じる
          </Button>
        </DialogActions>
      </Dialog>

      {/* スナックバー (Unified Pattern) */}
      <Snackbar
        open={snackbarOpen || !!lastError}
        autoHideDuration={6000}
        onClose={() => {
          setSnackbarOpen(false);
          setLastError(null);
        }}
      >
        <Alert
          severity={lastError?.kind === 'NETWORK_ERROR' ? 'error' : 'warning'}
          onClose={() => {
            setSnackbarOpen(false);
            setLastError(null);
          }}
          data-testid="irc-error-alert"
        >
          {lastError?.message || snackbarMessage}
        </Alert>
      </Snackbar>

      {/* ダブルブッキング・実績ロック用フィードバック */}
      <Snackbar
        open={!!feedbackMessage}
        autoHideDuration={4000}
        onClose={(_, reason) => {
          if (reason === 'clickaway') return;
          setFeedbackMessage(null);
        }}
        message={feedbackMessage}
      />
    </Container>
  );
}

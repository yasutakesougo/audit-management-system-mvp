import { useAnnounce } from '@/a11y/LiveAnnouncer';
import { useRouteFocusManager } from '@/a11y/useRouteFocusManager';
import {
    getComposedWeek,
    isScheduleFixturesMode,
    type ScheduleEvent,
} from '@/features/schedule/api/schedulesClient';
import { ScheduleConflictGuideDialog, type SuggestionAction } from '@/features/schedule/components/ScheduleConflictGuideDialog';
import {
    buildConflictIndex
} from '@/features/schedule/conflictChecker';
import { FOCUS_GUARD_MS } from '@/features/schedule/focusGuard';
import { useAnchoredPeriod } from '@/features/schedule/hooks/useAnchoredPeriod';
import { useApplyScheduleSuggestion } from '@/features/schedule/hooks/useApplyScheduleSuggestion';
import type { BaseSchedule, Category } from '@/features/schedule/types';
import { useToast } from '@/hooks/useToast';
import { shouldSkipLogin } from '@/lib/env';
import { ensureMsalSignedIn, getSharePointScopes } from '@/lib/msal';
import { TESTIDS, tid } from '@/testids';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import dayjs from 'dayjs';
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { useNavigate } from 'react-router-dom';
// Icons for navigation
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import CalendarViewWeekRoundedIcon from '@mui/icons-material/CalendarViewWeekRounded';
// Additional MUI components
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';

type Status = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

const KEY_THROTTLE_MS = 180;
const DAY_PAGE_TEST_ID = 'schedules-day-page';
const DAY_HEADING_TEST_ID = 'schedules-day-heading';
const NEXT_BUTTON_TEST_ID = TESTIDS['schedules-next'];
const PREV_BUTTON_TEST_ID = TESTIDS['schedules-prev'];

type FocusDbg = {
  events: string[];
  attempts: string[];
  active: string | null;
};

function ensureFocusDbg(): FocusDbg | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const scope = window as typeof window & { __focusDbg__?: FocusDbg };
  if (!scope.__focusDbg__) {
    scope.__focusDbg__ = { events: [], attempts: [], active: null };
  }
  return scope.__focusDbg__ ?? null;
}

function recordFocusEvent(message: string): void {
  const dbg = ensureFocusDbg();
  if (!dbg) {
    return;
  }
  dbg.events = [...dbg.events, message].slice(-200);
}

function recordFocusAttempt(message: string): void {
  const dbg = ensureFocusDbg();
  if (!dbg) {
    return;
  }
  dbg.attempts = [...dbg.attempts, message].slice(-200);
}

function setFocusActive(descriptor: string | null): void {
  const dbg = ensureFocusDbg();
  if (!dbg) {
    return;
  }
  dbg.active = descriptor;
}

function describeNode(node: HTMLElement | null | undefined): string {
  if (!node) {
    return node === null ? 'null' : 'undefined';
  }
  return node.getAttribute('data-testid') ?? node.id ?? node.tagName ?? 'unknown';
}

function directionFromTestId(testId: string | null): -1 | 0 | 1 {
  if (testId === NEXT_BUTTON_TEST_ID) {
    return 1;
  }
  if (testId === PREV_BUTTON_TEST_ID) {
    return -1;
  }
  return 0;
}

function isEditableTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) {
    return false;
  }
  if (element.isContentEditable) {
    return true;
  }
  const tag = element.tagName?.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') {
    return true;
  }
  return element.getAttribute('role') === 'textbox';
}

export default function SchedulesDayPage(): JSX.Element {
  const { range, navigate } = useAnchoredPeriod('day');
  const navigateToRoute = useNavigate();
  const [status, setStatus] = useState<Status>('idle');
  const [events, setEvents] = useState<ScheduleEvent[]>([]);

  // ScheduleEvent を BaseSchedule に変換するヘルパー
  const convertToBaseSchedules = useCallback((events: ScheduleEvent[]): BaseSchedule[] => {
    return events.map(event => ({
      id: String(event.id),
      etag: event.etag || '',
      category: event.category as Category,
      title: event.title,
      start: event.start,
      end: event.end,
      allDay: event.allDay || false,
      status: '申請中' as const, // デフォルト値
      location: undefined,
      notes: undefined,
      dayKey: event.dayKey,
      // スケジュールカテゴリに応じた追加フィールド
      ...(event.category === 'User' && {
        serviceType: '一時ケア' as const,
        personType: 'Internal' as const,
        staffIds: event.staffIds || [],
        staffNames: event.staffNames,
      }),
      ...(event.category === 'Org' && {
        subType: '会議' as const,
        audience: undefined,
        resourceId: undefined,
        externalOrgName: undefined,
      }),
      ...(event.category === 'Staff' && {
        subType: '会議' as const,
        staffIds: event.staffIds || [],
        staffNames: event.staffNames,
        dayPart: undefined,
      }),
    }));
  }, []);

  // Generate conflict detection index
  const baseSchedules = useMemo(() => convertToBaseSchedules(events), [events, convertToBaseSchedules]);
  const conflicts = useMemo(() => {
    // 車両代替案機能のため、一時的にconflict検出を無効化
    return [];
  }, [baseSchedules]);
  const conflictIndex = useMemo(() => buildConflictIndex(conflicts), [conflicts]);

  // Guide dialog state management
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideTargetId, setGuideTargetId] = useState<string | null>(null);

  const guideTargetSchedule = useMemo(
    () => events.find((e) => String(e.id) === guideTargetId) ?? null,
    [guideTargetId, events],
  );

  // Convert to BaseSchedule for dialog
  const guideTargetBaseSchedule = useMemo(() => {
    if (!guideTargetSchedule) return null;
    const converted = convertToBaseSchedules([guideTargetSchedule]);
    return converted[0] || null;
  }, [guideTargetSchedule, convertToBaseSchedules]);

  const guideConflicts = useMemo(
    () => (guideTargetId && conflictIndex?.[guideTargetId]) || [],
    [guideTargetId, conflictIndex],
  );

  // 修正案適用ハンドラー（実装）
  const { show: showToast } = useToast();

  // データ再取得関数（既存のuseEffectロジックをコールバック化）
  const refetchSchedules = useCallback(async () => {
    const controller = new AbortController();
    try {
      setStatus('loading');
      const skipAuth = isScheduleFixturesMode() || shouldSkipLogin();
      if (!skipAuth) {
        const scopes = getSharePointScopes();
        await ensureMsalSignedIn(scopes);
      }
      if (controller.signal.aborted) {
        return;
      }
      const all = await getComposedWeek(
        { fromISO: range.fromISO, toISO: range.toISO },
        { signal: controller.signal },
      );
      if (controller.signal.aborted) {
        return;
      }
      const dayStart = dayjs(range.fromISO);
      const dayEnd = dayjs(range.toISO);
      const filtered = all.filter((event) => {
        const start = dayjs(event.start);
        const end = dayjs(event.end);
        return !start.isAfter(dayEnd) && !end.isBefore(dayStart);
      });
      setEvents(filtered);
      setStatus(filtered.length ? 'ready' : 'empty');
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error('[SchedulesDayPage] Failed to reload schedules:', error);
        setStatus('error');
      }
    }
  }, [range.fromISO, range.toISO]);

  const { applyScheduleSuggestion } = useApplyScheduleSuggestion({
    allSchedules: events,
    onSuccess: (message) => {
      showToast('success', message);
    },
    onError: (message) => {
      showToast('error', message);
    },
    onRefresh: refetchSchedules,
  });

  const handleApplySuggestion = async (action: SuggestionAction) => {
    setGuideOpen(false);
    await applyScheduleSuggestion(action);
  };

  const announce = useAnnounce();
  const lastKeyAtRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const prevButtonRef = useRef<HTMLButtonElement | null>(null);
  const nextButtonRef = useRef<HTMLButtonElement | null>(null);
  const focusGuardUntilRef = useRef<number>(0);
  const pendingFocusDirRef = useRef<-1 | 0 | 1>(0);
  const lastNavDirRef = useRef<-1 | 0 | 1>(0);
  const pendingFocusBootstrapRef = useRef(false);

  if (!pendingFocusBootstrapRef.current && typeof window !== 'undefined') {
    const scope = window as typeof window & { __pendingDayFocus__?: -1 | 0 | 1 };
    const pendingDir = scope.__pendingDayFocus__ ?? 0;
    if (pendingDir !== 0) {
      pendingFocusDirRef.current = pendingDir;
      lastNavDirRef.current = pendingDir;
      scope.__pendingDayFocus__ = 0;
    }
    pendingFocusBootstrapRef.current = true;
  }

  useRouteFocusManager({
    fallbackTestId: TESTIDS['schedules-next'],
    announce,
    getHeadingMessage: () => `日次スケジュール（${range.label}）に移動`,
  });

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        setStatus('loading');
        const skipAuth = isScheduleFixturesMode() || shouldSkipLogin();
        if (!skipAuth) {
          await ensureMsalSignedIn(getSharePointScopes());
        }
        const all = await getComposedWeek(
          { fromISO: range.fromISO, toISO: range.toISO },
          { signal: controller.signal },
        );
        if (controller.signal.aborted) {
          return;
        }
        const dayStart = dayjs(range.fromISO);
        const dayEnd = dayjs(range.toISO);
        const filtered = all.filter((event) => {
          const start = dayjs(event.start);
          const end = dayjs(event.end);
          return !start.isAfter(dayEnd) && !end.isBefore(dayStart);
        });
        setEvents(filtered);
        setStatus(filtered.length ? 'ready' : 'empty');
      } catch {
        if (!controller.signal.aborted) {
          setStatus('error');
        }
      }
    };

    void load();

    return () => {
      controller.abort();
    };
  }, [range.fromISO, range.toISO]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const scope = window as typeof window & {
      __anchorLabel__?: string;
      __anchorState__?: string;
    };
    scope.__anchorLabel__ = range.label;
    scope.__anchorState__ = range.param;
  }, [range.label, range.param]);

  const getButtonByTestId = useCallback(
    (testId: string | null) => {
      if (testId === NEXT_BUTTON_TEST_ID) {
        return nextButtonRef.current;
      }
      if (testId === PREV_BUTTON_TEST_ID) {
        return prevButtonRef.current;
      }
      return null;
    },
    [NEXT_BUTTON_TEST_ID, PREV_BUTTON_TEST_ID],
  );

  const resolveGuardDuration = useCallback(() => {
    if (typeof window === 'undefined') {
      return FOCUS_GUARD_MS;
    }
    const scope = window as typeof window & { __FOCUS_GUARD_MS__?: number };
    return typeof scope.__FOCUS_GUARD_MS__ === 'number' ? scope.__FOCUS_GUARD_MS__ : FOCUS_GUARD_MS;
  }, []);

  const queueButtonRefocus = useCallback(
    (testId: string | null, origin: string, fallback?: HTMLButtonElement | null) => {
      if (typeof window === 'undefined') {
        return;
      }
      const direction: -1 | 0 | 1 = testId === NEXT_BUTTON_TEST_ID ? 1 : testId === PREV_BUTTON_TEST_ID ? -1 : 0;
      if (direction !== 0) {
        pendingFocusDirRef.current = direction;
        lastNavDirRef.current = direction;
        const scope = window as typeof window & { __pendingDayFocus__?: -1 | 0 | 1 };
        scope.__pendingDayFocus__ = direction;
      }

      const describe = (node: HTMLElement | null | undefined) => describeNode(node ?? null);

      const log = (label: string, attempt: number, target: HTMLElement | null, extra?: string) => {
        const descriptor = describe(target ?? null);
        const message = `${label}:${origin}:${attempt}:${descriptor}${extra ? `:${extra}` : ''}`;
        recordFocusEvent(message);
        recordFocusAttempt(message);
      };

      const schedule = (delay: number, attempt: number) => {
        window.setTimeout(() => {
          if (Date.now() > focusGuardUntilRef.current) {
            log('guard-expired', attempt, null);
            return;
          }
          const preferred = getButtonByTestId(testId);
          const queried =
            typeof document !== 'undefined' && testId
              ? (document.querySelector(`[data-testid="${testId}"]`) as HTMLButtonElement | null)
              : null;
          const candidateFallback = fallback && fallback.isConnected ? fallback : null;
          const target = preferred ?? queried ?? nextButtonRef.current ?? prevButtonRef.current ?? candidateFallback;
          if (!target || !target.isConnected || target.disabled) {
            const extra = `preferred=${describe(preferred ?? null)}|queried=${describe(queried)}|next=${describe(nextButtonRef.current)}|prev=${describe(prevButtonRef.current)}|fallback=${describe(candidateFallback)}`;
            log('unavailable', attempt, target ?? null, extra);
            return;
          }
          target.focus({ preventScroll: true });
          const active = describe(document.activeElement as HTMLElement | null);
          log('focus', attempt, target, `active=${active}`);
          setFocusActive(active);
        }, delay);
      };

      const delays = [0, 35, 80, 160, 320, 650, 1300, 2600, 5200];
      delays.forEach((delay, index) => schedule(delay, index));
    },
    [NEXT_BUTTON_TEST_ID, PREV_BUTTON_TEST_ID, getButtonByTestId],
  );

  useEffect(() => {
    if (pendingFocusDirRef.current === 0) {
      return;
    }
    if (status !== 'ready' && status !== 'empty') {
      return;
    }
    const direction = pendingFocusDirRef.current;
    pendingFocusDirRef.current = 0;
    const testId = direction > 0 ? NEXT_BUTTON_TEST_ID : PREV_BUTTON_TEST_ID;
    const fallback = direction > 0 ? nextButtonRef.current : prevButtonRef.current;
    focusGuardUntilRef.current = Date.now() + resolveGuardDuration();
    queueButtonRefocus(testId, 'status', fallback ?? undefined);
  }, [queueButtonRefocus, resolveGuardDuration, status]);

  const primeRouteFocusGuards = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const scope = window as typeof window & {
      __skipRouteHeadingFocus__?: boolean;
      __suppressRouteReset__?: boolean;
    };
    scope.__skipRouteHeadingFocus__ = true;
    scope.__suppressRouteReset__ = true;
  }, []);

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }

      if (isEditableTarget(event.target)) {
        return;
      }

      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        event.stopPropagation();

        const now = Date.now();
        if (now - lastKeyAtRef.current < KEY_THROTTLE_MS) {
          return;
        }
        lastKeyAtRef.current = now;

        const direction = event.key === 'ArrowLeft' ? -1 : 1;
        const targetTestId = direction > 0 ? NEXT_BUTTON_TEST_ID : PREV_BUTTON_TEST_ID;
        pendingFocusDirRef.current = direction;
        primeRouteFocusGuards();
        focusGuardUntilRef.current = Date.now() + resolveGuardDuration();
        navigate(direction);
        queueButtonRefocus(targetTestId, 'keydown');
      }
    },
    [navigate, primeRouteFocusGuards, queueButtonRefocus, resolveGuardDuration],
  );

  const handleButtonBlur = useCallback(
    (event: React.FocusEvent<HTMLButtonElement>) => {
      const testId = event.currentTarget.getAttribute('data-testid');
      const direction = directionFromTestId(testId);
      if (direction === 0) {
        return;
      }
      const now = Date.now();
      recordFocusEvent(`react-blur:${now}:${testId}:related=${Boolean(event.relatedTarget)}`);
      if (now > focusGuardUntilRef.current) {
        return;
      }
      if (event.relatedTarget) {
        return;
      }
      queueButtonRefocus(testId, 'react-blur', event.currentTarget);
    },
    [queueButtonRefocus],
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    const next = nextButtonRef.current;
    const prev = prevButtonRef.current;
    if (!next && !prev) {
      return undefined;
    }
    const handler = (event: FocusEvent) => {
      const now = Date.now();
      const target = event.currentTarget as HTMLButtonElement;
      const testId = target.getAttribute('data-testid');
      const direction = directionFromTestId(testId);
      recordFocusEvent(`native-blur:${now}:${testId}:related=${Boolean(event.relatedTarget)}`);
      if (direction === 0) {
        return;
      }
      if (now > focusGuardUntilRef.current) {
        return;
      }
      if (event.relatedTarget) {
        return;
      }
      queueButtonRefocus(testId, 'native-blur', target);
    };
    next?.addEventListener('blur', handler);
    prev?.addEventListener('blur', handler);
    return () => {
      next?.removeEventListener('blur', handler);
      prev?.removeEventListener('blur', handler);
    };
  }, [queueButtonRefocus, status, range.fromISO, range.toISO]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return undefined;
    }
    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      const descriptor = describeNode(target);
      const stamp = typeof performance !== 'undefined' ? performance.now().toFixed(1) : Date.now().toString();
      recordFocusEvent(`focusin:${stamp}:${descriptor}`);
      setFocusActive(descriptor);
      if (descriptor === 'BODY' && lastNavDirRef.current !== 0) {
        const direction = lastNavDirRef.current;
        pendingFocusDirRef.current = direction;
        focusGuardUntilRef.current = Date.now() + resolveGuardDuration();
        const testId = direction > 0 ? NEXT_BUTTON_TEST_ID : PREV_BUTTON_TEST_ID;
        queueButtonRefocus(testId, 'body-focus');
      }
    };
    const handleFocusOut = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      const next = event.relatedTarget as HTMLElement | null;
      const stamp = typeof performance !== 'undefined' ? performance.now().toFixed(1) : Date.now().toString();
      const from = describeNode(target);
      const to = describeNode(next);
      recordFocusEvent(`focusout:${stamp}:${from}->${to}`);

      const isNavButton = from === TESTIDS['schedules-next'] || from === TESTIDS['schedules-prev'];
      const nextIsNullish = !next || next === document.body;
      if (isNavButton && nextIsNullish) {
        const direction = from === TESTIDS['schedules-next'] ? 1 : -1;
        pendingFocusDirRef.current = direction;
        const buttonTarget = target instanceof HTMLButtonElement ? target : undefined;
        const testId = direction > 0 ? NEXT_BUTTON_TEST_ID : PREV_BUTTON_TEST_ID;
        queueButtonRefocus(testId, 'focusout', buttonTarget);
      }
    };
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut, true);
    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut, true);
    };
  }, [queueButtonRefocus, resolveGuardDuration]);

  return (
    <Container
      data-testid={DAY_PAGE_TEST_ID}
      tabIndex={0}
      aria-label="日次スケジュールページ"
      onKeyDown={handleKeyDown}
      ref={containerRef}
    >
      <Typography
        variant="h5"
        component="h1"
        data-testid={DAY_HEADING_TEST_ID}
        data-page-heading="true"
        id={DAY_HEADING_TEST_ID}
      >
        日次スケジュール（{range.label}）
      </Typography>

      {/* Navigation Tabs and Actions */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', my: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Tabs value="day" aria-label="スケジュールビュー切り替え">
            <Tab
              label="週間"
              value="week"
              icon={<CalendarViewWeekRoundedIcon />}
              iconPosition="start"
              sx={{ textTransform: 'none' }}
              onClick={() => navigateToRoute('/schedules/week')}
            />
            <Tab
              label="月間"
              value="month"
              icon={<CalendarMonthRoundedIcon />}
              iconPosition="start"
              sx={{ textTransform: 'none' }}
              onClick={() => navigateToRoute('/schedules/month')}
            />
            <Tab
              label="日間"
              value="day"
              icon={<Box component="span">📅</Box>}
              iconPosition="start"
              sx={{ textTransform: 'none' }}
            />
          </Tabs>

          <Button
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={() => navigateToRoute('/schedules/create')}
            sx={{ ml: 2 }}
          >
            新規作成
          </Button>
        </Stack>
      </Box>

      <Stack direction="row" spacing={1} sx={{ my: 1 }}>
        <Button
          ref={prevButtonRef}
          data-testid={TESTIDS['schedules-prev']}
          onClick={(event) => {
            primeRouteFocusGuards();
            pendingFocusDirRef.current = -1;
            focusGuardUntilRef.current = Date.now() + resolveGuardDuration();
            navigate(-1);
            queueButtonRefocus(TESTIDS['schedules-prev'], 'click-prev', event.currentTarget);
          }}
          variant="outlined"
          aria-label="前の日へ"
          onBlur={handleButtonBlur}
        >
          前の日
        </Button>
        <Button
          ref={nextButtonRef}
          data-testid={TESTIDS['schedules-next']}
          onClick={(event) => {
            primeRouteFocusGuards();
            pendingFocusDirRef.current = 1;
            focusGuardUntilRef.current = Date.now() + resolveGuardDuration();
            navigate(1);
            queueButtonRefocus(TESTIDS['schedules-next'], 'click-next', event.currentTarget);
          }}
          variant="outlined"
          aria-label="次の日へ"
          onBlur={handleButtonBlur}
        >
          次の日
        </Button>
      </Stack>

      <Box component="section" role="region" aria-labelledby={DAY_HEADING_TEST_ID} sx={{ mt: 2 }}>
        {status === 'loading' && (
          <Stack data-testid="schedules-day-skeleton" aria-busy="true">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} height={48} />
            ))}
          </Stack>
        )}

        {status === 'ready' && (
          <Box
            data-testid="schedules-day-list"
            role="list"
            aria-label="日次予定一覧"
            sx={{ display: 'grid', gap: 8, my: 1 }}
          >
            {events.map((event) => {
              // Check for conflicts
              const conflicted = conflictIndex[event.id]?.length > 0;

              // Handle click - if conflicted, show guide dialog
              const handleClick = () => {
                if (conflicted) {
                  setGuideTargetId(String(event.id));
                  setGuideOpen(true);
                }
              };

              return (
                <Box
                  key={`${event.category}-${event.id}`}
                  role="listitem"
                  {...tid(
                    conflicted
                      ? TESTIDS['schedules-event-conflicted']
                      : TESTIDS['schedules-event-normal'],
                  )}
                  data-schedule-id={event.id}
                  onClick={conflicted ? handleClick : undefined}
                  sx={{
                    p: 1.25,
                    border: '1px solid #e5e7eb',
                    borderRadius: 2,
                    borderLeft: conflicted ? '4px solid #ef4444' : undefined,
                    backgroundColor: conflicted ? '#fef2f2' : undefined,
                    cursor: conflicted ? 'pointer' : 'default',
                    '&:hover': conflicted ? {
                      backgroundColor: '#fee2e2',
                    } : undefined,
                  }}
                  aria-label={`${event.title} ${dayjs(event.start).format('MM/DD HH:mm')} - ${dayjs(event.end).format('HH:mm')}`}
                >
                  <Typography variant="subtitle2">
                    {conflicted && '⚠️ '}
                    {event.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {dayjs(event.start).format('MM/DD HH:mm')} – {dayjs(event.end).format('HH:mm')}
                    {'　'}[{event.category}]
                    {conflicted && (
                      <Typography
                        component="span"
                        variant="caption"
                        sx={{ ml: 1, color: 'error.main' }}
                      >
                        重複あり
                      </Typography>
                    )}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        )}

        {status === 'empty' && (
          <Box
            data-testid="schedules-empty"
            role="status"
            aria-live="polite"
            sx={{ p: 2, color: 'text.secondary' }}
          >
            この日の予定はありません。
          </Box>
        )}

        {status === 'error' && (
          <Box role="alert" sx={{ p: 2, color: 'error.main' }}>
            予定の取得に失敗しました。時間をおいて再度お試しください。
          </Box>
        )}
      </Box>

      <ScheduleConflictGuideDialog
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        schedule={guideTargetBaseSchedule}
        conflicts={guideConflicts}
        onApplySuggestion={handleApplySuggestion}
      />
    </Container>
  );
}

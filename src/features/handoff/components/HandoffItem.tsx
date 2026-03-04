/**
 * 申し送り1件の表示コンポーネント
 *
 * TodayHandoffTimelineList から抽出。
 * - 個別の開閉・既読・ステータス変更ローカル状態
 * - コメント(返信)タブ / 更新履歴タブ
 * - 会議モード別ワークフローアクションボタン
 */

import { TESTIDS, tid } from '@/testids';
import {
    AccessTime as AccessTimeIcon,
    ChatBubbleOutline as ChatBubbleOutlineIcon,
    CheckCircle as CheckCircleIcon,
    ExpandLess as ExpandLessIcon,
    ExpandMore as ExpandMoreIcon,
    History as HistoryIcon,
    OpenInNew as OpenInNewIcon,
    RadioButtonUnchecked as RadioButtonUncheckedIcon,
} from '@mui/icons-material';
import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Stack,
    Tab,
    Tabs,
    Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DailyActivityNavState } from '../../cross-module/navigationState';
import { getSeverityColor } from '../handoffConstants';
import { getAllowedActions, getNextStatus, HANDOFF_STATUS_META } from '../handoffStateMachine';
import { loadSeenMap, saveSeenMap } from '../handoffStorageUtils';
import type { HandoffRecord, HandoffStatus, MeetingMode } from '../handoffTypes';
import type { WorkflowActions } from '../useHandoffTimelineViewModel';
import { HandoffAuditLogView } from './HandoffAuditLogView';
import { HandoffCommentThread } from './HandoffCommentThread';

// ────────────────────────────────────────────────────────────
// ユーティリティ
// ────────────────────────────────────────────────────────────

/** 時刻フォーマット（HH:MM） */
function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ────────────────────────────────────────────────────────────
// 型定義
// ────────────────────────────────────────────────────────────

export type HandoffItemProps = {
  item: HandoffRecord;
  onStatusChange: (id: number, status: HandoffRecord['status']) => Promise<void> | void;
  /** v3: 会議モード */
  meetingMode: MeetingMode;
  /** v3: ワークフローアクション */
  workflowActions?: WorkflowActions;
};

// ────────────────────────────────────────────────────────────
// コンポーネント
// ────────────────────────────────────────────────────────────

export const HandoffItem: React.FC<HandoffItemProps> = ({
  item,
  onStatusChange,
  meetingMode,
  workflowActions,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSeen, setIsSeen] = useState(() => {
    const map = loadSeenMap();
    return Boolean(map[String(item.id)]);
  });
  /** v4: 展開時の詳細タブ（0=返信, 1=更新履歴） */
  const [detailTab, setDetailTab] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const map = loadSeenMap();
    setIsSeen(Boolean(map[String(item.id)]));
  }, [item.id]);

  const handleStatusToggle = async () => {
    const newStatus = getNextStatus(item.status);

    try {
      await onStatusChange(item.id, newStatus);
    } catch (error) {
      console.error('[handoff] Status update failed:', error);
    }
  };

  const handleOpenDailyRecord = () => {
    if (!item.userCode || item.userCode === 'ALL') {
      return;
    }

    // createdAt から YYYY-MM-DD を抽出
    const highlightDate = item.createdAt ? item.createdAt.split('T')[0] : undefined;

    const navState: DailyActivityNavState = {
      highlightUserId: item.userCode,
      highlightDate,
    };

    navigate('/daily/activity', { state: navState });
  };

  const isLongMessage = item.message.length > 100;
  const displayMessage = expanded || !isLongMessage
    ? item.message
    : item.message.substring(0, 100) + '...';

  const markSeen = useCallback(() => {
    if (isSeen) return;
    const map = loadSeenMap();
    const key = String(item.id);
    if (!map[key]) {
      map[key] = new Date().toISOString();
      saveSeenMap(map);
    }
    setIsSeen(true);
  }, [isSeen, item.id]);

  const handleToggleExpand = () => {
    if (!expanded) {
      markSeen();
    }
    setExpanded((prev) => !prev);
  };

  return (
    <Card variant="outlined"
      sx={{
      borderLeft: item.severity === '重要' ? '4px solid' : '2px solid',
      borderLeftColor: item.severity === '重要' ? 'error.main' :
                      item.severity === '要注意' ? 'warning.main' : 'grey.300',
      bgcolor: isSeen ? 'background.paper' : 'warning.50',
      transition: 'background-color 0.2s ease',
      }}
      {...tid(TESTIDS['agenda-timeline-item'])}
    >
      <CardContent sx={{ pb: 1 }}>
        <Stack spacing={1}>
          {/* ヘッダー行：時刻・利用者・ラベル群 */}
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
              {formatTime(item.createdAt)}
            </Typography>

            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              {item.userDisplayName}
            </Typography>

            {!isSeen && (
              <Chip
                size="small"
                label="未確認"
                color="warning"
                variant="outlined"
              />
            )}

            <Chip
              size="small"
              label={item.category}
              color="primary"
              variant="outlined"
            />

            <Chip
              size="small"
              label={item.severity}
              color={getSeverityColor(item.severity)}
              variant={item.severity === '通常' ? 'outlined' : 'filled'}
            />

            <Chip
              size="small"
              label={item.timeBand}
              variant="outlined"
              color="secondary"
            />

            <Box sx={{ flexGrow: 1 }} />

            {/* 対応状況チップ（クリックで状態変更） */}
            <Chip
              size="small"
              label={HANDOFF_STATUS_META[item.status].label}
              color={HANDOFF_STATUS_META[item.status].color}
              variant={item.status === '対応済' ? 'filled' : 'outlined'}
              onClick={handleStatusToggle}
              clickable
              icon={
                item.status === '対応済' ? <CheckCircleIcon /> :
                item.status === '対応中' ? <AccessTimeIcon /> :
                <RadioButtonUncheckedIcon />
              }
            />
          </Stack>

          {/* 本文 */}
          <Box>
            <Typography
              variant="body2"
              sx={{
                whiteSpace: 'pre-wrap',
                lineHeight: 1.6,
                color: item.status === '対応済' ? 'text.secondary' : 'text.primary'
              }}
              onClick={!isLongMessage ? markSeen : undefined}
            >
              {displayMessage}
            </Typography>

            {/* 展開/折りたたみ */}
            {isLongMessage && (
              <Button
                size="small"
                onClick={handleToggleExpand}
                endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                sx={{ mt: 0.5, p: 0 }}
              >
                {expanded ? '折りたたむ' : '続きを読む'}
              </Button>
            )}
          </Box>

          {/* 作成者情報（小さく表示） */}
          <Typography variant="caption" color="text.secondary">
            記録者: {item.createdByName}
          </Typography>

          {/* v4: 展開時にコメント（返信）+ 更新履歴タブ */}
          {expanded && (
            <Box sx={{ mt: 1.5, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
              <Tabs
                value={detailTab}
                onChange={(_, v) => setDetailTab(v)}
                variant="fullWidth"
                sx={{
                  minHeight: 32,
                  '& .MuiTab-root': { minHeight: 32, py: 0.5, fontSize: '0.75rem' },
                }}
              >
                <Tab
                  icon={<ChatBubbleOutlineIcon sx={{ fontSize: 14 }} />}
                  iconPosition="start"
                  label="コメント"
                />
                <Tab
                  icon={<HistoryIcon sx={{ fontSize: 14 }} />}
                  iconPosition="start"
                  label="更新履歴"
                />
              </Tabs>
              <Box sx={{ pt: 1 }}>
                {detailTab === 0 && (
                  <HandoffCommentThread handoffId={item.id} />
                )}
                {detailTab === 1 && (
                  <HandoffAuditLogView handoffId={item.id} />
                )}
              </Box>
            </Box>
          )}

          {/* Phase 2-1: この利用者の記録を開くCTA */}
          {item.userCode && item.userCode !== 'ALL' && (
            <Box sx={{ mt: 1.5, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<OpenInNewIcon />}
                onClick={handleOpenDailyRecord}
                data-testid="handoff-open-daily-highlight"
                fullWidth
                sx={{ justifyContent: 'flex-start' }}
              >
                この利用者の記録を開く
              </Button>
            </Box>
          )}

          {/* v3: モード別アクションボタン */}
          {meetingMode !== 'normal' && workflowActions && (() => {
            const allowed = getAllowedActions(item.status, meetingMode);
            if (allowed.length === 0) return null;

            const ACTION_META: Record<string, { label: string; emoji: string; color: 'primary' | 'warning' | 'success' }> = {
              '確認済': { label: '確認済', emoji: '✅', color: 'primary' },
              '明日へ持越': { label: '明日へ', emoji: '📅', color: 'warning' },
              '完了': { label: '完了', emoji: '🔒', color: 'success' },
              '対応済': { label: '完了', emoji: '✅', color: 'success' },
            };

            const handleAction = async (targetStatus: HandoffStatus) => {
              if (isSaving) return;
              setIsSaving(true);
              try {
                if (targetStatus === '確認済') await workflowActions.markReviewed(item.id);
                else if (targetStatus === '明日へ持越') await workflowActions.markCarryOver(item.id);
                else if (targetStatus === '完了' || targetStatus === '対応済') await workflowActions.markClosed(item.id);
              } finally {
                setIsSaving(false);
              }
            };

            return (
              <Box sx={{ mt: 1.5, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                <Stack direction="row" spacing={2} sx={{ gap: 2 }}>
                  {allowed.map((targetStatus) => {
                    const meta = ACTION_META[targetStatus];
                    if (!meta) return null;
                    return (
                      <Button
                        key={targetStatus}
                        size="small"
                        variant="outlined"
                        color={meta.color}
                        disabled={isSaving}
                        onClick={() => handleAction(targetStatus)}
                        aria-label={`${meta.label}: ${item.title}`}
                        sx={{ minWidth: 44, minHeight: 44 }}
                      >
                        {meta.emoji} {meta.label}
                      </Button>
                    );
                  })}
                </Stack>
              </Box>
            );
          })()}
        </Stack>
      </CardContent>
    </Card>
  );
};

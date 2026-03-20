/**
 * 申し送り1件の表示コンポーネント（v6: コンポーネント分割版）
 *
 * Phase 2 (B-1): HandoffItem → サブコンポーネント分割
 * - HandoffItemHeader: 時刻 + 利用者 + ステータスバッジ
 * - HandoffItemTags: カテゴリ + 重要度 + 時間帯タグ行
 * - HandoffWorkflowActions: 会議モード別アクションボタン
 *
 * このファイルはオーケストレーター兼レイアウトコンポーネント。
 */

import { motionTokens } from '@/app/theme';
import { TESTIDS, tid } from '@/testids';
import {
    ChatBubbleOutline as ChatBubbleOutlineIcon,
    ExpandLess as ExpandLessIcon,
    ExpandMore as ExpandMoreIcon,
    History as HistoryIcon,
    OpenInNew as OpenInNewIcon,
    PersonAdd as PersonAddIcon,
} from '@mui/icons-material';
import {
    Box,
    Button,
    Card,
    CardContent,
    Collapse,
    Stack,
    Tab,
    Tabs,
    Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DailyActivityNavState } from '../../cross-module/navigationState';
import { getNextStatus } from '../handoffStateMachine';
import { loadSeenMap, saveSeenMap } from '../handoffStorageUtils';
import type { HandoffRecord, MeetingMode } from '../handoffTypes';
import type { WorkflowActions } from '../useHandoffTimelineViewModel';
import { HandoffAuditLogView } from './HandoffAuditLogView';
import { HandoffCommentThread } from './HandoffCommentThread';
import { HandoffItemHeader } from './HandoffItemHeader';
import { HandoffItemTags } from './HandoffItemTags';
import { HandoffWorkflowActions } from './HandoffWorkflowActions';

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
  /** Phase 8-A: 利用者状態登録コールバック */
  onRegisterStatus?: (handoff: HandoffRecord) => void;
};

// ────────────────────────────────────────────────────────────
// 重要度スタイル計算（Pure）
// ────────────────────────────────────────────────────────────

function computeSeverityStyle(severity: string, isCompleted: boolean) {
  switch (severity) {
    case '重要':
      return {
        borderLeftWidth: 5,
        borderLeftColor: isCompleted ? 'grey.300' : 'error.main',
        bgTint: isCompleted ? undefined : 'rgba(211, 47, 47, 0.04)',
        glowColor: isCompleted ? undefined : 'rgba(211, 47, 47, 0.08)',
      };
    case '要注意':
      return {
        borderLeftWidth: 4,
        borderLeftColor: isCompleted ? 'grey.300' : 'warning.main',
        bgTint: isCompleted ? undefined : 'rgba(237, 108, 2, 0.03)',
        glowColor: undefined,
      };
    default:
      return {
        borderLeftWidth: 3,
        borderLeftColor: isCompleted ? 'grey.300' : 'grey.400',
        bgTint: undefined,
        glowColor: undefined,
      };
  }
}

// ────────────────────────────────────────────────────────────
// コンポーネント
// ────────────────────────────────────────────────────────────

export const HandoffItem: React.FC<HandoffItemProps> = ({
  item,
  onStatusChange,
  meetingMode,
  workflowActions,
  onRegisterStatus,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [statusPulse, setStatusPulse] = useState(false);
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

  const isCompleted = item.status === '対応済' || item.status === '完了';

  const handleStatusToggle = async () => {
    const newStatus = getNextStatus(item.status);
    try {
      setStatusPulse(true);
      await onStatusChange(item.id, newStatus);
      setTimeout(() => setStatusPulse(false), 600);
    } catch {
      setStatusPulse(false);
    }
  };

  const handleOpenDailyRecord = () => {
    if (!item.userCode || item.userCode === 'ALL') return;
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
    if (!expanded) markSeen();
    setExpanded((prev) => !prev);
  };

  const severityStyle = computeSeverityStyle(item.severity, isCompleted);

  return (
    <Card
      variant="outlined"
      sx={{
        borderLeft: `${severityStyle.borderLeftWidth}px solid`,
        borderLeftColor: severityStyle.borderLeftColor,
        opacity: isCompleted ? 0.65 : 1,
        bgcolor: isSeen
          ? (severityStyle.bgTint || 'background.paper')
          : 'action.hover',
        ...(severityStyle.glowColor && !isCompleted && {
          boxShadow: `inset 4px 0 8px -4px ${severityStyle.glowColor}, 0 1px 3px rgba(0,0,0,0.04)`,
        }),
        transition: motionTokens.transition.cardInteractive,
        ...(statusPulse && {
          boxShadow: (theme) =>
            `0 0 0 2px ${theme.palette.primary.main}40`,
        }),
        '&:hover': {
          bgcolor: isCompleted
            ? 'background.paper'
            : (severityStyle.bgTint || 'action.hover'),
          ...(item.severity === '重要' && !isCompleted && {
            boxShadow: `inset 5px 0 12px -4px rgba(211, 47, 47, 0.12), 0 2px 6px rgba(0,0,0,0.06)`,
          }),
        },
      }}
      {...tid(TESTIDS['agenda-timeline-item'])}
    >
      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
        <Stack spacing={0.75}>

          {/* ── ROW 1: ヘッダー ── */}
          <HandoffItemHeader
            createdAt={item.createdAt}
            userDisplayName={item.userDisplayName}
            status={item.status}
            isCompleted={isCompleted}
            isSeen={isSeen}
            onStatusToggle={handleStatusToggle}
          />

          {/* ── ROW 2: タグ行 ── */}
          <HandoffItemTags
            category={item.category}
            severity={item.severity}
            timeBand={item.timeBand}
            createdByName={item.createdByName}
          />

          {/* ── ROW 3: 本文 ── */}
          <Box sx={{ pt: 0.25 }}>
            <Typography
              variant="body2"
              sx={{
                whiteSpace: 'pre-wrap',
                lineHeight: 1.6,
                fontSize: '0.825rem',
                color: isCompleted ? 'text.disabled' : 'text.primary',
                ...(isCompleted && {
                  textDecoration: 'line-through',
                  textDecorationColor: 'rgba(0,0,0,0.2)',
                }),
              }}
              onClick={!isLongMessage ? markSeen : undefined}
            >
              {displayMessage}
            </Typography>

            {/* 長文の展開/折りたたみ */}
            {isLongMessage && (
              <Button
                size="small"
                onClick={() => {
                  setExpanded((prev) => !prev);
                  if (!expanded) markSeen();
                }}
                endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                sx={{
                  mt: 0.25,
                  p: 0,
                  fontSize: '0.75rem',
                  color: 'text.secondary',
                  textTransform: 'none',
                }}
              >
                {expanded ? '折りたたむ' : '続きを読む'}
              </Button>
            )}
          </Box>

          {/* ── コメント・詳細展開ボタン ── */}
          <Button
            size="small"
            onClick={handleToggleExpand}
            startIcon={<ChatBubbleOutlineIcon sx={{ fontSize: 14 }} />}
            endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{
              mt: 0.5,
              p: 0,
              fontSize: '0.72rem',
              color: 'text.secondary',
              textTransform: 'none',
              justifyContent: 'flex-start',
              '&:hover': { color: 'primary.main' },
            }}
          >
            {expanded ? '閉じる' : '💬 コメント · 詳細'}
          </Button>

          {/* ── 展開時: コメント + 更新履歴タブ ── */}
          <Collapse in={expanded} timeout={250}>
            <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
              <Tabs
                value={detailTab}
                onChange={(_, v) => setDetailTab(v)}
                variant="fullWidth"
                sx={{
                  minHeight: 32,
                  '& .MuiTab-root': { minHeight: 32, py: 0.5, fontSize: '0.72rem' },
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
          </Collapse>

          {/* この利用者の記録を開くCTA + 状態登録 */}
          {item.userCode && item.userCode !== 'ALL' && (
            <Box sx={{ mt: 1, pt: 0.75, borderTop: '1px solid', borderColor: 'divider', display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button
                size="small"
                variant="text"
                startIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                onClick={handleOpenDailyRecord}
                data-testid="handoff-open-daily-highlight"
                sx={{
                  justifyContent: 'flex-start',
                  fontSize: '0.72rem',
                  color: 'text.secondary',
                  textTransform: 'none',
                  py: 0.25,
                  '&:hover': { color: 'primary.main' },
                }}
              >
                この利用者の記録を開く
              </Button>
              {onRegisterStatus && !isCompleted && (
                <Button
                  size="small"
                  variant="text"
                  startIcon={<PersonAddIcon sx={{ fontSize: 14 }} />}
                  onClick={() => onRegisterStatus(item)}
                  data-testid="handoff-register-status"
                  sx={{
                    justifyContent: 'flex-start',
                    fontSize: '0.72rem',
                    color: 'warning.main',
                    textTransform: 'none',
                    py: 0.25,
                    '&:hover': { color: 'warning.dark' },
                  }}
                >
                  状態を登録
                </Button>
              )}
            </Box>
          )}

          {/* ── ワークフローアクション ── */}
          {workflowActions && (
            <HandoffWorkflowActions
              handoffId={item.id}
              title={item.title}
              status={item.status}
              meetingMode={meetingMode}
              workflowActions={workflowActions}
            />
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

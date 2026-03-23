/**
 * HandoffPanel — 今日の申し送り一覧 + 新規追加
 *
 * P1-2: 閲覧導線の意味復元
 * - 作成時に入力された category / target / timeBand / status を一覧でも即読める形で表示
 * - status 遷移を handoffStateMachine 準拠で提供
 * - 「今どれが未対応で、何を先に見るべきか」を数秒で把握できるUIに
 *
 * @see HandoffQuickNoteCard — 入力UI（FooterQuickActions 経由で共有）
 * @see handoffStateMachine.ts — getAllowedActions / HANDOFF_STATUS_META
 */
import React, { useMemo } from 'react';
import { Box, Typography, Button, Stack, Chip, Card, CardContent } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useHandoffTimeline } from '../useHandoffTimeline';
import { getSeverityColor, CATEGORY_EMOJI, timeBandToMeetingMode } from '../handoffConstants';
import { getAllowedActions, HANDOFF_STATUS_META } from '../handoffStateMachine';
import { useCurrentTimeBand } from '../useCurrentTimeBand';
import type { HandoffStatus } from '../handoffTypes';

export type HandoffPanelProps = {
  /** YYYY-MM-DD */
  targetDate: string;
};

/** 空状態の時間帯別メッセージ */
const EMPTY_MESSAGES: Record<string, string> = {
  '朝': '昨日からの引き継ぎはありません。良い一日を！',
  '午前': 'まだ申し送りがありません。気になることがあれば追加してみましょう。',
  '午後': 'まだ申し送りがありません。気になることがあれば追加してみましょう。',
  '夕方': 'お疲れさまでした。明日への引き継ぎがあれば追加してください。',
};

export const HandoffPanel: React.FC<HandoffPanelProps> = ({ targetDate: _targetDate }) => {
  const { todayHandoffs, loading, updateHandoffStatus } = useHandoffTimeline();
  const currentTimeBand = useCurrentTimeBand();

  // ── 導出値 ──
  const unreadCount = useMemo(
    () => todayHandoffs.filter(h => h.status === '未対応').length,
    [todayHandoffs],
  );
  const meetingMode = useMemo(
    () => timeBandToMeetingMode(currentTimeBand),
    [currentTimeBand],
  );

  const handleOpenQuickNote = () => {
    window.dispatchEvent(new Event('handoff-open-quicknote-dialog'));
  };

  const handleStatusChange = async (id: number, newStatus: HandoffStatus) => {
    await updateHandoffStatus(id, newStatus);
  };

  return (
    <Box>
      {/* ── ヘッダー (AC-7: 件数サマリー) ── */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="subtitle1" fontWeight="bold">
          今日の申し送り
          {!loading && todayHandoffs.length > 0 && (
            <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
              （{todayHandoffs.length}件
              {unreadCount > 0 && ` / 未対応${unreadCount}件`}）
            </Typography>
          )}
        </Typography>
        <Button
          variant="outlined"
          color="primary"
          size="small"
          startIcon={<AddIcon />}
          onClick={handleOpenQuickNote}
          data-testid="handoff-panel-add-button"
        >
          申し送り追加
        </Button>
      </Stack>
      
      <Stack spacing={2}>
        {/* ── 空状態 (AC-6: 時間帯対応) ── */}
        {!loading && todayHandoffs.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            {EMPTY_MESSAGES[currentTimeBand] ?? 'まだ申し送りがありません。'}
          </Typography>
        )}

        {todayHandoffs.map((h) => {
          const statusMeta = HANDOFF_STATUS_META[h.status];
          const isNew = h.status === '未対応';
          const isUrgent = h.severity === '重要' || h.severity === '要注意';
          const actions = getAllowedActions(h.status, meetingMode);

          return (
            <Card
              key={h.id}
              variant="outlined"
              sx={{
                bgcolor: isNew ? (isUrgent ? 'error.50' : 'info.50') : 'background.paper',
                borderLeft: isNew ? 4 : 1,
                borderColor: isNew ? (isUrgent ? 'error.main' : 'info.main') : 'divider',
              }}
            >
              <CardContent sx={{ pb: '16px !important' }}>
                <Stack direction="row" spacing={1} mb={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  {/* ステータス (AC-3: meta 準拠) */}
                  <Chip
                    label={`${statusMeta.icon} ${statusMeta.label}`}
                    size="small"
                    color={statusMeta.color}
                    variant={isNew ? 'filled' : 'outlined'}
                    sx={isNew ? {} : { opacity: 0.7 }}
                  />
                  {/* 重要度 (AC-2: 既実装) */}
                  <Chip
                    label={h.severity}
                    size="small"
                    color={getSeverityColor(h.severity) as 'default' | 'warning' | 'error'}
                  />
                  {/* カテゴリ (AC-1: 絵文字つき) */}
                  <Chip
                    label={`${CATEGORY_EMOJI[h.category] ?? ''} ${h.category}`}
                    size="small"
                    variant="outlined"
                  />
                  {/* 対象者 (AC-4: 全体向け統一) */}
                  <Typography variant="body2" fontWeight="bold">
                    {h.userCode === 'ALL'
                      ? '🌟 全体向け'
                      : h.userDisplayName || '(対象未設定)'}
                  </Typography>
                  {/* 記録者 */}
                  <Typography variant="caption" color="text.secondary">
                    {h.createdByName}
                  </Typography>
                  {/* 時間帯 (AC-5: Chip化) */}
                  <Chip
                    label={`⏰ ${h.timeBand}`}
                    size="small"
                    variant="outlined"
                    sx={{ height: 20, fontSize: '0.65rem' }}
                  />
                </Stack>

                <Typography
                  variant="body2"
                  sx={{
                    whiteSpace: 'pre-wrap',
                    display: '-webkit-box',
                    WebkitLineClamp: isNew ? undefined : 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {h.message}
                </Typography>

                {/* ── ステータス遷移ボタン (AC-3: state machine 準拠) ── */}
                {actions.length > 0 && (
                  <Box mt={1.5} textAlign="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end" useFlexGap flexWrap="wrap">
                      {actions.map(nextStatus => {
                        const nextMeta = HANDOFF_STATUS_META[nextStatus];
                        return (
                          <Button
                            key={nextStatus}
                            size="small"
                            variant="text"
                            onClick={() => handleStatusChange(h.id, nextStatus)}
                          >
                            {nextMeta.icon} {nextMeta.label}にする
                          </Button>
                        );
                      })}
                    </Stack>
                  </Box>
                )}
              </CardContent>
            </Card>
          );
        })}
      </Stack>
    </Box>
  );
};


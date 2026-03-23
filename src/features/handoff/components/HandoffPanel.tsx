/**
 * HandoffPanel — 今日の申し送り一覧 + 新規追加
 *
 * P0 修正: データ系統を統一
 * - useHandoff (旧・audit log なし) → useHandoffTimeline (新・audit log あり)
 * - HandoffComposerDialog (旧モーダル) → グローバル QuickNote Dialog に統一
 * - 表示を HandoffRecord 型 (category/severity/timeBand) に対応
 *
 * @see HandoffQuickNoteCard — 実際の入力UI（FooterQuickActions 経由で共有）
 */
import React from 'react';
import { Box, Typography, Button, Stack, Chip, Card, CardContent } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useHandoffTimeline } from '../useHandoffTimeline';
import { getSeverityColor } from '../handoffConstants';

export type HandoffPanelProps = {
  /** YYYY-MM-DD */
  targetDate: string;
};

export const HandoffPanel: React.FC<HandoffPanelProps> = ({ targetDate: _targetDate }) => {
  const { todayHandoffs, loading, updateHandoffStatus } = useHandoffTimeline();

  /**
   * P0 修正: 旧 HandoffComposerDialog の代わりに
   * グローバル QuickNote Dialog を開く（FooterQuickActions がリッスン）
   *
   * これにより:
   * - データは常に NewHandoffInput (新系) 経由で保存
   * - audit log が自動記録される
   * - カテゴリ・重要度・対象ユーザー選択が統一
   */
  const handleOpenQuickNote = () => {
    window.dispatchEvent(new Event('handoff-open-quicknote-dialog'));
  };

  const handleStatusChange = async (id: number, newStatus: '対応中' | '対応済' | '確認済') => {
    await updateHandoffStatus(id, newStatus);
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="subtitle1" fontWeight="bold">
          今日の申し送り
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
        {!loading && todayHandoffs.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            本日の申し送りはありません。
            <br />
            「申し送り追加」から気軽に登録してみてください。
          </Typography>
        )}
        {todayHandoffs.map((h) => {
          const isNew = h.status === '未対応';
          const isUrgent = h.severity === '重要' || h.severity === '要注意';

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
                <Stack direction="row" spacing={1} mb={1} alignItems="center" flexWrap="wrap">
                  {/* ステータス */}
                  <Chip
                    label={h.status}
                    size="small"
                    color={isNew ? 'primary' : 'default'}
                    variant={isNew ? 'filled' : 'outlined'}
                    sx={isNew ? {} : { opacity: 0.7 }}
                  />
                  {/* 重要度 */}
                  <Chip
                    label={h.severity}
                    size="small"
                    color={getSeverityColor(h.severity) as 'default' | 'warning' | 'error'}
                  />
                  {/* カテゴリ */}
                  <Chip label={h.category} size="small" variant="outlined" />
                  {/* 対象者 */}
                  <Typography variant="body2" fontWeight="bold">
                    {h.userDisplayName || '全体共有'}
                  </Typography>
                  {/* 記録者 + 時間帯 */}
                  <Typography variant="caption" color="text.secondary">
                    {h.createdByName} · {h.timeBand}
                  </Typography>
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
                {isNew && (
                  <Box mt={2} textAlign="right">
                    <Button
                      size="small"
                      variant="text"
                      onClick={() => handleStatusChange(h.id, '確認済')}
                    >
                      確認済みにする
                    </Button>
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

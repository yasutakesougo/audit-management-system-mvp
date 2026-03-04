/**
 * 申し送り更新履歴（監査ログ）表示コンポーネント
 *
 * 申し送り1件の変更履歴をタイムライン形式で表示。
 * TodayHandoffTimelineList の展開エリアに埋め込んで使用。
 */

import {
    History as HistoryIcon,
} from '@mui/icons-material';
import {
    Box,
    Chip,
    CircularProgress,
    Stack,
    Typography,
} from '@mui/material';
import React, { useEffect } from 'react';
import { useHandoffAuditLog } from '../handoffAuditApi';
import { AUDIT_ACTION_META, formatAuditDescription } from '../handoffAuditTypes';

// ────────────────────────────────────────────────────────────
// 更新履歴表示
// ────────────────────────────────────────────────────────────

type HandoffAuditLogViewProps = {
  handoffId: number;
};

/**
 * 申し送り更新履歴タイムライン
 */
export const HandoffAuditLogView: React.FC<HandoffAuditLogViewProps> = ({
  handoffId,
}) => {
  const { logs, loading, error, loadLogs } = useHandoffAuditLog(handoffId);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const formatTime = (iso: string): string => {
    const d = new Date(iso);
    return d.toLocaleString('ja-JP', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Box sx={{ mt: 1 }}>
      {/* ヘッダー */}
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1 }}>
        <HistoryIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
          更新履歴
        </Typography>
        {logs.length > 0 && (
          <Chip
            size="small"
            label={`${logs.length}件`}
            sx={{ fontSize: '0.65rem', height: 18 }}
          />
        )}
      </Stack>

      {/* ローディング */}
      {loading && (
        <Stack alignItems="center" sx={{ py: 1 }}>
          <CircularProgress size={20} />
        </Stack>
      )}

      {/* エラー */}
      {error && (
        <Typography variant="caption" color="error" sx={{ display: 'block', mb: 1 }}>
          ⚠️ {error}
        </Typography>
      )}

      {/* 履歴一覧 */}
      {logs.length === 0 && !loading && (
        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
          更新履歴はありません
        </Typography>
      )}

      {logs.length > 0 && (
        <Stack spacing={0.75}>
          {logs.map(log => {
            const meta = AUDIT_ACTION_META[log.action] ?? { label: '操作', icon: '📋' };
            return (
              <Box
                key={log.id}
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1,
                  pl: 0.5,
                }}
              >
                {/* タイムラインドット */}
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: log.action === 'status_changed' ? 'primary.main'
                      : log.action === 'comment_added' ? 'info.main'
                      : log.action === 'created' ? 'success.main'
                      : 'grey.400',
                    flexShrink: 0,
                    mt: 0.75,
                  }}
                />

                {/* 内容 */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" alignItems="center" spacing={0.5} flexWrap="wrap" useFlexGap>
                    <Typography variant="caption" color="text.secondary">
                      {formatTime(log.changedAt)}
                    </Typography>
                    <Typography variant="caption" sx={{ fontWeight: 500 }}>
                      {meta.icon} {formatAuditDescription(log)}
                    </Typography>
                  </Stack>

                  {/* ステータス変更の場合は旧→新を表示 */}
                  {log.action === 'status_changed' && log.oldValue && log.newValue && (
                    <Stack direction="row" spacing={0.5} sx={{ mt: 0.25 }}>
                      <Chip
                        size="small"
                        label={log.oldValue}
                        variant="outlined"
                        sx={{ fontSize: '0.65rem', height: 18, textDecoration: 'line-through' }}
                      />
                      <Typography variant="caption" color="text.secondary">→</Typography>
                      <Chip
                        size="small"
                        label={log.newValue}
                        color="primary"
                        variant="filled"
                        sx={{ fontSize: '0.65rem', height: 18 }}
                      />
                    </Stack>
                  )}
                </Box>
              </Box>
            );
          })}
        </Stack>
      )}
    </Box>
  );
};

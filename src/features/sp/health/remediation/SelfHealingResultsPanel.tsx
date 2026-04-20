import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Divider,
  Chip,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ShieldIcon from '@mui/icons-material/Shield';
import { useSelfHealingResults } from '../hooks/useSelfHealingResults';
import { useSelfHealingHistory } from '../hooks/useSelfHealingHistory';
import AssignmentIcon from '@mui/icons-material/Assignment';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';

/**
 * SelfHealingResultsPanel
 * 
 * Nightly Patrol による自動修復（Self-Healing）の結果を表示するパネル。
 * 最新の実行結果と、履歴から算出された推奨アクションを表示します。
 */
export const SelfHealingResultsPanel: React.FC = () => {
  const { results, loading: latestLoading, error: latestError, hasReport } = useSelfHealingResults();
  const { actions, loading: historyLoading } = useSelfHealingHistory(10);

  const loading = latestLoading || historyLoading;
  const error = latestError;

  if (loading && !hasReport) {
    return (
      <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
        <CircularProgress size={24} sx={{ mb: 1 }} />
        <Typography variant="body2" color="text.secondary">
          自動修復ログを読み込み中...
        </Typography>
      </Paper>
    );
  }

  if (error) {
    return (
      <Paper variant="outlined" sx={{ p: 2, borderColor: 'error.light', bgcolor: 'error.50' }}>
        <Typography variant="body2" color="error">
          ⚠️ 自動修復ログの取得に失敗しました: {error}
        </Typography>
      </Paper>
    );
  }

  if (!hasReport) {
    return (
      <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50', borderStyle: 'dashed' }}>
        <Typography variant="caption" color="text.secondary">
          🌙 Nightly Patrol の実行結果がまだありません（初回実行待ち）
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        borderRadius: 2,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: results.length > 0 ? 'success.light' : 'divider',
        position: 'relative',
        overflow: 'hidden',
        '&::before': results.length > 0 ? {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          width: '4px',
          height: '100%',
          bgcolor: 'success.main',
        } : {}
      }}
    >
      <Stack spacing={2}>
        {/* Latest Results Section */}
        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box sx={{ p: 1, borderRadius: 1, bgcolor: results.length > 0 ? 'success.50' : 'grey.50', color: results.length > 0 ? 'success.main' : 'text.disabled', display: 'flex' }}>
                <AutoFixHighIcon fontSize="small" />
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                  ✨ Self-Healing Results (最新の自動修復)
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Nightly Patrol がバックグラウンドで解決した環境課題
                </Typography>
              </Box>
            </Stack>
            {results.length > 0 ? (
              <Chip label={`${results.length} 件実行済`} size="small" color="success" variant="outlined" sx={{ fontWeight: 700, height: 20, fontSize: '0.65rem' }} />
            ) : (
              <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>健全な状態</Typography>
            )}
          </Stack>

          {results.length > 0 ? (
            <List disablePadding sx={{ maxHeight: '200px', overflow: 'auto' }}>
              {results.map((res, idx) => (
                <ListItem key={idx} disablePadding sx={{ py: 1, borderBottom: idx < results.length - 1 ? '1px dashed' : 'none', borderColor: 'divider' }}>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    {res.outcome === 'added' ? (
                      <CheckCircleOutlineIcon color="success" fontSize="small" />
                    ) : res.outcome === 'skipped_limit' ? (
                      <ShieldIcon color="info" fontSize="small" />
                    ) : (
                      <ErrorOutlineIcon color="error" fontSize="small" />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          [{res.resourceKey}] {res.fieldKey ? `(Field: ${res.fieldKey})` : ''}
                        </Typography>
                        <Chip 
                          label={res.outcome === 'added' ? '修復成功' : res.outcome === 'skipped_limit' ? '安全スキップ' : '修復失敗'}
                          size="small"
                          sx={{ 
                            height: 18, fontSize: '0.6rem', fontWeight: 700, borderRadius: 0.5,
                            bgcolor: res.outcome === 'added' ? 'success.50' : res.outcome === 'skipped_limit' ? 'info.50' : 'error.50',
                            color: res.outcome === 'added' ? 'success.main' : res.outcome === 'skipped_limit' ? 'info.main' : 'error.main',
                          }}
                        />
                      </Stack>
                    }
                    secondary={<Typography variant="caption" color="text.secondary">{res.message}</Typography>}
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', py: 1, pl: 6 }}>
              修復が必要な項目はありませんでした
            </Typography>
          )}
        </Box>

        {/* Recommended Actions Section (Insight Layer) */}
        {actions.length > 0 && (
          <Box sx={{ mt: 1 }}>
            <Divider sx={{ mb: 2 }} />
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
              <Box sx={{ p: 1, borderRadius: 1, bgcolor: 'warning.50', color: 'warning.main', display: 'flex' }}>
                <AssignmentIcon fontSize="small" />
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                  🚨 Recommended Actions (推奨される対応)
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  履歴の傾向から算出された、管理者による確認推奨事項
                </Typography>
              </Box>
            </Stack>
            
            <Stack spacing={1}>
              {actions.slice(0, 3).map((action) => (
                <Box 
                  key={action.id}
                  sx={{ 
                    p: 1.5, 
                    borderRadius: 1.5, 
                    border: '1px solid',
                    borderColor: action.level === 'escalation' ? 'error.light' : action.level === 'recommendation' ? 'warning.light' : 'info.light',
                    bgcolor: action.level === 'escalation' ? 'error.50' : action.level === 'recommendation' ? 'warning.50' : 'info.50',
                  }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="flex-start">
                    <Box sx={{ mt: 0.25 }}>
                      {action.level === 'escalation' ? <ErrorOutlineIcon color="error" fontSize="small" /> : 
                       action.level === 'recommendation' ? <WarningIcon color="warning" fontSize="small" /> : 
                       <InfoIcon color="info" fontSize="small" />}
                    </Box>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                        {action.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.4 }}>
                        {action.description}
                        <Box component="span" sx={{ display: 'block', mt: 0.5, fontWeight: 600, color: 'text.primary' }}>
                          対象: {action.resourceKey} {action.fieldKey ? `(Field: ${action.fieldKey})` : ''}
                        </Box>
                      </Typography>
                    </Box>
                  </Stack>
                </Box>
              ))}
            </Stack>
          </Box>
        )}

        <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'right', fontStyle: 'italic', display: 'block', pt: 1 }}>
          ※ インデックス不足などは Nightly Patrol で自動修復されます
        </Typography>
      </Stack>
    </Paper>
  );
};

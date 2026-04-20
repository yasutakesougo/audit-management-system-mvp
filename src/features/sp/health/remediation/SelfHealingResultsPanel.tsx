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

/**
 * SelfHealingResultsPanel
 * 
 * Nightly Patrol による自動修復（Self-Healing）の結果を表示するパネル。
 * 最新の Diagnostics_Reports から情報を取得します。
 */
export const SelfHealingResultsPanel: React.FC = () => {
  const { results, loading, error, hasReport } = useSelfHealingResults();

  if (loading) {
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

  if (results.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 2, bgcolor: 'success.50', borderColor: 'success.light' }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <CheckCircleOutlineIcon color="success" fontSize="small" />
          <Typography variant="caption" color="success.main" sx={{ fontWeight: 600 }}>
            昨夜の自動修復: 健全な状態です（修復が必要な項目はありませんでした）
          </Typography>
        </Stack>
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
        borderColor: 'success.light',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          width: '4px',
          height: '100%',
          bgcolor: 'success.main',
        }
      }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                p: 1,
                borderRadius: 1,
                bgcolor: 'success.50',
                color: 'success.main',
                display: 'flex',
              }}
            >
              <AutoFixHighIcon fontSize="small" />
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'text.primary' }}>
                ✨ Self-Healing Results (直近の自動修復)
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Nightly Patrol がバックグラウンドで解決した環境課題
              </Typography>
            </Box>
          </Stack>
          <Chip 
            label={`${results.length} 件実行済`} 
            size="small" 
            color="success" 
            variant="outlined" 
            sx={{ fontWeight: 700, height: 20, fontSize: '0.65rem' }} 
          />
        </Stack>

        <Divider />

        <List disablePadding sx={{ maxHeight: '240px', overflow: 'auto' }}>
          {results.map((res, idx) => (
            <ListItem 
              key={idx} 
              disablePadding 
              sx={{ 
                py: 1, 
                borderBottom: idx < results.length - 1 ? '1px dashed' : 'none',
                borderColor: 'divider'
              }}
            >
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
                      label={
                        res.outcome === 'added' ? '修復成功' : 
                        res.outcome === 'skipped_limit' ? '安全スキップ' : '修復失敗'
                      }
                      size="small"
                      sx={{ 
                        height: 18, 
                        fontSize: '0.6rem', 
                        bgcolor: res.outcome === 'added' ? 'success.50' : res.outcome === 'skipped_limit' ? 'info.50' : 'error.50',
                        color: res.outcome === 'added' ? 'success.main' : res.outcome === 'skipped_limit' ? 'info.main' : 'error.main',
                        borderRadius: 1,
                        fontWeight: 700
                      }}
                    />
                  </Stack>
                }
                secondary={
                  <Typography variant="caption" color="text.secondary">
                    {res.message} — {new Date(res.occurredAt).toLocaleString()}
                  </Typography>
                }
              />
            </ListItem>
          ))}
        </List>

        <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'right', fontStyle: 'italic' }}>
          ※ インデックス不足などは Nightly Patrol で自動的にガードレール修復されます
        </Typography>
      </Stack>
    </Paper>
  );
};

import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import SyncIcon from '@mui/icons-material/Sync';
import SyncDisabledIcon from '@mui/icons-material/SyncDisabled';
import {
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    List,
    ListItem,
    ListItemText,
    Paper,
    Stack,
    Tooltip,
    Typography,
} from '@mui/material';
import React from 'react';

export type LaneState = 'disabled' | 'idle' | 'active' | 'error';

export interface SpLaneModel {
  version: number;
  state: LaneState;
  title: string;
  subtitle?: string;
  lastSyncAt?: string;
  itemCount?: number;
  reason?: string;
  source?: string;
  busy?: boolean;
  onRetry?: () => void;
  canRetry?: boolean;
  details?: {
    state: LaneState;
    source?: string;
    lastSyncAt?: string;
    itemCount?: number;
    error?: string;
    reason?: string;
  };
}

export interface SchedulesSpLaneProps {
  model: SpLaneModel;
}

/**
 * SchedulesSpLane Component
 *
 * A constant structural element for the SharePoint (SP) lane.
 * Now enhanced as a "Monitoring Hub" with Retry and Status transparency.
 */
export const SchedulesSpLane: React.FC<SchedulesSpLaneProps> = ({ model }) => {
  const {
    state,
    title,
    subtitle,
    lastSyncAt,
    itemCount,
    reason,
    source,
    busy,
    onRetry,
    canRetry,
    details,
  } = model;

  const [detailsOpen, setDetailsOpen] = React.useState(false);

  const renderContent = () => {
    switch (state) {
      case 'disabled':
        return (
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              py: 4,
              opacity: 0.6,
              backgroundColor: 'rgba(0,0,0,0.02)',
              borderRadius: 1,
              border: '1px dashed rgba(0,0,0,0.1)',
            }}
          >
            <SyncDisabledIcon sx={{ fontSize: 32, mb: 1, color: 'text.disabled' }} />
            <Typography variant="body2" color="text.secondary" fontWeight={500}>
              連携オフ
            </Typography>
            {reason && (
              <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5 }}>
                {reason}
              </Typography>
            )}
          </Box>
        );

      case 'idle':
        return (
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              py: 4,
            }}
          >
            <CircularProgress size={24} sx={{ mb: 2 }} />
            <Typography variant="body2" color="text.secondary">
              接続待機中...
            </Typography>
          </Box>
        );

      case 'error':
        return (
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              py: 4,
              backgroundColor: 'error.lighter',
              color: 'error.main',
              borderRadius: 1,
            }}
          >
            <ErrorOutlineIcon sx={{ fontSize: 32, mb: 1 }} />
            <Typography variant="body2" fontWeight={500}>
              同期エラー
            </Typography>
            {reason && (
              <Typography variant="caption" sx={{ mt: 0.5, textAlign: 'center', px: 1 }}>
                {reason}
              </Typography>
            )}
          </Box>
        );

      case 'active':
      default:
        return (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Chip
                icon={<SyncIcon sx={{ fontSize: '14px !important' }} />}
                label={
                  source === 'demo' ? 'デモ同期済み' :
                  source === 'seed' ? '保存データ同期' : '最新同期済み'
                }
                size="small"
                color="success"
                variant="outlined"
                sx={{ height: 20, fontSize: '0.65rem' }}
              />
              {lastSyncAt && (
                <Typography variant="caption" color="text.secondary">
                  {new Date(lastSyncAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                </Typography>
              )}
            </Box>

            {itemCount !== undefined ? (
              <List dense disablePadding>
                <ListItem disableGutters>
                  <ListItemText
                    primary={<Typography variant="body2" fontWeight={500}>SP連携スケジュール</Typography>}
                    secondary={`${itemCount} 件の項目を同期中`}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                </ListItem>
              </List>
            ) : (
              <Box sx={{ py: 2, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  表示する項目はありません
                </Typography>
              </Box>
            )}

            {subtitle && (
              <Typography
                variant="caption"
                display="block"
                sx={{ mt: 1, color: 'text.secondary', fontStyle: 'italic' }}
              >
                {subtitle}
              </Typography>
            )}
          </Box>
        );
    }
  };

  const renderDetailsDialog = () => {
    if (!details) return null;
    return (
      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>同期ステータス詳細</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Box>
              <Typography variant="caption" color="text.secondary">現在の状態</Typography>
              <Typography variant="body2" fontWeight={600}>{details.state.toUpperCase()}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">同期ソース</Typography>
              <Typography variant="body2" fontWeight={600}>{details.source || '未接続'}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">最終同期時刻</Typography>
              <Typography variant="body2" fontWeight={600}>
                {details.lastSyncAt
                  ? new Date(details.lastSyncAt).toLocaleString('ja-JP')
                  : 'データなし'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">取得件数</Typography>
              <Typography variant="body2" fontWeight={600}>
                {details.itemCount !== undefined ? `${details.itemCount} 件` : '不明'}
              </Typography>
            </Box>
            {details.error && (
              <Box>
                <Typography variant="caption" color="error">エラーメッセージ</Typography>
                <Typography variant="caption" display="block" sx={{ mt: 0.5, p: 1, bgcolor: 'error.lighter', borderRadius: 0.5 }}>
                  {details.error}
                </Typography>
              </Box>
            )}
            {details.reason && (
              <Box>
                <Typography variant="caption" color="text.secondary">ステータス理由</Typography>
                <Typography variant="body2">{details.reason}</Typography>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>閉じる</Button>
        </DialogActions>
      </Dialog>
    );
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        height: '100%',
        transition: 'all 0.2s ease',
        borderColor:
          state === 'active' ? 'primary.light' :
          state === 'error' ? 'error.light' : 'divider',
        backgroundColor:
          state === 'disabled' ? 'rgba(0,0,0,0.01)' :
          state === 'error' ? '#fff8f8' : 'background.paper',
        '&:hover': {
          borderColor:
            state === 'active' ? 'primary.main' :
            state === 'error' ? 'error.main' : 'divider',
          boxShadow:
            state === 'active' ? '0 2px 8px rgba(0,0,0,0.05)' :
            state === 'error' ? '0 2px 8px rgba(255,0,0,0.05)' : 'none',
        },
      }}
      data-testid="schedules-sp-lane"
      data-state={state}
      data-source={source}
      data-busy={busy ? '1' : undefined}
      data-version={model.version}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: state === 'active' ? 0.5 : 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1 }}>
          {title}
        </Typography>
        <Stack direction="row" spacing={0.5} alignItems="center">
          {canRetry && (
            <Tooltip title={busy ? '同期中...' : '今すぐ同期'}>
              <Box component="span">
                <IconButton
                  size="small"
                  onClick={onRetry}
                  disabled={busy}
                  aria-label={busy ? '同期中' : '今すぐ同期'}
                  sx={{
                    color: state === 'error' ? 'error.main' : 'primary.main',
                    bgcolor: state === 'error' ? 'error.lighter' : 'primary.lighter',
                    '&:hover': {
                      bgcolor: state === 'error' ? 'error.light' : 'primary.light',
                    },
                    '&.Mui-disabled': {
                      color: state === 'error' ? 'error.light' : 'primary.light',
                    },
                  }}
                >
                  {busy ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : (
                    <RefreshIcon sx={{ fontSize: 18 }} />
                  )}
                </IconButton>
              </Box>
            </Tooltip>
          )}
          {state !== 'disabled' && (
            <IconButton
              size="small"
              onClick={() => setDetailsOpen(true)}
              aria-label="同期ステータス詳細を表示"
            >
              <InfoOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
            </IconButton>
          )}
        </Stack>
      </Box>

      {renderContent()}
      {renderDetailsDialog()}
    </Paper>
  );
};

export default SchedulesSpLane;

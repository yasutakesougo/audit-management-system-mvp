import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import SyncIcon from '@mui/icons-material/Sync';
import SyncDisabledIcon from '@mui/icons-material/SyncDisabled';
import { Box, Chip, CircularProgress, List, ListItem, ListItemText, Paper, Tooltip, Typography } from '@mui/material';
import React from 'react';

export type LaneState = 'disabled' | 'idle' | 'active' | 'error';

export interface SpLaneModel {
  state: LaneState;
  title: string;
  subtitle?: string;
  lastSyncAt?: string;
  itemCount?: number;
  reason?: string;
}

export interface SchedulesSpLaneProps {
  model: SpLaneModel;
}

/**
 * SchedulesSpLane Component
 *
 * A constant structural element for the SharePoint (SP) lane.
 * It handles its own states (Disabled/Idle/Active) driven by the SpLaneModel.
 */
export const SchedulesSpLane: React.FC<SchedulesSpLaneProps> = ({ model }) => {
  const { state, title, subtitle, lastSyncAt, itemCount, reason } = model;

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
                label="同期済み"
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
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: state === 'active' ? 1 : 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1 }}>
          {title}
        </Typography>
        {state === 'disabled' && (
          <Tooltip title="設定で有効化できます">
            <ErrorOutlineIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
          </Tooltip>
        )}
      </Box>

      {renderContent()}
    </Paper>
  );
};

export default SchedulesSpLane;

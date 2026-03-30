/**
 * @fileoverview Escalation Alert Banner — 重要事項の割り込み通知
 */
import React from 'react';
import { 
  Alert, 
  AlertTitle, 
  Box, 
  Button, 
  Collapse, 
  Stack, 
  Typography, 
  IconButton,
  Chip
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import WarningIcon from '@mui/icons-material/Warning';
import type { EscalatedException } from '../hooks/useEscalationEvaluation';

const LEVEL_CONFIG = {
  emergency: { severity: 'error' as const, label: '🚨 緊急エスカレーション', sx: { border: 2, borderColor: 'error.main' } },
  warning: { severity: 'warning' as const, label: '⚠️ リーダー警告', sx: { border: 1, borderColor: 'warning.main' } },
  alert: { severity: 'info' as const, label: '🔔 業務リマインド', sx: { border: 1, borderColor: 'info.main' } },
  none: { severity: 'success' as const, label: '完了', sx: {} }
};

type EscalationAlertBannerProps = {
  activeEscalations: EscalatedException[];
  onDismiss: (id: string) => void;
  onActionClick: (id: string) => void;
};

export const EscalationAlertBanner: React.FC<EscalationAlertBannerProps> = ({ 
  activeEscalations, onDismiss, onActionClick 
}) => {
  if (activeEscalations.length === 0) return null;

  return (
    <Stack spacing={1.5} sx={{ mb: 4 }}>
      {activeEscalations.map(({ item, decision }) => {
        const config = LEVEL_CONFIG[decision.level];
        
        return (
          <Collapse key={`escalation-${item.id}`} in={true}>
            <Alert 
              severity={config.severity}
              variant="outlined"
              sx={{ 
                p: 2, 
                borderRadius: 2, 
                bgcolor: 'background.paper',
                ...config.sx
              }}
              action={
                <Stack direction="row" spacing={1}>
                  <Button 
                    variant="contained" 
                    color={config.severity} 
                    size="small" 
                    onClick={() => onActionClick(item.id)}
                    sx={{ fontWeight: 700, textTransform: 'none' }}
                  >
                    即時対応
                  </Button>
                  <IconButton 
                    size="small" 
                    onClick={() => onDismiss(item.id)}
                    aria-label="close"
                  >
                    <CloseIcon fontSize="inherit" />
                  </IconButton>
                </Stack>
              }
              icon={<WarningIcon fontSize="large" />}
            >
              <AlertTitle sx={{ mb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="subtitle1" fontWeight={800}>
                  {config.label}
                </Typography>
                {decision.reasons.map(r => (
                  <Chip 
                    key={r.code} 
                    label={r.label} 
                    size="small" 
                    variant="outlined" 
                    color={config.severity}
                    sx={{ fontSize: '0.65rem' }}
                  />
                ))}
              </AlertTitle>
              
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                   対象: {item.targetUser} / {item.title}
                </Typography>
                <Typography variant="caption" display="block" color="text.secondary">
                  理由: {decision.reasons.map(r => r.description).join(' / ')}
                </Typography>
              </Box>
            </Alert>
          </Collapse>
        );
      })}
    </Stack>
  );
};

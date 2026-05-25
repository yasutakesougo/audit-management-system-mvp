import React from 'react';
import { 
  Box, 
  Typography, 
  IconButton, 
  Paper, 
  Stack, 
  Chip, 
  CircularProgress,
  List,
  ListItem,
  ListItemText
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EventNoteIcon from '@mui/icons-material/EventNote';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import BlockIcon from '@mui/icons-material/Block';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { useDailyProcedureFlowPreview } from '../hooks/useDailyProcedureFlowPreview';
import { formatDateShort } from '@/lib/dateFormat';

interface KioskDailyProcedureFlowPreviewProps {
  userId: string;
  userName: string;
  recordDate: string;
  onClose: () => void;
  onBack?: () => void; // Optional if navigated from another panel
}

export const KioskDailyProcedureFlowPreview: React.FC<KioskDailyProcedureFlowPreviewProps> = ({
  userId,
  userName,
  recordDate,
  onClose,
  onBack,
}) => {
  const { steps, isLoading, error } = useDailyProcedureFlowPreview(userId, recordDate);


  const getStatusConfig = (status?: string) => {
    switch (status) {
      case 'completed':
        return {
          label: '実施済み',
          color: 'success' as const,
          icon: <CheckCircleOutlineIcon fontSize="small" />,
          bgcolor: 'success.lighter',
        };
      case 'triggered':
        return {
          label: '行動発生',
          color: 'warning' as const,
          icon: <WarningAmberIcon fontSize="small" />,
          bgcolor: 'warning.lighter',
        };
      case 'skipped':
        return {
          label: 'スキップ',
          color: 'error' as const,
          icon: <BlockIcon fontSize="small" />,
          bgcolor: 'error.lighter',
        };
      default:
        return {
          label: '未記録',
          color: 'default' as const,
          icon: <HelpOutlineIcon fontSize="small" />,
          bgcolor: 'action.hover',
        };
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: 400 }}>
          <CircularProgress />
        </Box>
      );
    }

    if (error) {
      return (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="error" variant="body1" sx={{ fontWeight: 'bold' }}>
            1日の流れの取得に失敗しました
          </Typography>
          <Typography color="text.secondary" variant="caption" sx={{ mt: 1, display: 'block' }}>
            {error.message}
          </Typography>
        </Box>
      );
    }

    if (!steps.length) {
      return (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">時間割・手順データが見つかりません</Typography>
        </Box>
      );
    }

    return (
      <List sx={{ px: 2, py: 1 }}>
        {steps.map((step) => {
          const hasRecord = !!step.record;
          const statusConfig = getStatusConfig(step.record?.status);

          return (
            <React.Fragment key={step.rowNo}>
              <ListItem 
                alignItems="flex-start" 
                sx={{ 
                  px: 2, 
                  py: 2, 
                  borderRadius: 3, 
                  mb: 1.5,
                  bgcolor: hasRecord ? 'background.paper' : 'action.hover',
                  borderLeft: 4,
                  borderColor: step.isKey 
                    ? 'primary.main' 
                    : hasRecord 
                      ? `${statusConfig.color}.main` 
                      : 'divider',
                  boxShadow: hasRecord ? '0 2px 8px rgba(0,0,0,0.04)' : 'none',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    transform: 'translateY(-1px)'
                  }
                }}
              >
                <ListItemText
                  disableTypography
                  primary={
                    <Stack component="div" direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
                      {/* Row No & Time Label */}
                      <Chip 
                        size="small" 
                        label={`${step.rowNo}行目 • ${step.time}`} 
                        sx={{ 
                          fontWeight: 'bold', 
                          bgcolor: step.isKey ? 'primary.main' : 'text.secondary',
                          color: 'common.white',
                          borderRadius: 1.5,
                          fontSize: '0.75rem'
                        }}
                      />
                      
                      {/* Activity Name */}
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                        {step.activity}
                      </Typography>

                      {/* Status Chip */}
                      <Chip 
                        size="small"
                        icon={statusConfig.icon}
                        label={statusConfig.label}
                        color={statusConfig.color}
                        variant={hasRecord ? 'filled' : 'outlined'}
                        sx={{ 
                          ml: 'auto', 
                          borderRadius: 2,
                          height: 24,
                          '& .MuiChip-label': { px: 1, fontSize: '0.75rem', fontWeight: 'bold' }
                        }}
                      />
                    </Stack>
                  }
                  secondary={
                    <Box component="div" sx={{ pl: 1, mt: 0.5 }}>
                      {/* Instruction (Welfare procedure context) */}
                      {step.activityDetail && (
                        <Typography variant="caption" display="block" color="text.secondary" sx={{ mb: 0.5 }}>
                          <strong>内容:</strong> {step.activityDetail}
                        </Typography>
                      )}
                      {step.instructionDetail && (
                        <Typography variant="caption" display="block" color="text.secondary" sx={{ mb: 1 }}>
                          <strong>指示事項:</strong> {step.instructionDetail}
                        </Typography>
                      )}

                      {/* Execution Memo if present */}
                      {hasRecord ? (
                        <Paper 
                          elevation={0} 
                          sx={{ 
                            p: 1.5, 
                            bgcolor: 'grey.50', 
                            borderRadius: 2, 
                            border: 1, 
                            borderColor: 'grey.100',
                            mt: 1
                          }}
                        >
                          <Typography component="div" variant="body2" color="text.primary" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                            {step.record?.memo || '（様子・メモ未記入）'}
                          </Typography>
                          
                          {(step.record?.recordedBy || step.record?.recordedAt) && (
                            <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 1 }}>
                              <Typography variant="caption" color="text.secondary">
                                {step.record?.recordedBy ? `${step.record.recordedBy} 支援員` : ''} 
                                {step.record?.recordedAt ? ` • ${new Date(step.record.recordedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}` : ''}
                              </Typography>
                            </Stack>
                          )}
                        </Paper>
                      ) : (
                        <Typography component="div" variant="body2" color="text.disabled" sx={{ fontStyle: 'italic', mt: 0.5 }}>
                          記録はありません
                        </Typography>
                      )}
                    </Box>
                  }
                />
              </ListItem>
            </React.Fragment>
          );
        })}
      </List>
    );
  };

  return (
    <Box sx={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      bgcolor: 'grey.50',
      width: { xs: '100%', md: 450 }
    }}>
      {/* Header */}
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
        {onBack && (
          <IconButton onClick={onBack} sx={{ mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>
        )}
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexGrow: 1 }}>
          <EventNoteIcon color="primary" />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 'bold', lineHeight: 1.2 }}>
              1日の流れプレビュー
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {userName} 様 • {formatDateShort(recordDate)}
            </Typography>
          </Box>
        </Stack>
        <IconButton onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Timeline Steps Content */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto', py: 1 }}>
        {renderContent()}
      </Box>
    </Box>
  );
};

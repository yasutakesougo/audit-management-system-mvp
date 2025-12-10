import {
    CheckCircle as CheckCircleIcon,
    Warning as WarningIcon,
} from '@mui/icons-material';
import {
    Box,
    Chip,
    Paper,
    Stack,
    Typography
} from '@mui/material';
import React from 'react';
import type { MeetingStep, MeetingStepId } from './meetingSteps';

export type MeetingStepsChecklistProps = {
  title: React.ReactNode;
  steps: MeetingStep[];
  onToggleStep: (id: MeetingStepId) => void;
  // カラーバリアント（朝会=primary, 夕会=secondary）
  colorVariant?: 'primary' | 'secondary';
  // フッターテキスト（下部の説明文）
  footerText?: string;
  // Option B: 申し送りアラート情報
  handoffAlert?: {
    criticalCount: number;
    totalActiveCount: number;
    hasAlerts: boolean;
  };
};

const MeetingStepsChecklist: React.FC<MeetingStepsChecklistProps> = ({
  title,
  steps,
  onToggleStep,
  colorVariant = 'primary',
  footerText,
  handoffAlert,
}) => {
  const completedCount = steps.filter((s) => s.completed).length;
  const total = steps.length;

  return (
    <Paper
      sx={{
        p: 3,
        bgcolor: `${colorVariant}.50`,
        borderLeft: '6px solid',
        borderColor: `${colorVariant}.main`
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: `${colorVariant}.main` }}>
          {title}
        </Typography>
        <Typography variant="body2" sx={{ color: `${colorVariant}.main`, fontWeight: 600 }}>
          完了: {completedCount}/{total}
        </Typography>
      </Stack>

      {/* インタラクティブチェックリスト */}
      <Stack spacing={1.5}>
        {steps.map((step) => (
          <Paper
            key={step.id}
            variant="outlined"
            sx={{
              p: 2,
              bgcolor: step.completed ? 'success.50' : 'background.paper',
              borderColor: step.completed ? 'success.main' : 'grey.300',
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': {
                borderColor: step.completed ? 'success.dark' : `${colorVariant}.main`,
                bgcolor: step.completed ? 'success.100' : `${colorVariant}.50`
              }
            }}
            onClick={() => onToggleStep(step.id)}
          >
            <Stack direction="row" alignItems="center" spacing={2}>
              <Box
                sx={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  bgcolor: step.completed ? 'success.main' : 'grey.300',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                {step.completed ? '✓' : step.id}
              </Box>
              <Box sx={{ flex: 1 }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                  <Typography
                    variant="body1"
                    sx={{
                      fontWeight: 600,
                      textDecoration: step.completed ? 'line-through' : 'none',
                      color: step.completed ? 'text.secondary' : 'text.primary'
                    }}
                  >
                    {step.title}
                  </Typography>

                  {/* Option B: アラートバッジ */}
                  {step.hasHandoffAlert && handoffAlert && (
                    handoffAlert.hasAlerts ? (
                      <Chip
                        size="small"
                        icon={<WarningIcon />}
                        label={handoffAlert.criticalCount > 0 ? `重要 ${handoffAlert.criticalCount}件` : `要確認 ${handoffAlert.totalActiveCount}件`}
                        color="error"
                        variant="filled"
                        sx={{ fontSize: '0.7rem', height: 20 }}
                      />
                    ) : (
                      <Chip
                        size="small"
                        icon={<CheckCircleIcon />}
                        label="問題なし"
                        color="success"
                        variant="outlined"
                        sx={{ fontSize: '0.7rem', height: 20 }}
                      />
                    )
                  )}
                </Stack>

                {step.description && (
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'text.secondary',
                      opacity: step.completed ? 0.7 : 1
                    }}
                  >
                    {step.description}
                  </Typography>
                )}
              </Box>
            </Stack>
          </Paper>
        ))}
      </Stack>

      {/* フッターテキスト */}
      {footerText && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
          {footerText}
        </Typography>
      )}
    </Paper>
  );
};

export default MeetingStepsChecklist;
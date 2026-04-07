import { useActionEnforcement } from '@/features/exceptions/hooks/useActionEnforcement';
import { useWorkTaskStore } from '@/features/exceptions/store/workTaskStore';
import { Box, Button, Dialog, DialogContent, DialogTitle, Stack, Typography, Chip, Divider } from '@mui/material';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import PersonPinRoundedIcon from '@mui/icons-material/PersonPinRounded';
import HourglassTopRoundedIcon from '@mui/icons-material/HourglassTopRounded';
import SettingsSuggestRoundedIcon from '@mui/icons-material/SettingsSuggestRounded';
import { useNavigate } from 'react-router-dom';
import React from 'react';

export const ActionEnforcementGuard: React.FC = () => {
  const { isBlocked, criticalTasks, blockingMessage, resolutionHint } = useActionEnforcement();
  const acknowledge = useWorkTaskStore(s => s.acknowledge);
  const navigate = useNavigate();

  if (!isBlocked) return null;

  return (
    <Dialog 
      open={true} 
      maxWidth="sm" 
      fullWidth
      slotProps={{
        backdrop: {
          sx: { backgroundColor: 'rgba(5, 5, 12, 0.95)', backdropFilter: 'blur(16px)' }
        }
      }}
      PaperProps={{
        sx: { borderRadius: 4, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }
      }}
    >
      <DialogTitle sx={{ textAlign: 'center', pt: 5, pb: 1 }}>
        <WarningRoundedIcon color="error" sx={{ fontSize: 72, mb: 1, filter: 'drop-shadow(0 0 8px rgba(211,47,47,0.4))' }} />
        <Typography variant="h5" fontWeight={900} color="error.main" sx={{ letterSpacing: '-0.02em', textTransform: 'uppercase' }}>
          Governance Locked
        </Typography>
        <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ mt: 1, display: 'block' }}>
           責任管理システムにより画面を制限しています
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ textAlign: 'center', px: 4, pb: 5 }}>
        <Typography variant="body1" sx={{ mb: 4, mt: 2, color: 'text.primary', fontWeight: 600, fontSize: '1.1rem', lineHeight: 1.6 }}>
          {blockingMessage}
        </Typography>

        <Stack spacing={2.5} sx={{ mb: 4 }}>
          {criticalTasks.slice(0, 3).map(task => (
            <Box 
              key={task.id} 
              sx={{ 
                p: 2.5, 
                borderRadius: 3, 
                bgcolor: 'rgba(255, 235, 238, 0.4)', 
                border: '1px solid',
                borderColor: 'error.light',
                textAlign: 'left',
                position: 'relative'
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.5 }}>
                <Typography variant="subtitle1" fontWeight={900} color="error.dark" sx={{ flex: 1, mr: 1, lineHeight: 1.2 }}>
                  {task.title}
                </Typography>
                <Chip 
                  icon={task.responsibilityScope === 'system' ? <SettingsSuggestRoundedIcon /> : <PersonPinRoundedIcon />}
                  label={task.responsibilityScope === 'system' ? '管理者責任' : '現場担当責任'} 
                  size="small" 
                  color={task.responsibilityScope === 'system' ? 'primary' : 'error'}
                  sx={{ fontWeight: 900, borderRadius: 1 }}
                />
              </Stack>
              
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontWeight: 500 }}>
                {task.description}
              </Typography>

              <Stack direction="row" spacing={2}>
                {task.assignedTo && (
                  <Stack direction="row" alignItems="center" spacing={0.5} sx={{ color: 'text.secondary', bgcolor: 'rgba(0,0,0,0.05)', px: 1, py: 0.25, borderRadius: 1 }}>
                    <PersonPinRoundedIcon sx={{ fontSize: 14 }} />
                    <Typography variant="caption" fontWeight={700}>担当: {task.assignedTo}</Typography>
                  </Stack>
                )}
                {task.dueAt && (
                  <Stack direction="row" alignItems="center" spacing={0.5} sx={{ color: 'error.main', bgcolor: 'rgba(211,47,47,0.05)', px: 1, py: 0.25, borderRadius: 1 }}>
                    <HourglassTopRoundedIcon sx={{ fontSize: 14 }} />
                    <Typography variant="caption" fontWeight={700}>期限: {task.dueAt}</Typography>
                  </Stack>
                )}
              </Stack>
            </Box>
          ))}
        </Stack>

        <Divider sx={{ mb: 4, opacity: 0.5 }} />

        <Stack spacing={2}>
          <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', mb: 1, fontWeight: 700 }}>
             {resolutionHint}
          </Typography>

          <Button
            variant="contained"
            fullWidth
            size="large"
            color="error"
            endIcon={<ArrowForwardRoundedIcon />}
            onClick={() => {
              criticalTasks.forEach(t => acknowledge(t.stableId || t.id, 'CONFIRMED'));
              navigate('/today');
            }}
            sx={{ 
              py: 2.2, 
              borderRadius: 3, 
              fontWeight: 900, 
              fontSize: '1.2rem',
              boxShadow: (t) => t.shadows[14]
            }}
          >
            自分が対応する（確認済）
          </Button>

          <Button
            variant="outlined"
            fullWidth
            onClick={() => {
               criticalTasks.forEach(t => acknowledge(t.stableId || t.id, 'ASSIGNED_TO_OTHER'));
               navigate('/today');
            }}
            sx={{ 
              py: 1.5, 
              borderRadius: 3, 
              fontWeight: 800, 
              color: 'text.secondary',
              borderColor: 'divider'
            }}
          >
            他者が対応中につきスキップ
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
};

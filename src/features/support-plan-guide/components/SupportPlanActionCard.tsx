import React from 'react';
import { Paper, Stack, Typography, Box, Button, Chip } from '@mui/material';
import AddTaskRoundedIcon from '@mui/icons-material/AddTaskRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import type { ActionSuggestion, ActionTask, ActionTaskStatus } from '@/features/action-engine';

export interface ActionWithTask {
  action: ActionSuggestion;
  task: ActionTask | null;
}

interface SupportPlanActionCardProps {
  actionWithTasks: ActionWithTask[];
  onActionClick: (suggestion: ActionSuggestion) => void;
  onPromote: (suggestion: ActionSuggestion) => void;
  onUpdateStatus: (taskId: string, status: ActionTaskStatus) => void;
}

/**
 * SupportPlanActionCard — 推奨アクションの実行管理
 * 
 * 分析から導出されたアクションを「タスク」として永続化・追跡します。
 * 未着手、実行中、完了のステータスを表示し、実務の進捗を可視化します。
 */
export const SupportPlanActionCard: React.FC<SupportPlanActionCardProps> = ({ 
  actionWithTasks, 
  onActionClick,
  onPromote,
  onUpdateStatus
}) => {
  if (actionWithTasks.length === 0) return null;

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700, color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 1 }}>
        <AddTaskRoundedIcon fontSize="small" color="primary" />
        実行アクション (Executable DES)
      </Typography>
      
      <Stack spacing={1.5}>
        {actionWithTasks.map(({ action, task }) => {
          const status = task?.status || 'open';
          const isDone = status === 'done';
          const isInProgress = status === 'in_progress';

          return (
            <Paper
              key={action.id}
              variant="outlined"
              sx={{
                p: 2,
                borderLeft: '4px solid',
                borderLeftColor: isDone ? 'success.light' : (action.priority === 'P0' ? 'error.main' : 'warning.main'),
                backgroundColor: isDone ? 'rgba(46, 125, 50, 0.01)' : (action.priority === 'P0' ? 'rgba(211, 47, 47, 0.02)' : 'rgba(237, 108, 2, 0.02)'),
                opacity: isDone ? 0.8 : 1,
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  boxShadow: isDone ? 'none' : '0 4px 12px rgba(0,0,0,0.08)',
                  backgroundColor: 'white',
                  transform: isDone ? 'none' : 'translateY(-2px)'
                }
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                <Box sx={{ flex: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    {!isDone && (
                      <Chip 
                        label={action.priority} 
                        size="small" 
                        color={action.priority === 'P0' ? 'error' : 'warning'} 
                        sx={{ height: 18, fontSize: '0.65rem', fontWeight: 900, borderRadius: '4px' }} 
                      />
                    )}
                    {isDone && (
                      <Chip 
                        icon={<CheckCircleRoundedIcon sx={{ fontSize: '12px !important' }} />}
                        label="完了" 
                        size="small" 
                        color="success"
                        sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700 }} 
                      />
                    )}
                    <Typography variant="subtitle2" sx={{ 
                      fontWeight: 800, 
                      color: 'text.primary',
                      textDecoration: isDone ? 'line-through' : 'none',
                      opacity: isDone ? 0.6 : 1
                    }}>
                      {action.title}
                    </Typography>
                  </Stack>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ 
                    fontSize: '0.85rem', 
                    mb: 1.5, 
                    lineHeight: 1.5,
                    opacity: isDone ? 0.5 : 1
                  }}>
                    {action.reason}
                  </Typography>
                  
                  <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
                    {action.evidence.sourceRefs?.map((ref, i) => (
                      <Chip 
                        key={i} 
                        label={`証拠: ${ref}`} 
                        size="small" 
                        variant="outlined" 
                        sx={{ height: 16, fontSize: '0.55rem', opacity: 0.7 }}
                      />
                    ))}
                    {isInProgress && (
                      <Chip 
                        label="実行中" 
                        variant="filled" 
                        size="small" 
                        sx={{ height: 16, fontSize: '0.55rem', backgroundColor: 'primary.main', color: 'white' }}
                      />
                    )}
                  </Stack>
                </Box>
                
                <Stack direction="row" spacing={1}>
                  {!task && (
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<PlayArrowRoundedIcon />}
                      onClick={() => {
                        onPromote(action);
                        onActionClick(action);
                      }}
                      sx={{ borderRadius: 2, textTransform: 'none', fontSize: '0.75rem', fontWeight: 700 }}
                    >
                      開始
                    </Button>
                  )}
                  {isInProgress && (
                    <Button
                      variant="contained"
                      size="small"
                      color="success"
                      startIcon={<CheckCircleRoundedIcon />}
                      onClick={() => onUpdateStatus(task.taskId, 'done')}
                      sx={{ borderRadius: 2, textTransform: 'none', fontSize: '0.75rem', fontWeight: 700 }}
                    >
                      完了にする
                    </Button>
                  )}
                  {(!isDone) && (
                    <Button
                      variant="contained"
                      size="small"
                      endIcon={<ArrowForwardRoundedIcon />}
                      onClick={() => {
                        if (task && status !== 'in_progress') {
                          onUpdateStatus(task.taskId, 'in_progress');
                        }
                        onActionClick(action);
                      }}
                      sx={{ 
                        whiteSpace: 'nowrap',
                        borderRadius: 2,
                        textTransform: 'none',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        backgroundColor: isInProgress ? 'grey.100' : 'primary.main',
                        color: isInProgress ? 'text.secondary' : 'white',
                        '&:hover': { backgroundColor: isInProgress ? 'grey.200' : 'primary.dark' }
                      }}
                    >
                      {isDone ? '確認する' : (isInProgress ? '修正を続ける' : action.cta.label)}
                    </Button>
                  )}
                </Stack>
              </Stack>
            </Paper>
          );
        })}
      </Stack>
    </Box>
  );
};

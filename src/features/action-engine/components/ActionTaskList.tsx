import React from 'react';
import { 
  Box, 
  Typography, 
  Stack, 
  Paper, 
  Chip, 
  Button, 
  Divider,
  Menu,
  MenuItem,
  IconButton,
  Tooltip
} from '@mui/material';
import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import PriorityHighRoundedIcon from '@mui/icons-material/PriorityHighRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';

import { useActionTaskStore, actionTaskSelectors } from '../hooks/useActionTaskStore';
import type { ActionTask, ActionTaskStatus } from '../domain/types';
import { useUsers } from '@/features/users/useUsers';
import { useStaff } from '@/features/staff/store';
import GroupRoundedIcon from '@mui/icons-material/GroupRounded';

interface ActionTaskListProps {
  onOpenTask?: (task: ActionTask) => void;
  maxItems?: number;
}

export const ActionTaskList: React.FC<ActionTaskListProps> = ({ 
  onOpenTask,
  maxItems = 50 
}) => {
  const { tasks, updateStatus, assignTask } = useActionTaskStore();
  const { data: users } = useUsers();
  const { staff } = useStaff();
  
  const [assignMenuAnchor, setAssignMenuAnchor] = React.useState<{ el: HTMLElement; taskId: string } | null>(null);

  const tasksArray = React.useMemo(() => {
    return actionTaskSelectors.getTasksArray(tasks).slice(0, maxItems);
  }, [tasks, maxItems]);

  const summary = React.useMemo(() => {
    return actionTaskSelectors.getSummary(tasks);
  }, [tasks]);

  const getUserName = (userId: string) => {
    const user = users.find((u) => String(u.Id) === userId);
    return user ? user.FullName : `User ${userId}`;
  };

  const getStaffName = (staffId?: string) => {
    if (!staffId) return '未割当';
    const s = staff.find(st => String(st.id) === staffId);
    return s ? s.name : `Staff ${staffId}`;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'P0': return 'error';
      case 'P1': return 'warning';
      default: return 'info';
    }
  };

  const getStatusChip = (status: ActionTaskStatus) => {
    switch (status) {
      case 'open': return <Chip label="未着手" size="small" variant="outlined" />;
      case 'in_progress': return <Chip label="進行中" size="small" color="primary" variant="outlined" />;
      case 'done': return <Chip label="完了済" size="small" color="success" />;
      default: return <Chip label={status} size="small" variant="outlined" />;
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Summary Header */}
      <Stack direction="row" spacing={2} sx={{ mb: 2 }} alignItems="center">
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          アクションタスク管理
        </Typography>
        <Stack direction="row" spacing={1}>
          <Chip 
            label={`未完了 ${summary.open + summary.inProgress}件`} 
            size="small" 
            sx={{ fontWeight: 600, backgroundColor: 'rgba(0,0,0,0.05)' }} 
          />
          {summary.critical > 0 && (
            <Chip 
              icon={<PriorityHighRoundedIcon sx={{ fontSize: 14 }} />}
              label={`最優先 ${summary.critical}件`} 
              size="small" 
              color="error"
              sx={{ fontWeight: 700 }} 
            />
          )}
        </Stack>
      </Stack>

      <Stack spacing={1.5}>
        {tasksArray.map((task) => (
          <Paper 
            key={task.taskId}
            variant="outlined"
            sx={{ 
              p: 2, 
              position: 'relative',
              transition: 'all 0.2s ease-in-out',
              borderColor: task.priority === 'P0' && task.status !== 'done' ? 'error.light' : 'divider',
              backgroundColor: task.status === 'done' ? 'rgba(0,0,0,0.01)' : 'white',
              '&:hover': {
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                borderColor: 'primary.light'
              }
            }}
          >
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ sm: 'center' }}>
              <Stack spacing={1} sx={{ flex: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  {getStatusChip(task.status)}
                  <Chip 
                    label={task.priority} 
                    size="small" 
                    color={getPriorityColor(task.priority)} 
                    sx={{ fontWeight: 700, height: 20 }} 
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <PersonRoundedIcon sx={{ fontSize: 14 }} />
                    {getUserName(task.targetUserId)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <ScheduleRoundedIcon sx={{ fontSize: 14 }} />
                    {new Date(task.createdAt).toLocaleDateString()}
                  </Typography>
                  <Tooltip title="担当者を変更">
                    <Chip 
                      icon={task.assignedToUserId ? <PersonRoundedIcon sx={{ fontSize: 14 }} /> : <GroupRoundedIcon sx={{ fontSize: 14 }} />}
                      label={getStaffName(task.assignedToUserId)} 
                      size="small" 
                      variant="outlined"
                      onClick={(e) => setAssignMenuAnchor({ el: e.currentTarget, taskId: task.taskId })}
                      sx={{ 
                        fontSize: '0.7rem', 
                        height: 20,
                        cursor: 'pointer',
                        borderColor: task.assignedToUserId ? 'primary.main' : 'warning.main',
                        color: task.assignedToUserId ? 'primary.main' : 'warning.main',
                        '&:hover': { backgroundColor: 'action.hover' }
                      }} 
                    />
                  </Tooltip>
                </Stack>
                
                <Typography variant="body2" sx={{ fontWeight: 700, mt: 0.5 }}>
                  {task.title}
                </Typography>
                
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                  {task.reason}
                </Typography>
              </Stack>

              <Stack direction="row" spacing={1}>
                {task.status !== 'done' ? (
                  <>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<OpenInNewRoundedIcon />}
                      onClick={() => onOpenTask?.(task)}
                      sx={{ whiteSpace: 'nowrap' }}
                    >
                      開く
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      color="primary"
                      startIcon={task.status === 'in_progress' ? <TaskAltRoundedIcon /> : <PlayArrowRoundedIcon />}
                      onClick={() => updateStatus(task.taskId, task.status === 'open' ? 'in_progress' : 'done')}
                      sx={{ whiteSpace: 'nowrap' }}
                    >
                      {task.status === 'open' ? '開始' : '完了'}
                    </Button>
                  </>
                ) : (
                  <Tooltip title="完了済み">
                    <IconButton color="success" size="small" disabled>
                      <AssignmentTurnedInRoundedIcon />
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>
            </Stack>
          </Paper>
        ))}

        {tasksArray.length === 0 && (
          <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.02)', borderStyle: 'dashed' }}>
            <Typography variant="body2" color="text.secondary">
              現在、対応が必要なアクションタスクはありません。
            </Typography>
          </Paper>
        )}
      </Stack>

      <Menu
        anchorEl={assignMenuAnchor?.el}
        open={Boolean(assignMenuAnchor)}
        onClose={() => setAssignMenuAnchor(null)}
        PaperProps={{ sx: { maxHeight: 300 } }}
      >
        <MenuItem disabled sx={{ fontWeight: 700, fontSize: '0.75rem' }}>担当を割り当て</MenuItem>
        <Divider />
        <MenuItem onClick={() => {
          if (assignMenuAnchor) {
            assignTask(assignMenuAnchor.taskId, '');
            setAssignMenuAnchor(null);
          }
        }}>
          未割当に戻す
        </MenuItem>
        {staff.map((s) => (
          <MenuItem 
            key={s.id} 
            onClick={() => {
              if (assignMenuAnchor) {
                assignTask(assignMenuAnchor.taskId, String(s.id));
                setAssignMenuAnchor(null);
              }
            }}
          >
            {s.name}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
};

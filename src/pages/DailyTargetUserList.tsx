import {
    Avatar,
    Box,
    Card,
    CardActionArea,
    Chip,
    LinearProgress,
    Stack,
    Typography,
} from '@mui/material';
import React from 'react';

// 親コンポーネントから渡される型
interface UserProgressInfo {
  completed: number;
  total: number;
}

interface SupportUser {
  id: string;
  name: string;
  planType: string;
  isActive: boolean;
}

interface DailyTargetUserListProps {
  users: SupportUser[];
  userProgress: Record<string, UserProgressInfo>;
  selectedUserId: string;
  onSelectUser: (userId: string) => void;
}

const DailyTargetUserList: React.FC<DailyTargetUserListProps> = ({
  users,
  userProgress,
  selectedUserId,
  onSelectUser,
}) => {
  return (
    <Card elevation={2}>
      <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6">記録対象者一覧</Typography>
      </Box>
      <Stack spacing={0.5} sx={{ p: 1 }}>
        {users.map((user) => {
          const isSelected = user.id === selectedUserId;
          const progressInfo = userProgress[user.id] ?? { completed: 0, total: 1 };
          const completionRate = (progressInfo.completed / progressInfo.total) * 100;

          return (
            <Card
              key={user.id}
              variant="outlined"
              sx={{
                borderColor: isSelected ? 'primary.main' : 'transparent',
                bgcolor: isSelected ? 'action.selected' : 'transparent',
                boxShadow: 'none',
              }}
            >
              <CardActionArea
                onClick={() => onSelectUser(user.id)}
                sx={{ p: 1.5 }}
                data-testid={`user-card-${user.id}`}
              >
                <Stack spacing={1.5}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Avatar sx={{ bgcolor: 'primary.light' }}>{user.name.charAt(0)}</Avatar>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, flexGrow: 1 }}>
                      {user.name}
                    </Typography>
                    {progressInfo.completed === progressInfo.total ? (
                       <Chip label="完了" color="success" size="small" />
                    ) : (
                       <Chip label="入力中" color="warning" size="small" variant="outlined" />
                    )}
                  </Stack>
                  <Box>
                    <LinearProgress
                      variant="determinate"
                      value={completionRate}
                      color={progressInfo.completed === progressInfo.total ? 'success' : 'primary'}
                      sx={{ height: 6, borderRadius: 99 }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', textAlign: 'right' }}>
                      {progressInfo.completed} / {progressInfo.total} 件 記録済み
                    </Typography>
                  </Box>
                </Stack>
              </CardActionArea>
            </Card>
          );
        })}
      </Stack>
    </Card>
  );
};

export default DailyTargetUserList;

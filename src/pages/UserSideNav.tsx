import React from 'react';
import {
  Avatar,
  Box,
  Card,
  CardActionArea,
  Chip,
  Collapse,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Typography,
  Alert,
} from '@mui/material';
import type { SupportUser } from '@/types/support';

export type UserProgressInfo = {
  completed: number;
  total: number;
};

type UserSideNavProps = {
  users: SupportUser[];
  userProgress: Record<string, UserProgressInfo>;
  selectedUserId: string;
  selectedDate: string;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  planTypeOptions: Array<{ value: string; count: number }>;
  selectedPlanType: string;
  onPlanTypeSelect: (value: string) => void;
  onSelectUser: (userId: string) => void;
  onDateChange: (date: string) => void;
  onDismissClearedNotice?: () => void;
  selectionClearedNotice?: boolean;
};

const UserSideNav: React.FC<UserSideNavProps> = ({
  users,
  userProgress,
  selectedUserId,
  selectedDate,
  searchTerm,
  onSearchTermChange,
  planTypeOptions,
  selectedPlanType,
  onPlanTypeSelect,
  onSelectUser,
  onDateChange,
  onDismissClearedNotice,
  selectionClearedNotice = false,
}) => (
  <Paper elevation={2} sx={{ display: 'flex', flexDirection: 'column' }}>
    <Box
      sx={{
        p: 2,
        borderBottom: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        記録対象
      </Typography>
      <TextField
        label="記録日"
        type="date"
        value={selectedDate}
        onChange={(event) => onDateChange(event.target.value)}
        InputLabelProps={{ shrink: true }}
        size="small"
        fullWidth
      />
      <TextField
        label="利用者名で検索"
        value={searchTerm}
        onChange={(event) => onSearchTermChange(event.target.value)}
        size="small"
        fullWidth
      />
      {planTypeOptions.length > 0 ? (
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Chip
            label="すべて"
            clickable
            color={selectedPlanType === '' ? 'primary' : 'default'}
            variant={selectedPlanType === '' ? 'filled' : 'outlined'}
            onClick={() => onPlanTypeSelect('')}
          />
          {planTypeOptions.map(({ value, count }) => (
            <Chip
              key={value}
              label={`${value} (${count})`}
              clickable
              color={selectedPlanType === value ? 'primary' : 'default'}
              variant={selectedPlanType === value ? 'filled' : 'outlined'}
              onClick={() => onPlanTypeSelect(value)}
            />
          ))}
        </Stack>
      ) : null}
      <Collapse in={selectionClearedNotice}>
        <Alert
          severity="info"
          onClose={onDismissClearedNotice}
          sx={{ '& .MuiAlert-message': { width: '100%' } }}
        >
          絞り込み条件で選択中の利用者が一覧から外れたため、選択を解除しました。
        </Alert>
      </Collapse>
    </Box>
    <Stack spacing={1} sx={{ p: 1.5 }}>
      {users.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
          条件に合致する利用者が見つかりません。
        </Typography>
      ) : (
        users.map((user) => {
          const isSelected = user.id === selectedUserId;
          const progress = userProgress[user.id] ?? { completed: 0, total: 1 };
          const completionRate =
            progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
          const isComplete = progress.total > 0 && progress.completed === progress.total;

          return (
            <Card
              key={user.id}
              variant="outlined"
              sx={{
                borderColor: isSelected ? 'primary.main' : 'divider',
                boxShadow: isSelected ? 4 : 0,
                transition: (theme) =>
                  theme.transitions.create(['box-shadow', 'border-color'], {
                    duration: theme.transitions.duration.shortest,
                  }),
              }}
            >
              <CardActionArea onClick={() => onSelectUser(user.id)} sx={{ p: 2 }}>
                <Stack spacing={1.5}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Avatar sx={{ bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                      {user.name.charAt(0)}
                    </Avatar>
                    <Box flex={1} minWidth={0}>
                      <Typography
                        variant="subtitle1"
                        sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}
                      >
                        {user.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {user.planType}
                      </Typography>
                    </Box>
                    <Chip
                      label={isComplete ? '記録済み' : '入力中'}
                      color={isComplete ? 'success' : 'warning'}
                      size="small"
                      variant="outlined"
                    />
                  </Stack>
                  <Box>
                    <LinearProgress
                      variant="determinate"
                      value={completionRate}
                      color={isComplete ? 'success' : 'primary'}
                      sx={{ height: 8, borderRadius: 999 }}
                    />
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', textAlign: 'right', mt: 0.5 }}
                    >
                      {progress.completed}/{progress.total} 件 記録済み
                    </Typography>
                  </Box>
                </Stack>
              </CardActionArea>
            </Card>
          );
        })
      )}
    </Stack>
  </Paper>
);

export default UserSideNav;

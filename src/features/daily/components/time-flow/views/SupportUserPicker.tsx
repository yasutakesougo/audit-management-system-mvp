// ---------------------------------------------------------------------------
// SupportUserPicker — 利用者ピッカー
// ---------------------------------------------------------------------------

import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';

import type { SupportUser } from '../timeFlowTypes';

interface SupportUserPickerProps {
  users: SupportUser[];
  selectedUserId: string;
  planTypeOptions: Array<{ value: string; count: number }>;
  selectedPlanType: string;
  totalAvailableCount: number;
  onPlanTypeSelect: (planType: string) => void;
  onSelect: (userId: string) => void;
}

const SupportUserPicker: React.FC<SupportUserPickerProps> = ({
  users,
  selectedUserId,
  planTypeOptions,
  selectedPlanType,
  totalAvailableCount,
  onPlanTypeSelect,
  onSelect,
}) => {
  return (
    <Stack spacing={2} sx={{ mt: 3 }}>
      <Stack direction="row" spacing={1} flexWrap="wrap">
        <Chip
          label={`すべて (${totalAvailableCount})`}
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

      {users.length === 0 ? (
        <Alert severity="info">
          条件に一致する利用者が見つかりません。検索条件やフィルタを調整してください。
        </Alert>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(1, minmax(0, 1fr))',
              sm: 'repeat(2, minmax(0, 1fr))',
              lg: 'repeat(3, minmax(0, 1fr))',
            },
            gap: 2,
          }}
        >
          {users.map((user) => {
            const isSelected = user.id === selectedUserId;
            return (
              <Card
                key={user.id}
                variant="outlined"
                sx={{
                  borderWidth: isSelected ? 2 : 1,
                  borderColor: isSelected ? 'primary.main' : 'divider',
                  boxShadow: isSelected ? 6 : 1,
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                }}
              >
                <CardActionArea onClick={() => onSelect(user.id)} sx={{ p: 2 }}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Avatar sx={{ bgcolor: 'primary.main' }}>
                      {user.name.charAt(0)}
                    </Avatar>
                    <Box flex={1}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        {user.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {user.planType}
                      </Typography>
                    </Box>
                    {isSelected && (
                      <Chip
                        label="選択中"
                        color="primary"
                        size="small"
                        icon={<CheckCircleIcon fontSize="small" />}
                        sx={{ ml: 'auto' }}
                      />
                    )}
                  </Stack>
                </CardActionArea>
              </Card>
            );
          })}
        </Box>
      )}
    </Stack>
  );
};

export default SupportUserPicker;

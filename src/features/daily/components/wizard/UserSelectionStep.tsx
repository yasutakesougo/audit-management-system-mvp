/**
 * UserSelectionStep — Step 1: 利用者選択
 *
 * フィルター付きユーザーカードリスト。
 * カードタップで利用者を選択して自動的に Step 2 へ遷移。
 */
import type { DailySupportUserFilter } from '@/features/daily/hooks/useDailySupportUserFilter';
import type { IUserMaster } from '@/features/users/types';
import { DISABILITY_SUPPORT_LEVEL_OPTIONS } from '@/features/users/typesExtended';
import FilterListOffIcon from '@mui/icons-material/FilterListOff';
import PersonIcon from '@mui/icons-material/Person';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import React, { memo } from 'react';

export type UserSelectionStepProps = {
  filteredUsers: IUserMaster[];
  allUsersCount: number;
  filter: DailySupportUserFilter;
  hasActiveFilter: boolean;
  onUpdateFilter: (patch: Partial<DailySupportUserFilter>) => void;
  onResetFilter: () => void;
  onSelectUser: (userId: string) => void;
  /** 未記入件数マップ (userId → unfilledCount) — 進捗表示用 */
  unfilledCountMap?: Map<string, number>;
};

export const UserSelectionStep: React.FC<UserSelectionStepProps> = memo(({
  filteredUsers,
  allUsersCount,
  filter,
  hasActiveFilter,
  onUpdateFilter,
  onResetFilter,
  onSelectUser,
  unfilledCountMap,
}) => {
  return (
    <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* ── Filter bar ── */}
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        flexWrap="wrap"
        sx={{
          p: 1.5,
          bgcolor: hasActiveFilter ? 'action.hover' : 'background.paper',
          borderRadius: 1,
          border: 1,
          borderColor: 'divider',
        }}
      >
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel id="wizard-filter-support-level">支援区分</InputLabel>
          <Select
            labelId="wizard-filter-support-level"
            value={filter.supportLevel}
            label="支援区分"
            onChange={(e) => onUpdateFilter({ supportLevel: e.target.value })}
          >
            {DISABILITY_SUPPORT_LEVEL_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 110 }}>
          <InputLabel id="wizard-filter-status">ステータス</InputLabel>
          <Select
            labelId="wizard-filter-status"
            value={filter.usageStatus}
            label="ステータス"
            onChange={(e) => onUpdateFilter({ usageStatus: e.target.value })}
          >
            <MenuItem value="">（全て）</MenuItem>
            <MenuItem value="active">利用中</MenuItem>
            <MenuItem value="pending">開始待ち</MenuItem>
            <MenuItem value="suspended">休止中</MenuItem>
            <MenuItem value="terminated">契約終了</MenuItem>
          </Select>
        </FormControl>

        <Tooltip title="強度行動障害支援対象者のみ表示">
          <ToggleButton
            value="highIntensity"
            selected={filter.highIntensityOnly}
            onChange={() => onUpdateFilter({ highIntensityOnly: !filter.highIntensityOnly })}
            size="small"
            sx={{ textTransform: 'none', fontSize: '0.8rem', px: 1.5 }}
          >
            強度行動障害
          </ToggleButton>
        </Tooltip>

        {hasActiveFilter && (
          <>
            <Chip
              label={`${filteredUsers.length}/${allUsersCount}人`}
              size="small"
              color="primary"
              variant="outlined"
            />
            <Tooltip title="フィルターをリセット">
              <IconButton size="small" onClick={onResetFilter} aria-label="フィルターをリセット">
                <FilterListOffIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        )}
      </Stack>

      {/* ── User cards ── */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
          gap: 1.5,
          alignContent: 'start',
        }}
      >
        {filteredUsers.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ gridColumn: '1 / -1', textAlign: 'center', py: 4 }}>
            該当する利用者がいません
          </Typography>
        ) : (
          filteredUsers.map((user) => {
            const unfilled = unfilledCountMap?.get(user.UserID);
            return (
              <Card
                key={user.UserID}
                variant="outlined"
                sx={{
                  transition: 'box-shadow 0.15s, border-color 0.15s',
                  '&:hover': { borderColor: 'primary.main', boxShadow: 2 },
                }}
              >
                <CardActionArea
                  onClick={() => onSelectUser(user.UserID)}
                  sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, justifyContent: 'flex-start' }}
                  data-testid={`wizard-user-card-${user.UserID}`}
                >
                  <PersonIcon color="action" />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle2" noWrap fontWeight={600}>
                      {user.FullName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {user.DisabilitySupportLevel || '—'}
                    </Typography>
                  </Box>
                  {unfilled !== undefined && unfilled > 0 && (
                    <Chip
                      label={`残${unfilled}`}
                      size="small"
                      color="warning"
                      variant="outlined"
                      sx={{ fontSize: '0.7rem' }}
                    />
                  )}
                </CardActionArea>
              </Card>
            );
          })
        )}
      </Box>
    </Box>
  );
});

UserSelectionStep.displayName = 'UserSelectionStep';

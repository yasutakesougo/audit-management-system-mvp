/**
 * UserSelectionStep — Step 1: 利用者選択（支援開始ハブ）
 *
 * 単なる UserPicker ではなく **支援開始ハブ** として設計。
 *
 * カード表示:
 *   ・利用者名 / 支援区分 / 行動関連項目点数
 *   ・強度行動障害対象チップ / ABC 件数 / 未記入件数
 *
 * カード選択時サマリー（Step1-C）:
 *   ・支援計画シート状態
 *   ・最新モニタリング日（残り日数）
 *   ・今日のABC記録件数
 *   ・最新ABC記録日
 *   → 「支援手順へ進む」ボタン
 */
import { computeMonitoringDeadlineFromSupportStart } from '@/features/daily/components/MonitoringCountdown';
import type { DailySupportUserFilter } from '@/features/daily/hooks/useDailySupportUserFilter';
import type { IUserMaster } from '@/features/users/types';
import { DISABILITY_SUPPORT_LEVEL_OPTIONS } from '@/features/users/typesExtended';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import FilterListOffIcon from '@mui/icons-material/FilterListOff';
import PersonIcon from '@mui/icons-material/Person';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import Box from '@mui/material/Box';
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
import React, { memo, useCallback, useMemo } from 'react';
import { UserCard } from './UserCard';
import { useUserSelectionStepData } from './hooks/useUserSelectionStepData';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

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

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────

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
  const { abcSummary, planningSheets } = useUserSelectionStepData();

  // ── カードタップで即 Step 2 へ遷移 ──
  const handleCardClick = useCallback((userId: string) => {
    onSelectUser(userId);
  }, [onSelectUser]);

  // Sort: 強度行動障害対象者を先頭 → 行動関連項目点数の降順
  const sortedUsers = useMemo(() => {
    return [...filteredUsers].sort((a, b) => {
      const aHigh = a.IsHighIntensitySupportTarget === true ? 0 : 1;
      const bHigh = b.IsHighIntensitySupportTarget === true ? 0 : 1;
      if (aHigh !== bHigh) return aHigh - bHigh;
      const aScore = a.BehaviorScore ?? 0;
      const bScore = b.BehaviorScore ?? 0;
      return bScore - aScore;
    });
  }, [filteredUsers]);

  const highIntensityCount = useMemo(
    () => filteredUsers.filter(u => u.IsHighIntensitySupportTarget === true).length,
    [filteredUsers],
  );

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
            <Chip label={`${filteredUsers.length}/${allUsersCount}人`} size="small" color="primary" variant="outlined" />
            <Tooltip title="フィルターをリセット">
              <IconButton size="small" onClick={onResetFilter} aria-label="フィルターをリセット">
                <FilterListOffIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        )}

        {highIntensityCount > 0 && !filter.highIntensityOnly && (
          <Chip
            icon={<WarningAmberRoundedIcon />}
            label={`強度対象 ${highIntensityCount}名`}
            size="small"
            color="warning"
            variant="outlined"
            sx={{ fontSize: '0.75rem' }}
          />
        )}
      </Stack>

      {/* ── Summary chips ── */}
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Chip icon={<PersonIcon />} label={`${sortedUsers.length}名`} size="small" variant="outlined" sx={{ fontSize: '0.75rem' }} />
        {abcSummary.todayCounts.size > 0 && (
          <Chip
            icon={<EditNoteRoundedIcon />}
            label={`今日のABC記録: ${Array.from(abcSummary.todayCounts.values()).reduce((a, b) => a + b, 0)}件`}
            size="small"
            color="info"
            variant="outlined"
            sx={{ fontSize: '0.75rem' }}
          />
        )}
      </Stack>

      {/* ── User cards grid ── */}
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
        {sortedUsers.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ gridColumn: '1 / -1', textAlign: 'center', py: 4 }}>
            該当する利用者がいません
          </Typography>
        ) : (
          sortedUsers.map((user) => {
            const monitoringDeadline = user.ServiceStartDate
              ? computeMonitoringDeadlineFromSupportStart(user.ServiceStartDate)
              : null;
            return (
              <UserCard
                key={user.UserID}
                user={user}
                unfilled={unfilledCountMap?.get(user.UserID)}
                abcTodayCount={abcSummary.todayCounts.get(user.UserID) ?? 0}
                isSelected={false}
                hasPlan={planningSheets.has(user.UserID)}
                monitoringDeadline={monitoringDeadline}
                onSelect={handleCardClick}
              />
            );
          })
        )}
      </Box>
    </Box>
  );
});

UserSelectionStep.displayName = 'UserSelectionStep';

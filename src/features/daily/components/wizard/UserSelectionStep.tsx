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
import type { AbcRecord } from '@/domain/abc/abcRecord';
import type { SupportPlanningSheet } from '@/domain/isp/schema';
import { computeMonitoringCycle } from '@/features/daily/components/MonitoringCountdown';
import type { MonitoringCycleResult } from '@/features/daily/components/MonitoringCountdown';
import type { DailySupportUserFilter } from '@/features/daily/hooks/useDailySupportUserFilter';
import type { IUserMaster } from '@/features/users/types';
import { DISABILITY_SUPPORT_LEVEL_OPTIONS } from '@/features/users/typesExtended';
import { localAbcRecordRepository } from '@/infra/localStorage/localAbcRecordRepository';


import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import EventRoundedIcon from '@mui/icons-material/EventRounded';
import FilterListOffIcon from '@mui/icons-material/FilterListOff';
import PersonIcon from '@mui/icons-material/Person';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
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
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';

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
// ABC 記録データの取得
// ─────────────────────────────────────────────

interface AbcSummary {
  /** 利用者ごとの今日の件数 */
  todayCounts: Map<string, number>;
  /** 利用者ごとの最新記録日 */
  latestDates: Map<string, string>;
}

function useAbcSummary(): AbcSummary {
  const [summary, setSummary] = useState<AbcSummary>({
    todayCounts: new Map(),
    latestDates: new Map(),
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const all: AbcRecord[] = await localAbcRecordRepository.getAll();
        const today = new Date().toISOString().slice(0, 10);
        const todayCounts = new Map<string, number>();
        const latestDates = new Map<string, string>();

        for (const r of all) {
          // 今日の件数
          if (r.occurredAt.slice(0, 10) === today) {
            todayCounts.set(r.userId, (todayCounts.get(r.userId) ?? 0) + 1);
          }
          // 最新記録日
          const existing = latestDates.get(r.userId);
          if (!existing || r.occurredAt > existing) {
            latestDates.set(r.userId, r.occurredAt);
          }
        }
        if (mounted) setSummary({ todayCounts, latestDates });
      } catch {
        // localStorage 読み込み失敗は無視
      }
    })();
    return () => { mounted = false; };
  }, []);

  return summary;
}

// ─────────────────────────────────────────────
// 支援計画シート状態の取得
// ─────────────────────────────────────────────

function usePlanningSheetStatus(): Map<string, SupportPlanningSheet> {
  const [sheets, setSheets] = useState<Map<string, SupportPlanningSheet>>(new Map());

  useEffect(() => {
    let mounted = true;
    try {
      const raw = localStorage.getItem('planningSheet.versions.v1');
      if (!raw) return;
      const all: SupportPlanningSheet[] = JSON.parse(raw);
      const map = new Map<string, SupportPlanningSheet>();
      // 各ユーザーの最新の active 版を取得
      for (const s of all) {
        if (s.status === 'active' && s.isCurrent) {
          const existing = map.get(s.userId);
          if (!existing || s.version > (existing.version ?? 0)) {
            map.set(s.userId, s);
          }
        }
      }
      if (mounted) setSheets(map);
    } catch {
      // ignore
    }
    return () => { mounted = false; };
  }, []);

  return sheets;
}

// ─────────────────────────────────────────────
// User Card
// ─────────────────────────────────────────────

const UserCard: React.FC<{
  user: IUserMaster;
  unfilled?: number;
  abcTodayCount: number;
  isSelected: boolean;
  /** 計画未作成フラグ */
  hasPlan: boolean;
  /** モニタリングサイクル情報（null = 未設定） */
  monitoringCycle: MonitoringCycleResult | null;
  onSelect: (userId: string) => void;
}> = memo(({ user, unfilled, abcTodayCount, isSelected, hasPlan, monitoringCycle, onSelect }) => {
  const isHighIntensity = user.IsHighIntensitySupportTarget === true;
  const behaviorScore = user.BehaviorScore;
  const supportLevel = user.DisabilitySupportLevel;

  // モニタリング期限チップの表示判定
  const monitoringChip = useMemo(() => {
    if (!monitoringCycle) return null;
    const { remaining } = monitoringCycle;
    if (remaining <= 14) return { label: `会議まで${remaining}日`, color: 'error' as const };
    if (remaining <= 30) return { label: `会議まで${remaining}日`, color: 'warning' as const };
    return null; // 30日超は非表示
  }, [monitoringCycle]);

  return (
    <Card
      variant="outlined"
      sx={{
        transition: 'box-shadow 0.15s, border-color 0.15s',
        '&:hover': { borderColor: 'primary.main', boxShadow: 2 },
        ...(isSelected && {
          borderColor: 'primary.main',
          borderWidth: 2,
          boxShadow: 3,
        }),
        ...(!isSelected && isHighIntensity && {
          borderColor: 'warning.main',
          borderWidth: 1.5,
        }),
      }}
    >
      <CardActionArea
        onClick={() => onSelect(user.UserID)}
        sx={{ p: 1.5, display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 1 }}
        data-testid={`wizard-user-card-${user.UserID}`}
      >
        {/* Row 1: Name */}
        <Stack direction="row" alignItems="center" spacing={1}>
          <PersonIcon
            fontSize="small"
            sx={{ color: isSelected ? 'primary.main' : isHighIntensity ? 'warning.main' : 'action.active' }}
          />
          <Typography variant="subtitle2" fontWeight={700} noWrap sx={{ flex: 1 }}>
            {user.FullName}
          </Typography>
          {unfilled !== undefined && unfilled > 0 && (
            <Chip label={`残${unfilled}`} size="small" color="warning" variant="outlined" sx={{ fontSize: '0.7rem' }} />
          )}
        </Stack>

        {/* Row 2: Support Level + Behavior Score */}
        <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography variant="caption" color="text.secondary">
            {supportLevel || '区分未設定'}
          </Typography>
          {behaviorScore != null && (
            <>
              <Typography variant="caption" color="text.secondary">/</Typography>
              <Typography
                variant="caption"
                fontWeight={600}
                color={behaviorScore >= 10 ? 'error.main' : 'text.secondary'}
              >
                行動関連{behaviorScore}点
              </Typography>
            </>
          )}
        </Stack>

        {/* Row 3: Status Chips */}
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
          {isHighIntensity && (
            <Chip
              icon={<WarningAmberRoundedIcon />}
              label="強度行動障害"
              size="small"
              color="warning"
              variant="filled"
              sx={{ fontSize: '0.7rem', height: 22 }}
            />
          )}
          {!hasPlan && (
            <Chip
              icon={<BlockRoundedIcon />}
              label="計画未作成"
              size="small"
              color="error"
              variant="outlined"
              sx={{ fontSize: '0.7rem', height: 22 }}
            />
          )}
          {monitoringChip && (
            <Chip
              icon={<EventRoundedIcon />}
              label={monitoringChip.label}
              size="small"
              color={monitoringChip.color}
              variant="outlined"
              sx={{ fontSize: '0.7rem', height: 22 }}
            />
          )}
          {abcTodayCount > 0 ? (
            <Chip
              icon={<EditNoteRoundedIcon />}
              label={`ABC ${abcTodayCount}件`}
              size="small"
              color="info"
              variant="outlined"
              sx={{ fontSize: '0.7rem', height: 22 }}
            />
          ) : isHighIntensity && (
            <Chip
              label="今日未記録"
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.7rem', height: 22, color: 'text.secondary', borderColor: 'divider' }}
            />
          )}
        </Stack>
      </CardActionArea>
    </Card>
  );
});
UserCard.displayName = 'UserCard';



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
  const abcSummary = useAbcSummary();
  const planningSheets = usePlanningSheetStatus();

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
            const userMonitoringCycle = user.LastAssessmentDate
              ? computeMonitoringCycle(new Date(`${user.LastAssessmentDate}T00:00:00`), new Date())
              : null;
            return (
              <UserCard
                key={user.UserID}
                user={user}
                unfilled={unfilledCountMap?.get(user.UserID)}
                abcTodayCount={abcSummary.todayCounts.get(user.UserID) ?? 0}
                isSelected={false}
                hasPlan={planningSheets.has(user.UserID)}
                monitoringCycle={userMonitoringCycle}
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

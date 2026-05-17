import type { MonitoringDeadlineState } from '@/features/daily/components/MonitoringCountdown';
import type { IUserMaster } from '@/features/users/types';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import EventRoundedIcon from '@mui/icons-material/EventRounded';
import PersonIcon from '@mui/icons-material/Person';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React, { memo, useMemo } from 'react';

export type UserCardProps = {
  user: IUserMaster;
  unfilled?: number;
  abcTodayCount: number;
  isSelected: boolean;
  /** 計画未作成フラグ */
  hasPlan: boolean;
  /** モニタリングサイクル情報（null = 未設定） */
  monitoringDeadline: MonitoringDeadlineState | null;
  onSelect: (userId: string) => void;
};

export const UserCard: React.FC<UserCardProps> = memo(
  ({ user, unfilled, abcTodayCount, isSelected, hasPlan, monitoringDeadline, onSelect }) => {
    const isHighIntensity = user.IsHighIntensitySupportTarget === true;
    const behaviorScore = user.BehaviorScore;
    const supportLevel = user.DisabilitySupportLevel;

    // モニタリング期限チップの表示判定
    const monitoringChip = useMemo(() => {
      if (!monitoringDeadline || monitoringDeadline.remainingDays === null) return null;
      const remaining = monitoringDeadline.remainingDays;
      if (remaining <= 14) return { label: `期限まで${remaining}日`, color: 'error' as const };
      if (remaining <= 30) return { label: `期限まで${remaining}日`, color: 'warning' as const };
      return null; // 30日超は非表示
    }, [monitoringDeadline]);

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
              <Chip
                label={`残${unfilled}`}
                size="small"
                color="warning"
                variant="outlined"
                sx={{ fontSize: '0.7rem' }}
              />
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
            ) : (
              isHighIntensity && (
                <Chip
                  label="今日未記録"
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.7rem', height: 22, color: 'text.secondary', borderColor: 'divider' }}
                />
              )
            )}
          </Stack>
        </CardActionArea>
      </Card>
    );
  },
);

UserCard.displayName = 'UserCard';

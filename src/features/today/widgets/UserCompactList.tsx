import { motionTokens } from '@/app/theme';
import type { UserStatusType } from '@/features/schedules/domain/mappers/userStatus';
import { USER_STATUS_LABELS } from '@/features/schedules/domain/mappers/userStatus';
import BubbleChartIcon from '@mui/icons-material/BubbleChart';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditNoteIcon from '@mui/icons-material/EditNote';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import GroupOffIcon from '@mui/icons-material/GroupOff';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import { Box, Button, Chip, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material';
import React, { useMemo, useState } from 'react';
import { EmptyStateBlock } from './EmptyStateBlock';
import type { UserAlert } from '../domain/buildUserAlerts';

/** 初期表示件数 — 未記録優先で上位 n 件を表示 */
const INITIAL_DISPLAY_COUNT = 6;

export type UserRow = {
  userId: string;
  name: string;
  status: 'present' | 'absent' | 'unknown';
  recordFilled?: boolean;
  /** 直近の注意点（buildUserAlerts で算出。未設定時は非表示） */
  alerts?: UserAlert[];
  /** Phase 8-A: 利用者状態種別（登録済みの場合） */
  userStatusType?: UserStatusType;
};

export type UserCompactListProps = {
  items: UserRow[];
  onOpenQuickRecord: (id: string) => void;
  onOpenISP?: (id: string) => void;
  /** Iceberg PDCA 行動分析への導線 */
  onOpenIceberg?: (id: string) => void;
  /** アラートチップクリック → daily/support 直行（未設定時はカード全体と同じ動作） */
  onAlertClick?: (userId: string) => void;
  /** Phase 8-A: 利用者状態登録ダイアログを開く */
  onOpenUserStatus?: (userId: string, userName: string, statusType: UserStatusType) => void;
  /** zero-users 時の弱いCTA（スケジュール確認等） */
  onEmptyAction?: () => void;
};

// rerender-memo: memoized row to avoid full-list re-renders
const UserCompactRow = React.memo<{
  user: UserRow;
  onOpenQuickRecord: (id: string) => void;
  onOpenISP?: (id: string) => void;
  onOpenIceberg?: (id: string) => void;
  onAlertClick?: (userId: string) => void;
  onOpenUserStatus?: (userId: string, userName: string, statusType: UserStatusType) => void;
}>(function UserCompactRow({ user, onOpenQuickRecord, onOpenISP, onOpenIceberg, onAlertClick, onOpenUserStatus }) {
  const hasAlerts = user.alerts && user.alerts.length > 0;
  const needsAttention = !user.recordFilled && user.status !== 'absent';
  const isAbsent = user.status === 'absent';

  return (
    <Paper
      key={user.userId}
      role="button"
      tabIndex={0}
      onClick={() => onOpenQuickRecord(user.userId)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenQuickRecord(user.userId);
        }
      }}
      sx={{
        p: 1.5,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        cursor: 'pointer',
        minHeight: 44, // タップ領域確保 (PR3要件)
        transition: motionTokens.transition.bgColor,
        '&:hover, &:focus-visible': { bgcolor: 'action.hover' },
        outline: 'none',
        // 注意ハイライト: 未記録ユーザー
        ...(needsAttention && {
          borderLeft: 3,
          borderColor: 'warning.main',
          bgcolor: 'rgba(255, 152, 0, 0.04)',
        }),
        // 欠席ユーザー
        ...(isAbsent && {
          opacity: 0.6,
          borderLeft: 3,
          borderColor: 'error.light',
        }),
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {/* ステータスアイコン: 記録済み / 未記録 / 欠席 */}
        {user.recordFilled ? (
          <CheckCircleIcon
            sx={{ fontSize: 18, color: 'success.main' }}
            aria-label="記録済み"
          />
        ) : isAbsent ? (
          <ErrorOutlineIcon
            sx={{ fontSize: 18, color: 'error.main' }}
            aria-label="欠席"
          />
        ) : (
          <RadioButtonUncheckedIcon
            sx={{ fontSize: 18, color: 'warning.main' }}
            aria-label="未記録"
          />
        )}
        <Box>
          <Typography
            variant="body1"
            fontWeight={user.recordFilled ? 400 : 600}
            sx={user.recordFilled ? { color: 'text.secondary' } : undefined}
          >
            {user.name}
          </Typography>
          {/* 直近注意点チップ（最大2件） */}
          {hasAlerts && (
            <Box sx={{ display: 'flex', gap: 0.5, mt: 0.25, flexWrap: 'wrap' }}>
              {user.alerts!.map((alert, idx) => (
                <Chip
                  key={idx}
                  label={alert.label}
                  size="small"
                  color={alert.severity === 'warning' ? 'warning' : 'default'}
                  variant={alert.severity === 'warning' ? 'filled' : 'outlined'}
                  clickable={!!onAlertClick}
                  onClick={onAlertClick ? (e) => {
                    e.stopPropagation();
                    onAlertClick(user.userId);
                  } : undefined}
                  data-testid={`user-alert-${user.userId}-${idx}`}
                  sx={{
                    height: 20,
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    '& .MuiChip-label': { px: 0.75 },
                    ...(onAlertClick && {
                      cursor: 'pointer',
                      '&:hover': { transform: 'scale(1.05)' },
                      transition: 'transform 0.15s ease',
                    }),
                  }}
                />
              ))}
            </Box>
          )}
          {/* Phase 8-A: 利用者状態バッジ */}
          {user.userStatusType && (
            <Chip
              size="small"
              label={USER_STATUS_LABELS[user.userStatusType]}
              color={user.userStatusType === 'absence' || user.userStatusType === 'preAbsence' ? 'error' : 'warning'}
              variant="outlined"
              sx={{ height: 20, fontSize: '0.65rem', ml: 0.5 }}
              data-testid={`user-status-badge-${user.userId}`}
            />
          )}
        </Box>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {onOpenISP ? (
          <Tooltip title="個別支援計画">
            <IconButton
              size="small"
              color="primary"
              onClick={(e) => { e.stopPropagation(); onOpenISP(user.userId); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation(); }}
              aria-label={`${user.name}の個別支援計画を確認`}
              sx={{ minHeight: 44, minWidth: 44, bgcolor: 'primary.50', '&:hover': { bgcolor: 'primary.100' } }}
            >
              <EditNoteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : null}
        {/* Phase 8-A: 利用者状態クイックアクション */}
        {onOpenUserStatus && !isAbsent && (
          <>
            <Tooltip title="欠席を入力">
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); onOpenUserStatus(user.userId, user.name, 'absence'); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation(); }}
                aria-label={`${user.name}の欠席を入力`}
                data-testid={`user-status-absence-${user.userId}`}
                sx={{
                  minHeight: 36, minWidth: 36, fontSize: '0.7rem',
                  color: 'error.main',
                  border: '1px solid',
                  borderColor: 'error.light',
                  '&:hover': { bgcolor: 'error.50' },
                }}
              >
                ❌
              </IconButton>
            </Tooltip>
            <Tooltip title="遅刻を入力">
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); onOpenUserStatus(user.userId, user.name, 'late'); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation(); }}
                aria-label={`${user.name}の遅刻を入力`}
                data-testid={`user-status-late-${user.userId}`}
                sx={{
                  minHeight: 36, minWidth: 36, fontSize: '0.7rem',
                  color: 'warning.main',
                  border: '1px solid',
                  borderColor: 'warning.light',
                  '&:hover': { bgcolor: 'warning.50' },
                }}
              >
                🕐
              </IconButton>
            </Tooltip>
          </>
        )}
        {onOpenIceberg ? (
          <Tooltip title="行動分析（Iceberg PDCA）">
            <IconButton
              size="small"
              color="secondary"
              onClick={(e) => { e.stopPropagation(); onOpenIceberg(user.userId); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation(); }}
              aria-label={`${user.name}の行動分析`}
              data-testid={`iceberg-analysis-${user.userId}`}
              sx={{ minHeight: 44, minWidth: 44, bgcolor: 'secondary.50', '&:hover': { bgcolor: 'secondary.100' } }}
            >
              <BubbleChartIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : null}
        <Button
          size="small"
          variant={user.recordFilled ? 'outlined' : 'contained'}
          color={user.recordFilled ? 'inherit' : 'primary'}
          tabIndex={-1}
          sx={{ minHeight: 44, pointerEvents: 'none', fontWeight: user.recordFilled ? 400 : 700 }}
        >
          {user.recordFilled ? '記録済' : '記録する'}
        </Button>
      </Box>
    </Paper>
  );
});

export const UserCompactList: React.FC<UserCompactListProps> = ({ items, onOpenQuickRecord, onOpenISP, onOpenIceberg, onAlertClick, onOpenUserStatus, onEmptyAction }) => {
  const [expanded, setExpanded] = useState(false);

  // 未記録を先頭に並べる（元の順序を保ちつつ）
  const sorted = useMemo(() => {
    const unfilled = items.filter((u) => !u.recordFilled);
    const filled = items.filter((u) => u.recordFilled);
    return [...unfilled, ...filled];
  }, [items]);

  const needsFold = sorted.length > INITIAL_DISPLAY_COUNT;
  const visible = expanded || !needsFold ? sorted : sorted.slice(0, INITIAL_DISPLAY_COUNT);
  const hiddenCount = sorted.length - INITIAL_DISPLAY_COUNT;

  if (items.length === 0) {
    return (
      <EmptyStateBlock
        icon={<GroupOffIcon />}
        title="本日の通所予定はありません"
        description="共有事項や明日の予定を確認できます。"
        primaryAction={
          onEmptyAction
            ? { label: 'スケジュールを確認', onClick: onEmptyAction, testId: 'today-empty-users-cta' }
            : undefined
        }
        testId="today-empty-users"
      />
    );
  }

  const unfilledCount = sorted.filter(u => !u.recordFilled).length;

  return (
    <Stack spacing={1}>
      {/* 未記録サマリー: 未記録者がいるときだけ表示 */}
      {unfilledCount > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1 }}>
          <Chip
            label={`✏️ 未記録 ${unfilledCount}名 / 全 ${sorted.length}名`}
            color="warning"
            size="small"
            variant="filled"
          />
          <Typography variant="caption" color="text.secondary">
            あと{unfilledCount}名で完了
          </Typography>
        </Box>
      )}
      {visible.map((u) => (
        <UserCompactRow
          key={u.userId}
          user={u}
          onOpenQuickRecord={onOpenQuickRecord}
          onOpenISP={onOpenISP}
          onOpenIceberg={onOpenIceberg}
          onAlertClick={onAlertClick}
          onOpenUserStatus={onOpenUserStatus}
        />
      ))}
      {needsFold && (
        <Button
          size="small"
          variant="text"
          onClick={() => setExpanded((prev) => !prev)}
          startIcon={expanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          data-testid="users-show-more"
          sx={{
            textTransform: 'none',
            fontSize: '0.8rem',
            color: 'text.secondary',
            alignSelf: 'center',
            mt: 0.5,
          }}
        >
          {expanded ? '折りたたむ' : `他 ${hiddenCount} 名を表示`}
        </Button>
      )}
    </Stack>
  );
};

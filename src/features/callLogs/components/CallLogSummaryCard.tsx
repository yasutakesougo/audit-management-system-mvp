/**
 * CallLogSummaryCard — Today ページ用 電話ログ未対応件数カード
 *
 * 責務:
 * - 未対応 / 至急 / 折返し待ち の件数を BentoCard で表示
 * - クリックで /call-logs へ遷移
 * - 「受電ログ」ボタンで CallLogQuickDrawer を開ける
 *
 * 設計:
 * - データは props で受け取るだけ（hook を持たない）
 * - 全件0 なら「異常なし」の緑 empty state を表示
 * - window.confirm 不使用
 */

import PhoneIcon from '@mui/icons-material/Phone';
import PhoneCallbackIcon from '@mui/icons-material/PhoneCallback';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import AddIcCallIcon from '@mui/icons-material/AddIcCall';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
  Box,
  ButtonBase,
  Chip,
  CircularProgress,
  Fade,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import React from 'react';

// ─── Props ────────────────────────────────────────────────────────────────────

export type CallLogSummaryCardProps = {
  /** 全未対応件数 */
  openCount: number;
  /** 至急かつ未対応の件数 */
  urgentCount: number;
  /** 折返し待ち件数 */
  callbackPendingCount: number;
  /** 自分宛未対応件数（未指定 or 0 の場合はタイル非表示） */
  myOpenCount?: number;
  /** 折返し期限超過件数（未指定 or 0 の場合はタイル非表示） */
  overdueCount?: number;
  /** データ取得中かどうか */
  isLoading: boolean;
  /** /call-logs への遷移 */
  onNavigate: () => void;
  /** CallLogQuickDrawer を開く */
  onOpenDrawer: () => void;
};

// ─── SubCount Card ────────────────────────────────────────────────────────────

type CountTileProps = {
  icon: React.ReactNode;
  label: string;
  count: number;
  color: 'error' | 'warning' | 'info' | 'success' | 'primary';
  testId: string;
};

const CountTile: React.FC<CountTileProps> = ({ icon, label, count, color, testId }) => (
  <Box
    data-testid={testId}
    sx={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 0.5,
      py: 1.5,
      px: 1,
      borderRadius: 2,
      border: '1px solid',
      borderColor: count > 0 ? `${color}.main` : 'divider',
      bgcolor: count > 0 ? `${color}.main` : 'transparent',
      ...(count > 0 && { bgcolor: 'transparent' }),
    }}
  >
    <Box sx={{ color: count > 0 ? `${color}.main` : 'text.disabled', display: 'flex' }}>
      {icon}
    </Box>
    <Chip
      label={count}
      size="small"
      color={count > 0 ? color : 'default'}
      variant={count > 0 ? 'filled' : 'outlined'}
      sx={{ fontWeight: 700, fontSize: '0.9rem', minWidth: 32 }}
    />
    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
      {label}
    </Typography>
  </Box>
);

// ─── Component ────────────────────────────────────────────────────────────────

export const CallLogSummaryCard: React.FC<CallLogSummaryCardProps> = ({
  openCount,
  urgentCount,
  callbackPendingCount,
  myOpenCount,
  overdueCount,
  isLoading,
  onNavigate,
  onOpenDrawer,
}) => {
  const allClear = openCount === 0 && !isLoading;

  return (
    <Fade in timeout={300}>
      <Box data-testid="call-log-summary-card">
        {/* ヘッダー */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
          <Typography
            variant="overline"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: 'text.secondary',
              fontSize: '0.7rem',
            }}
          >
            <PhoneIcon sx={{ fontSize: 14 }} /> 電話・連絡ログ
          </Typography>

          {/* 受電登録ボタン（グローバル Quick Action と同じ Drawer を開く） */}
          <Tooltip title="受電ログを新規登録">
            <IconButton
              size="small"
              onClick={onOpenDrawer}
              color="primary"
              data-testid="call-log-summary-open-drawer"
              aria-label="電話ログを新規受付"
            >
              <AddIcCallIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>

        {/* ローディング */}
        {isLoading && (
          <Box display="flex" justifyContent="center" py={2} data-testid="call-log-summary-loading">
            <CircularProgress size={20} />
          </Box>
        )}

        {/* 全件完了 */}
        {allClear && (
          <Box
            display="flex"
            alignItems="center"
            gap={1}
            py={1.5}
            data-testid="call-log-summary-all-clear"
          >
            <Typography sx={{ fontSize: 20 }}>✅</Typography>
            <Typography variant="body2" color="success.main" fontWeight={600}>
              未対応ログなし
            </Typography>
          </Box>
        )}

        {/* 件数グリッド */}
        {!isLoading && !allClear && (
          <ButtonBase
            onClick={onNavigate}
            sx={{ display: 'block', width: '100%', textAlign: 'left', borderRadius: 2 }}
            aria-label="電話ログ一覧を表示"
            data-testid="call-log-summary-navigate"
          >
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <CountTile
                icon={<PhoneIcon fontSize="small" />}
                label="未対応"
                count={openCount}
                color="warning"
                testId="call-log-summary-open-count"
              />
              <CountTile
                icon={<ErrorOutlineIcon fontSize="small" />}
                label="至急"
                count={urgentCount}
                color="error"
                testId="call-log-summary-urgent-count"
              />
              <CountTile
                icon={<PhoneCallbackIcon fontSize="small" />}
                label="折返し待ち"
                count={callbackPendingCount}
                color="info"
                testId="call-log-summary-callback-count"
              />
              {/* 自分宛: 0 件時はノイズ防止のため非表示 */}
              {myOpenCount != null && myOpenCount > 0 && (
                <CountTile
                  icon={<PersonOutlineIcon fontSize="small" />}
                  label="自分宛"
                  count={myOpenCount}
                  color="primary"
                  testId="call-log-summary-my-count"
                />
              )}
              {/* 期限超過: 0 件時は非表示。至急タイルと色相を分けるため warning */}
              {overdueCount != null && overdueCount > 0 && (
                <CountTile
                  icon={<WarningAmberIcon fontSize="small" />}
                  label="期限超過"
                  count={overdueCount}
                  color="warning"
                  testId="call-log-summary-overdue-count"
                />
              )}
            </Stack>
          </ButtonBase>
        )}
      </Box>
    </Fade>
  );
};

export default CallLogSummaryCard;

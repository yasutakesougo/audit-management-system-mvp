/**
 * SpHealthPopover — SharePoint 制約詳細ポップオーバー
 *
 * SpHealthBadge のクリックで開き、現在の最重要シグナルを詳細表示する。
 * - 何が起きているか (reasonCode / listName)
 * - 何回続いているか (occurrenceCount)
 * - 発生源 (Nightly / Realtime)
 * - どこへ飛べばよいか (actionUrl / actionType)
 *
 * ConnectionStatus は変更しない。本コンポーネントは SpHealthBadge のみが使用する。
 */

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Popover from '@mui/material/Popover';
import TerminalIcon from '@mui/icons-material/Terminal';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import type {
  SpHealthActionType,
  SpHealthReasonCode,
  SpHealthSeverity,
  SpHealthSignal,
} from '@/features/sp/health/spHealthSignalStore';

// ─── Display maps ─────────────────────────────────────────────────────────────

const SEVERITY_LABEL: Record<SpHealthSeverity, string> = {
  watch: 'Observation',
  warning: 'Watch',
  action_required: 'Action Required',
  critical: 'Critical',
};

const REASON_LABEL: Record<SpHealthReasonCode, string> = {
  sp_index_pressure: 'インデックス逼迫',
  sp_limit_reached: '容量上限到達',
  sp_bootstrap_blocked: 'プロビジョニング停止',
  sp_auth_failed: '認証エラー',
  sp_list_unreachable: 'リスト到達不能',
  sp_schema_drift: 'スキーマ乖離',
  sp_gate_escape_hatch: 'ゲート確認スキップ',
};

const SOURCE_LABEL: Record<string, string> = {
  nightly_patrol: 'Nightly Patrol',
  realtime: 'Realtime',
};

// ─── Action button ────────────────────────────────────────────────────────────

interface ActionButtonProps {
  actionUrl: string;
  actionType: SpHealthActionType;
  onClose: () => void;
}

const ActionButton: React.FC<ActionButtonProps> = ({ actionUrl, actionType, onClose }) => {
  if (actionType === 'internal') {
    return (
      <Button
        component={RouterLink}
        to={actionUrl}
        variant="contained"
        size="small"
        onClick={onClose}
        sx={{ mt: 1 }}
      >
        解決策を開く →
      </Button>
    );
  }
  return (
    <Button
      component="a"
      href={actionUrl}
      target="_blank"
      rel="noopener noreferrer"
      variant="contained"
      size="small"
      sx={{ mt: 1 }}
    >
      解決策を開く ↗
    </Button>
  );
};

// ─── Popover ─────────────────────────────────────────────────────────────────

interface SpHealthPopoverProps {
  anchorEl: HTMLElement | null;
  signal: SpHealthSignal;
  onClose: () => void;
}

export const SpHealthPopover: React.FC<SpHealthPopoverProps> = ({
  anchorEl,
  signal,
  onClose,
}) => {
  const theme = useTheme();
  const open = Boolean(anchorEl);

  const severityColor: Record<SpHealthSeverity, string> = {
    watch: theme.palette.info.main,
    warning: theme.palette.warning.main,
    action_required: theme.palette.warning.dark,
    critical: theme.palette.error.main,
  };

  const color = severityColor[signal.severity];

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      slotProps={{
        paper: {
          sx: {
            width: 320,
            p: 2,
            borderTop: `3px solid ${color}`,
          },
        },
      }}
    >
      {/* Title row */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Chip
          label={SEVERITY_LABEL[signal.severity]}
          size="small"
          sx={{
            background: color,
            color: theme.palette.getContrastText(color),
            fontWeight: 700,
            fontSize: 11,
          }}
        />
        <Typography variant="subtitle2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
          {REASON_LABEL[signal.reasonCode]}
        </Typography>
      </Box>

      <Divider sx={{ mb: 1.5 }} />

      {/* Meta row */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 1.5 }}>
        {signal.listName && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 64 }}>
              リスト
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 500, wordBreak: 'break-all' }}>
              {signal.listName}
            </Typography>
          </Box>
        )}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 64 }}>
            検知元
          </Typography>
          <Typography variant="caption" sx={{ fontWeight: 500 }}>
            {SOURCE_LABEL[signal.source] ?? signal.source}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 64 }}>
            検知数
          </Typography>
          <Typography
            variant="caption"
            sx={{ fontWeight: 700, color: signal.occurrenceCount >= 3 ? color : 'text.primary' }}
          >
            {signal.occurrenceCount}回
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 64 }}>
            最終検知
          </Typography>
          <Typography variant="caption">
            {signal.occurredAt.slice(0, 16).replace('T', ' ')}
          </Typography>
        </Box>
      </Box>

      {/* Message */}
      <Typography
        variant="body2"
        sx={{ mb: 1, color: 'text.secondary', fontSize: 12, lineHeight: 1.5 }}
      >
        {signal.message}
      </Typography>

      {/* Remediation hint */}
      {signal.remediation && (
        <Box sx={{ mb: 1.5 }}>
          <Chip
            size="small"
            variant="outlined"
            icon={<TerminalIcon sx={{ fontSize: '12px !important' }} />}
            label="修復コマンドあり"
            sx={{
              height: 20,
              fontSize: '0.65rem',
              fontWeight: 700,
              color: 'primary.main',
              borderColor: 'primary.light',
              bgcolor: 'primary.50',
            }}
          />
        </Box>
      )}

      {/* Action guide */}
      {signal.actionGuide && (
        <Typography
          variant="body2"
          sx={{
            mb: 1,
            px: 1,
            py: 0.75,
            bgcolor: 'action.hover',
            borderRadius: 1,
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          {signal.actionGuide}
        </Typography>
      )}

      {/* Action button */}
      {signal.actionUrl && signal.actionType && (
        <ActionButton
          actionUrl={signal.actionUrl}
          actionType={signal.actionType}
          onClose={onClose}
        />
      )}
    </Popover>
  );
};

export default SpHealthPopover;

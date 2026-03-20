/**
 * UserStatusQuickDialog — 利用者状態の Quick 入力ダイアログ
 *
 * Today / Handoff / Schedule の3入口から共通で呼ばれる。
 * 最小限の入力で利用者状態（遅刻・早退・欠席・事前欠席）を登録する。
 *
 * 入力項目:
 *   - 利用者（プリセット）
 *   - 状態種別（プリセット or 選択）
 *   - 日付（プリセット：今日）
 *   - 備考（任意）
 *   - 時刻（遅刻の場合のみ任意入力）
 *
 * @see Phase 8-A: Today/Handoff からの利用者状態登録
 */

import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';

import { USER_STATUS_LABELS, USER_STATUS_TYPES, type UserStatusType } from '../domain/userStatus';
import type { UserStatusInput, UseUserStatusActionsReturn } from '../hooks/useUserStatusActions';
import type { UserStatusSource } from '../domain/userStatus';
import type { UserStatusRecord } from '../domain/userStatus';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type UserStatusQuickDialogProps = {
  /** ダイアログの開閉状態 */
  open: boolean;
  /** 閉じるコールバック */
  onClose: () => void;

  /** プリセット: 利用者 ID（必須） */
  userId: string;
  /** プリセット: 利用者名 */
  userName: string;
  /** プリセット: 状態種別（ボタン押下から来た場合） */
  initialStatusType?: UserStatusType;
  /** プリセット: 入力元 */
  source: UserStatusSource;
  /** プリセット: 備考（申し送り文面の引き継ぎ等） */
  initialNote?: string;
  /** プリセット: 申し送り ID（Handoff 起点） */
  handoffId?: number;

  /** useUserStatusActions から注入される actions */
  actions: Pick<
    UseUserStatusActionsReturn,
    'createOrUpdate' | 'findExisting' | 'isSubmitting' | 'error'
  >;

  /** 登録成功時コールバック */
  onSuccess?: (message: string) => void;
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Status Type UI Metadata
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const STATUS_EMOJI: Record<UserStatusType, string> = {
  late: '🕐',
  earlyLeave: '🏃',
  absence: '❌',
  preAbsence: '📅',
};

const STATUS_COLORS: Record<UserStatusType, 'warning' | 'error' | 'info'> = {
  late: 'warning',
  earlyLeave: 'warning',
  absence: 'error',
  preAbsence: 'info',
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Component
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const UserStatusQuickDialog: React.FC<UserStatusQuickDialogProps> = ({
  open,
  onClose,
  userId,
  userName,
  initialStatusType,
  source,
  initialNote = '',
  handoffId,
  actions,
  onSuccess,
}) => {
  // ─── Local State ──────────────────────────────────────────────
  const [statusType, setStatusType] = useState<UserStatusType>(
    initialStatusType ?? 'absence',
  );
  const [note, setNote] = useState(initialNote);
  const [time, setTime] = useState('');

  // Reset when dialog opens with new props
  useEffect(() => {
    if (open) {
      setStatusType(initialStatusType ?? 'absence');
      setNote(initialNote);
      setTime('');
    }
  }, [open, initialStatusType, initialNote]);

  // ─── Check existing status ───────────────────────────────────
  const existingStatus: UserStatusRecord | null = actions.findExisting(userId);

  // ─── Handlers ─────────────────────────────────────────────────
  const handleStatusChange = useCallback(
    (_: React.MouseEvent<HTMLElement>, value: UserStatusType | null) => {
      if (value) setStatusType(value);
    },
    [],
  );

  const handleSubmit = useCallback(async () => {
    const input: UserStatusInput = {
      userId,
      userName,
      statusType,
      source,
      note: note.trim() || undefined,
      time: time.trim() || undefined,
      handoffId,
    };

    await actions.createOrUpdate(input);

    if (!actions.error) {
      const label = USER_STATUS_LABELS[statusType];
      const msg = existingStatus
        ? `${userName}の状態を「${label}」に更新しました`
        : `${userName}を「${label}」として登録しました`;
      onSuccess?.(msg);
      onClose();
    }
  }, [
    userId, userName, statusType, source, note, time, handoffId,
    actions, existingStatus, onSuccess, onClose,
  ]);

  const showTimeField = statusType === 'late';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      data-testid="user-status-quick-dialog"
    >
      <DialogTitle
        sx={{
          pb: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <Typography component="span" sx={{ fontSize: '1.2rem' }}>
          📋
        </Typography>
        利用者の状態を登録
      </DialogTitle>

      <DialogContent sx={{ pb: 1 }}>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {/* ── 利用者情報 ── */}
          <Typography
            variant="body1"
            sx={{ fontWeight: 600 }}
            data-testid="user-status-user-name"
          >
            👤 {userName}
          </Typography>

          {/* ── 既存状態の警告 ── */}
          {existingStatus && (
            <Alert
              severity="info"
              variant="outlined"
              sx={{ py: 0.5, fontSize: '0.82rem' }}
              data-testid="user-status-existing-warning"
            >
              現在「{USER_STATUS_LABELS[existingStatus.statusType]}」が登録済みです。
              {statusType !== existingStatus.statusType
                ? `「${USER_STATUS_LABELS[statusType]}」に変更します。`
                : '内容を更新します。'}
            </Alert>
          )}

          {/* ── 状態種別選択 ── */}
          <ToggleButtonGroup
            value={statusType}
            exclusive
            onChange={handleStatusChange}
            fullWidth
            size="small"
            data-testid="user-status-type-selector"
          >
            {USER_STATUS_TYPES.map((type) => (
              <ToggleButton
                key={type}
                value={type}
                data-testid={`user-status-btn-${type}`}
                sx={{
                  textTransform: 'none',
                  fontWeight: statusType === type ? 700 : 400,
                  fontSize: '0.82rem',
                  py: 1,
                }}
              >
                {STATUS_EMOJI[type]} {USER_STATUS_LABELS[type]}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          {/* ── 時刻（遅刻のみ） ── */}
          {showTimeField && (
            <TextField
              label="到着予定時刻"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              size="small"
              InputLabelProps={{ shrink: true }}
              data-testid="user-status-time-input"
              sx={{ maxWidth: 200 }}
            />
          )}

          {/* ── 備考 ── */}
          <TextField
            label="備考"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            multiline
            minRows={2}
            maxRows={4}
            size="small"
            placeholder="保護者からの連絡内容など"
            data-testid="user-status-note-input"
          />

          {/* ── エラー表示 ── */}
          {actions.error && (
            <Alert
              severity="error"
              sx={{ fontSize: '0.82rem' }}
              data-testid="user-status-error"
            >
              {actions.error}
            </Alert>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={onClose}
          disabled={actions.isSubmitting}
          data-testid="user-status-cancel-btn"
        >
          キャンセル
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={actions.isSubmitting || !userId}
          color={STATUS_COLORS[statusType]}
          data-testid="user-status-submit-btn"
          sx={{ minWidth: 100, fontWeight: 600 }}
        >
          {actions.isSubmitting
            ? '登録中…'
            : existingStatus
              ? '更新'
              : '登録'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

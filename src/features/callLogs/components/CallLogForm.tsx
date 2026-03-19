/**
 * CallLogForm — 電話ログ入力フォーム
 *
 * 責務:
 * - フォームの入力 UI
 * - Zod ベースのクライアントサイドバリデーション
 * - onSubmit(values) の呼び出し
 *
 * 持たない責務:
 * - Drawer / Dialog の開閉制御
 * - Repository 呼び出し
 * - ルーティング
 *
 * 受電日時・受付者名・status は submit 側（CallLogQuickDrawer）で付与する。
 */

import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormLabel,
  InputAdornment,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { CreateCallLogInput } from '@/domain/callLogs/schema';
import { CreateCallLogInputSchema } from '@/domain/callLogs/schema';
import type { IUserMaster } from '@/features/users/types';

// ─── 型 ─────────────────────────────────────────────────────────────────────

/** フォームが扱う入力値（全フィールドを optional にして初期空を許容） */
export type CallLogFormValues = {
  callerName: string;
  callerOrg: string;
  targetStaffName: string;
  subject: string;
  message: string;
  needCallback: boolean;
  urgency: 'normal' | 'today' | 'urgent';
  callbackDueAt: string;
  relatedUserId: string;
  relatedUserName: string;
};

export type CallLogFormProps = {
  initialValues?: Partial<CallLogFormValues>;
  isSubmitting?: boolean;
  onSubmit: (values: CreateCallLogInput) => void;
  onCancel?: () => void;
  /** フォームの dirty 状態が変わったときに通知するコールバック */
  onIsDirtyChange?: (isDirty: boolean) => void;
  /** 利用者マスタ候補リスト（外部から注入して依存分離） */
  users?: IUserMaster[];
};

// ─── 初期値 ──────────────────────────────────────────────────────────────────

const DEFAULT_VALUES: CallLogFormValues = {
  callerName: '',
  callerOrg: '',
  targetStaffName: '',
  subject: '',
  message: '',
  needCallback: false,
  urgency: 'normal',
  callbackDueAt: '',
  relatedUserId: '',
  relatedUserName: '',
};

// ─── Component ────────────────────────────────────────────────────────────────

export const CallLogForm: React.FC<CallLogFormProps> = ({
  initialValues,
  isSubmitting = false,
  onSubmit,
  onCancel,
  onIsDirtyChange,
  users = [],
}) => {
  // マウント時の初期値を固定（比較の基準として変えない）
  const mergedInitial = useMemo<CallLogFormValues>(
    () => ({ ...DEFAULT_VALUES, ...initialValues }),
    [], // 意図的に初回のみ計算
  );

  const [values, setValues] = useState<CallLogFormValues>(mergedInitial);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof CallLogFormValues, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);

  // ── dirty 判定 ─────────────────────────────────────────────────────────────
  // 初期値との差分があれば dirty とみなす
  const isDirty = useMemo(() => {
    return (Object.keys(mergedInitial) as (keyof CallLogFormValues)[]).some(
      (key) => values[key] !== mergedInitial[key],
    );
  }, [values, mergedInitial]);

  // dirty 変化を親（CallLogQuickDrawer）へ通知
  useEffect(() => {
    onIsDirtyChange?.(isDirty);
  }, [isDirty, onIsDirtyChange]);

  // ── フィールド更新ヘルパー ──────────────────────────────────────────────────

  const set = useCallback(<K extends keyof CallLogFormValues>(key: K, value: CallLogFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  // ── 利用者選択ヘルパー ──────────────────────────────────────────────────────

  /** Autocomplete で選択された利用者 */
  const selectedUser = useMemo(() => {
    if (!values.relatedUserId) return null;
    return users.find((u) => u.UserID === values.relatedUserId) ?? null;
  }, [values.relatedUserId, users]);

  const handleUserChange = useCallback(
    (_: unknown, user: IUserMaster | null) => {
      set('relatedUserId', user?.UserID ?? '');
      set('relatedUserName', user?.FullName ?? '');
    },
    [set],
  );

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const input: Record<string, unknown> = {
      callerName: values.callerName.trim(),
      callerOrg: values.callerOrg.trim() || undefined,
      targetStaffName: values.targetStaffName.trim(),
      subject: values.subject.trim(),
      message: values.message.trim(),
      needCallback: values.needCallback,
      urgency: values.urgency,
      callbackDueAt: values.callbackDueAt.trim() || undefined,
      relatedUserId: values.relatedUserId || undefined,
      relatedUserName: values.relatedUserName || undefined,
    };

    const result = CreateCallLogInputSchema.safeParse(input);

    if (!result.success) {
      const errors: Partial<Record<keyof CallLogFormValues, string>> = {};
      for (const issue of result.error.issues) {
        const path = issue.path[0] as keyof CallLogFormValues | undefined;
        if (path) {
          errors[path] = issue.message;
        }
      }
      setFieldErrors(errors);
      // フォーカスを最初のエラーフィールドに移動（a11y）
      const firstErrorKey = Object.keys(errors)[0];
      if (firstErrorKey) {
        const el = document.getElementById(`call-log-form-${firstErrorKey}`);
        el?.focus();
      }
      return;
    }

    try {
      onSubmit(result.data);
    } catch {
      setFormError('送信中にエラーが発生しました。しばらく待ってから再試行してください。');
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      noValidate
      data-testid="call-log-form"
      sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2 }}
    >
      {formError && (
        <Alert severity="error" data-testid="call-log-form-error">
          {formError}
        </Alert>
      )}

      {/* 発信者名 */}
      <TextField
        id="call-log-form-callerName"
        label="発信者名"
        required
        value={values.callerName}
        onChange={(e) => set('callerName', e.target.value)}
        error={!!fieldErrors.callerName}
        helperText={fieldErrors.callerName}
        size="small"
        inputProps={{ 'data-testid': 'call-log-form-caller-name' }}
        disabled={isSubmitting}
        autoFocus
      />

      {/* 所属 */}
      <TextField
        id="call-log-form-callerOrg"
        label="所属・機関"
        value={values.callerOrg}
        onChange={(e) => set('callerOrg', e.target.value)}
        size="small"
        inputProps={{ 'data-testid': 'call-log-form-caller-org' }}
        disabled={isSubmitting}
      />

      {/* 担当者名 */}
      <TextField
        id="call-log-form-targetStaffName"
        label="対象担当者"
        required
        value={values.targetStaffName}
        onChange={(e) => set('targetStaffName', e.target.value)}
        error={!!fieldErrors.targetStaffName}
        helperText={fieldErrors.targetStaffName}
        size="small"
        inputProps={{ 'data-testid': 'call-log-form-target-staff' }}
        disabled={isSubmitting}
      />

      {/* 件名 */}
      <TextField
        id="call-log-form-subject"
        label="件名"
        required
        value={values.subject}
        onChange={(e) => set('subject', e.target.value)}
        error={!!fieldErrors.subject}
        helperText={fieldErrors.subject}
        size="small"
        inputProps={{ 'data-testid': 'call-log-form-subject' }}
        disabled={isSubmitting}
      />

      {/* 関連利用者 */}
      <Autocomplete
        id="call-log-form-relatedUser"
        options={users}
        getOptionLabel={(u) => u.FullName + (u.Furigana ? ` (${u.Furigana})` : '')}
        getOptionKey={(u) => u.UserID}
        value={selectedUser}
        onChange={handleUserChange}
        isOptionEqualToValue={(opt, val) => opt.UserID === val.UserID}
        disabled={isSubmitting}
        noOptionsText="該当する利用者がいません"
        renderInput={(params) => (
          <TextField
            {...params}
            label="関連利用者"
            size="small"
            placeholder="名前で検索…"
            InputProps={{
              ...params.InputProps,
              startAdornment: (
                <InputAdornment position="start">
                  <PersonSearchIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            }}
            inputProps={{
              ...params.inputProps,
              'data-testid': 'call-log-form-related-user',
            }}
            helperText="電話の対象となる利用者を選択（任意）"
          />
        )}
        data-testid="call-log-form-related-user-autocomplete"
      />

      {/* 用件 */}
      <TextField
        id="call-log-form-message"
        label="用件・メモ"
        required
        multiline
        minRows={3}
        value={values.message}
        onChange={(e) => set('message', e.target.value)}
        error={!!fieldErrors.message}
        helperText={fieldErrors.message}
        size="small"
        inputProps={{ 'data-testid': 'call-log-form-message' }}
        disabled={isSubmitting}
      />

      {/* 緊急度 */}
      <FormControl component="fieldset" disabled={isSubmitting}>
        <FormLabel component="legend">
          <Typography variant="caption" color="text.secondary">
            緊急度
          </Typography>
        </FormLabel>
        <RadioGroup
          row
          value={values.urgency}
          onChange={(e) => set('urgency', e.target.value as CallLogFormValues['urgency'])}
          aria-label="緊急度"
          data-testid="call-log-form-urgency"
        >
          <FormControlLabel value="normal" control={<Radio size="small" />} label="通常" />
          <FormControlLabel value="today" control={<Radio size="small" />} label="本日中" />
          <FormControlLabel value="urgent" control={<Radio size="small" />} label="至急" />
        </RadioGroup>
      </FormControl>

      {/* 折返し要否 */}
      <FormControl disabled={isSubmitting}>
        <FormControlLabel
          control={
            <Checkbox
              checked={values.needCallback}
              onChange={(e) => set('needCallback', e.target.checked)}
              size="small"
              data-testid="call-log-form-need-callback"
            />
          }
          label="折返し要"
        />
      </FormControl>

      {/* 折返し期限(任意) — needCallback が true のときのみ表示 */}
      {values.needCallback && (
        <TextField
          id="call-log-form-callbackDueAt"
          label="折返し期限"
          type="datetime-local"
          value={values.callbackDueAt}
          onChange={(e) => set('callbackDueAt', e.target.value)}
          size="small"
          InputLabelProps={{ shrink: true }}
          inputProps={{ 'data-testid': 'call-log-form-callback-due' }}
          disabled={isSubmitting}
          helperText="任意。省略可"
        />
      )}

      {/* アクション */}
      <Stack direction="row" spacing={1} justifyContent="flex-end" mt={1}>
        {onCancel && (
          <Button
            variant="outlined"
            onClick={onCancel}
            disabled={isSubmitting}
            data-testid="call-log-form-cancel"
          >
            キャンセル
          </Button>
        )}
        <Button
          type="submit"
          variant="contained"
          disabled={isSubmitting}
          data-testid="call-log-form-submit"
        >
          {isSubmitting ? '保存中…' : '保存'}
        </Button>
      </Stack>
    </Box>
  );
};

export default CallLogForm;

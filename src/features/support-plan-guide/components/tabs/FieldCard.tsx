/**
 * FieldCard — 個別フィールド描画コンポーネント
 *
 * SupportPlanGuidePage.tsx の renderFieldCard() から抽出。
 * 純粋なプレゼンテーショナルコンポーネント（useState / useEffect 禁止）。
 */
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React from 'react';

import type { FieldConfig, SupportPlanForm, SupportPlanStringFieldKey } from '../../types';
import { FIELD_LIMITS } from '../../types';
import { formatDateYmd } from '@/lib/dateFormat';

export type FieldCardProps = {
  field: FieldConfig;
  form: SupportPlanForm;
  isAdmin: boolean;
  onFieldChange: (key: SupportPlanStringFieldKey, value: string) => void;
  onAppendPhrase: (key: SupportPlanStringFieldKey, phrase: string) => void;
  /** guardAdmin wraps callbacks so non-admin users get a toast instead */
  guardAdmin: <T>(fn: (...args: unknown[]) => T) => (...args: unknown[]) => T | undefined;
};

const FieldCard: React.FC<FieldCardProps> = ({
  field,
  form,
  isAdmin,
  onFieldChange,
  onAppendPhrase,
  guardAdmin,
}) => {
  const value = form[field.key] ?? '';
  const limit = FIELD_LIMITS[field.key] ?? 1000;
  const remaining = limit - value.length;
  const isOverLimit = remaining < 0;

  return (
    <Paper id={`field-card-${field.key}`} variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Stack spacing={0.5} flex={1}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="subtitle1" component="h3">
                {field.label}
              </Typography>
              {field.required ? <Chip label="必須" size="small" color="error" variant="outlined" /> : null}
            </Stack>
            {field.helper ? (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {field.helper}
              </Typography>
            ) : null}
          </Stack>
          <Chip
            size="small"
            label={`${Math.max(remaining, 0)} 文字残り`}
            color={isOverLimit ? 'error' : remaining <= 50 ? 'warning' : 'default'}
          />
        </Stack>

        {field.quickPhrases && field.quickPhrases.length > 0 ? (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {field.quickPhrases.map((phrase) => (
              <Chip
                key={phrase}
                size="small"
                variant="outlined"
                label={phrase}
                onClick={() => onAppendPhrase(field.key, phrase)}
                sx={{ cursor: 'pointer' }}
              />
            ))}
          </Stack>
        ) : null}

        <TextField
          value={value}
          onChange={(event) => onFieldChange(field.key, event.target.value)}
          placeholder={field.placeholder}
          multiline
          minRows={field.minRows ?? 2}
          fullWidth
          inputProps={{ maxLength: limit }}
          disabled={!isAdmin}
        />
        {field.key === 'lastMonitoringDate' ? (
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              size="small"
              variant="outlined"
              onClick={guardAdmin(() => onFieldChange('lastMonitoringDate', formatDateYmd(new Date())))}
              disabled={!isAdmin}
            >
              本日を記録
            </Button>
            <Button
              size="small"
              variant="text"
              onClick={guardAdmin(() => onFieldChange('lastMonitoringDate', ''))}
              disabled={!isAdmin}
            >
              クリア
            </Button>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              入力形式: YYYY/MM/DD（半角）
            </Typography>
          </Stack>
        ) : null}
      </Stack>
    </Paper>
  );
};

export default React.memo(FieldCard);

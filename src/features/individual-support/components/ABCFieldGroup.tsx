// ---------------------------------------------------------------------------
// ABCFieldGroup — A/B/C 共通入力UIコンポーネント
//
// Chip選択式の先行事象・行動・結果の入力UI。
// DailyRecordsTab / ABCEntryForm の両方で使用可能な共通部品。
// ---------------------------------------------------------------------------
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A/B/C のフィールドキー */
export type ABCFieldKey = 'antecedent' | 'behavior' | 'consequence';

/** A/B/C の値セット */
export interface ABCValues {
  antecedent: string;
  behavior: string;
  consequence: string;
}

/** フィールドごとのラベル定義 */
const FIELD_LABELS: Record<ABCFieldKey, string> = {
  antecedent: 'A: 先行事象',
  behavior: 'B: 行動',
  consequence: 'C: 結果',
};

/** フィールドの表示順 */
const FIELD_ORDER: ABCFieldKey[] = ['antecedent', 'behavior', 'consequence'];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ABCFieldGroupProps {
  /** 現在の A/B/C 値 */
  value: ABCValues;
  /** 部分更新コールバック */
  onChange: (key: ABCFieldKey, value: string) => void;
  /** フィールドごとの選択肢（外部から注入可能） */
  options: Record<ABCFieldKey, string[]>;
  /** コンパクト表示 */
  dense?: boolean;
  /** 読み取り専用 */
  readOnly?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ABCFieldGroup: React.FC<ABCFieldGroupProps> = ({
  value,
  onChange,
  options,
  dense = false,
  readOnly = false,
}) => (
  <Stack spacing={dense ? 1.5 : 2}>
    {FIELD_ORDER.map((key) => (
      <Box key={key}>
        <Typography
          variant="subtitle2"
          sx={{ fontWeight: 600, mb: 0.5 }}
        >
          {FIELD_LABELS[key]}
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {options[key].map((option) => (
            <Chip
              key={option}
              label={option}
              size={dense ? 'small' : 'medium'}
              color={value[key] === option ? 'primary' : 'default'}
              variant={value[key] === option ? 'filled' : 'outlined'}
              onClick={readOnly ? undefined : () => onChange(key, option)}
              sx={readOnly ? { pointerEvents: 'none' } : undefined}
            />
          ))}
        </Stack>
      </Box>
    ))}
  </Stack>
);

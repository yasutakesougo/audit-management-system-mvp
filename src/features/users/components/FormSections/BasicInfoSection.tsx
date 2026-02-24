/**
 * BasicInfoSection
 *
 * 利用者の基本情報（氏名・ふりがな・カタカナ氏名・利用者コード表示）セクション。
 */
import PersonIcon from '@mui/icons-material/Person';
import { Box, TextField, Typography } from '@mui/material';
import type { RefObject } from 'react';
import type { FormSectionProps } from './types';

type Props = FormSectionProps & {
  /** 利用者コード表示文字列（read-only） */
  systemAssignedCode: string;
  /** バリデーションエラーフォーカス用 refs */
  errRefs: {
    fullName: RefObject<HTMLInputElement | null>;
    furigana: RefObject<HTMLInputElement | null>;
  };
};

export function BasicInfoSection({ values, errors, setField, systemAssignedCode, errRefs }: Props) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography
        variant="h6"
        sx={{ mb: 2, color: 'primary.main', display: 'flex', alignItems: 'center' }}
      >
        <PersonIcon sx={{ mr: 1 }} />
        基本情報
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          利用者コード（システム採番）：{systemAssignedCode}
        </Typography>

        <TextField
          fullWidth
          required
          label="氏名"
          inputRef={errRefs.fullName}
          value={values.FullName}
          onChange={(event) => setField('FullName', event.target.value)}
          error={Boolean(errors.fullName)}
          helperText={errors.fullName}
          placeholder="山田 太郎"
          variant="outlined"
          size="small"
        />

        <TextField
          fullWidth
          label="ふりがな"
          inputRef={errRefs.furigana}
          value={values.Furigana}
          onChange={(event) => setField('Furigana', event.target.value)}
          placeholder="やまだ たろう"
          variant="outlined"
          size="small"
        />

        <TextField
          fullWidth
          label="カタカナ氏名"
          value={values.FullNameKana}
          onChange={(event) => setField('FullNameKana', event.target.value)}
          placeholder="ヤマダ タロウ"
          variant="outlined"
          size="small"
        />
      </Box>
    </Box>
  );
}

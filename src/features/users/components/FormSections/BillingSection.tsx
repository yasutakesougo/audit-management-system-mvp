/**
 * BillingSection
 *
 * 受給者証番号・有効期限・利用者負担上限月額セクション。
 * 請求処理に直結する重要フィールドをまとめる。
 */
import { Box, TextField, Typography } from '@mui/material';
import type { RefObject } from 'react';
import type { FormSectionProps } from './types';

type Props = FormSectionProps & {
  /** 受給者証番号フォーカス用 ref */
  certNumberRef: RefObject<HTMLInputElement | null>;
};

export function BillingSection({ values, errors, setField, certNumberRef }: Props) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography
        variant="subtitle2"
        sx={{ mb: 2, color: 'text.secondary' }}
      >
        受給者証・負担情報
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          fullWidth
          label="利用者負担上限月額（円）"
          value={values.UserCopayLimit}
          onChange={(event) => setField('UserCopayLimit', event.target.value)}
          placeholder="例：9300"
          variant="outlined"
          size="small"
          helperText="受給者証に記載の「利用者負担上限月額」です"
        />

        <TextField
          fullWidth
          label="受給者証番号"
          inputRef={certNumberRef}
          value={values.RecipientCertNumber}
          onChange={(event) => setField('RecipientCertNumber', event.target.value)}
          error={Boolean(errors.certNumber)}
          helperText={errors.certNumber}
          placeholder="1234567890"
          variant="outlined"
          size="small"
        />

        <TextField
          fullWidth
          label="受給者証有効期限"
          type="date"
          value={values.RecipientCertExpiry}
          onChange={(event) => setField('RecipientCertExpiry', event.target.value)}
          variant="outlined"
          size="small"
          InputLabelProps={{ shrink: true }}
        />
      </Box>
    </Box>
  );
}

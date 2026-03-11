/** StaffForm — Contact section component */
import { Box, TextField, Typography } from '@mui/material';

import { TESTIDS } from '@/testids';
import type { Errors, FormValues } from '../domain/staffFormDomain';

interface StaffFormContactSectionProps {
  values: FormValues;
  errors: Errors;
  errRefs: {
    email: React.RefObject<HTMLInputElement>;
    phone: React.RefObject<HTMLInputElement>;
  };
  setField: <K extends keyof FormValues>(key: K, value: FormValues[K]) => void;
}

export function StaffFormContactSection({ values, errors, errRefs, setField }: StaffFormContactSectionProps) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
        連絡先情報
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          fullWidth
          type="email"
          label="メール"
          inputRef={errRefs.email}
          value={values.Email}
          onChange={(event) => setField('Email', event.target.value)}
          error={Boolean(errors.email)}
          helperText={errors.email}
          placeholder="taro.yamada@example.com"
          autoComplete="email"
          variant="outlined"
          size="small"
          inputProps={{ 'data-testid': TESTIDS['staff-form-email'] }}
        />

        <TextField
          fullWidth
          label="電話番号"
          inputRef={errRefs.phone}
          value={values.Phone}
          onChange={(event) => setField('Phone', event.target.value)}
          error={Boolean(errors.phone)}
          helperText={errors.phone}
          placeholder="09012345678"
          autoComplete="tel"
          variant="outlined"
          size="small"
          inputProps={{ 'data-testid': TESTIDS['staff-form-phone'] }}
        />

        <TextField
          fullWidth
          label="役職"
          value={values.Role}
          onChange={(event) => setField('Role', event.target.value)}
          placeholder="サービス管理責任者"
          variant="outlined"
          size="small"
          inputProps={{ 'data-testid': TESTIDS['staff-form-role'] }}
        />
      </Box>
    </Box>
  );
}

/** StaffForm — BasicInfo section component */
import PersonIcon from '@mui/icons-material/Person';
import { Box, TextField, Typography } from '@mui/material';

import { TESTIDS } from '@/testids';
import type { Errors, FormValues } from '../domain/staffFormDomain';

interface StaffFormBasicInfoSectionProps {
  values: FormValues;
  errors: Errors;
  errRefs: { fullName: React.RefObject<HTMLInputElement> };
  setField: <K extends keyof FormValues>(key: K, value: FormValues[K]) => void;
}

export function StaffFormBasicInfoSection({ values, errors, errRefs, setField }: StaffFormBasicInfoSectionProps) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" sx={{ mb: 2, color: 'primary.main', display: 'flex', alignItems: 'center' }}>
        <PersonIcon sx={{ mr: 1 }} />
        基本情報
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          fullWidth
          label="スタッフID"
          value={values.StaffID}
          onChange={(event) => setField('StaffID', event.target.value)}
          placeholder="例: ST-001"
          autoComplete="off"
          variant="outlined"
          size="small"
          inputProps={{ 'data-testid': TESTIDS['staff-form-staffid'] }}
        />

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
          inputProps={{ 'data-testid': TESTIDS['staff-form-fullname'] }}
        />
      </Box>
    </Box>
  );
}

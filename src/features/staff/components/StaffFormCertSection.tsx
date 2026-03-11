/** StaffForm — Cert section component */
import { Box, Button, Chip, TextField, Typography } from '@mui/material';
import type { Dispatch, SetStateAction } from 'react';

import type { FormValues } from '../domain/staffFormDomain';
import { CERTIFICATION_OPTIONS } from '../domain/staffFormDomain';

interface StaffFormCertSectionProps {
  values: FormValues;
  customCertification: string;
  setCustomCertification: Dispatch<SetStateAction<string>>;
  toggleCertification: (cert: string) => void;
  removeCertification: (cert: string) => void;
  handleAddCustomCertification: () => void;
}

export function StaffFormCertSection({
  values,
  customCertification,
  setCustomCertification,
  toggleCertification,
  removeCertification,
  handleAddCustomCertification,
}: StaffFormCertSectionProps) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
        資格
      </Typography>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
        {CERTIFICATION_OPTIONS.map((option) => {
          const checked = values.Certifications.includes(option.value);
          return (
            <Chip
              key={option.value}
              label={option.label}
              onClick={() => toggleCertification(option.value)}
              variant={checked ? 'filled' : 'outlined'}
              color={checked ? 'primary' : 'default'}
              sx={{ cursor: 'pointer' }}
            />
          );
        })}
      </Box>

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
        <TextField
          fullWidth
          label="カスタム資格を追加"
          value={customCertification}
          onChange={(event) => setCustomCertification(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              handleAddCustomCertification();
            }
          }}
          placeholder="例: 介護支援専門員"
          variant="outlined"
          size="small"
        />
        <Button
          variant="contained"
          onClick={handleAddCustomCertification}
          disabled={!customCertification.trim()}
          sx={{ minWidth: 'auto', px: 2 }}
        >
          追加
        </Button>
      </Box>
      {values.Certifications.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium' }}>
            選択された資格:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {values.Certifications.map((cert) => (
              <Chip
                key={cert}
                label={cert}
                onDelete={() => removeCertification(cert)}
                color="success"
                variant="filled"
                size="small"
              />
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}

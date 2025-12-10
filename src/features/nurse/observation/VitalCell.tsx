import NumericInputDialog from '@/ui/components/NumericInputDialog';
import DialpadOutlinedIcon from '@mui/icons-material/DialpadOutlined';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import * as React from 'react';

export type VitalCellProps = {
  id: string;
  label?: string;
  unit?: string;
  value: string;
  onChange: (next: string) => void;
  danger?: boolean;
  width?: number | string;
  min?: number;
  max?: number;
  allowDecimal?: boolean;
};

export default function VitalCell({
  id,
  label,
  unit,
  value,
  onChange,
  danger = false,
  width = 140,
  min,
  max,
  allowDecimal = true,
}: VitalCellProps) {
  const [open, setOpen] = React.useState(false);

  const handleApply = React.useCallback((nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
  }, [onChange]);

  const handleClose = React.useCallback(() => {
    setOpen(false);
  }, []);

  return (
  <Box sx={{ width: '100%', minWidth: { xs: 120, sm: width } }}>
      <TextField
        size="small"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        variant="outlined"
        error={danger}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <Stack direction="row" spacing={0.5} alignItems="center">
                {unit ? (
                  <Typography variant="caption" color="text.secondary">
                    {unit}
                  </Typography>
                ) : null}
                <IconButton
                  size="small"
                  aria-label={label ? `${label}の数値入力モーダルを開く` : '数値入力モーダルを開く'}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setOpen(true);
                  }}
                >
                  <DialpadOutlinedIcon fontSize="inherit" />
                </IconButton>
              </Stack>
            </InputAdornment>
          ),
        }}
        inputProps={{
          'aria-label': label,
          'aria-invalid': danger ? 'true' : undefined,
          'data-testid': id,
          inputMode: 'decimal',
          style: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
        }}
        fullWidth
      />
      <NumericInputDialog
        open={open}
        label={label ?? '数値入力'}
        unit={unit}
        value={value}
        min={min}
        max={max}
        allowDecimal={allowDecimal}
        onApply={handleApply}
        onClose={handleClose}
      />
    </Box>
  );
}

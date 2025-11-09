import React, { useCallback, useId, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { TESTIDS } from '@/testids';

type VitalCardProps = {
  label: string;
  unit: string;
  value: number;
  step?: number;
  onChange: (value: number) => void;
  isDanger?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  describedById?: string;
  testId?: string;
  inputTestId?: string;
  readOnly?: boolean;
};

const VitalCard: React.FC<VitalCardProps> = ({
  label,
  unit,
  value,
  onChange,
  isDanger = false,
  step = 1,
  inputRef,
  describedById,
  testId,
  inputTestId,
  readOnly = false,
}) => {
  const reactId = useId();
  const fieldId = `${reactId}-field`;
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [draftValue, setDraftValue] = useState('');
  const internalInputRef = useRef<HTMLInputElement | null>(null);
  const isWeightCard = label === '体重';

  const assignInputRef = useCallback(
    (node: HTMLInputElement | null) => {
      internalInputRef.current = node;
      if (!inputRef) return;
      if (typeof inputRef === 'function') {
        inputRef(node);
      } else {
        (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
      }
    },
    [inputRef]
  );

  const defaultTestId = isWeightCard ? TESTIDS.NURSE_OBS_WEIGHT_INPUT : TESTIDS.NURSE_VITAL_VALUE;
  const resolvedInputTestId = inputTestId ?? defaultTestId;
  const sharedInputProps: React.InputHTMLAttributes<HTMLInputElement> & { 'data-testid': string } = {
    inputMode: 'decimal',
    pattern: '[0-9.]*',
    'data-testid': resolvedInputTestId,
  };
  if (isDanger) {
    sharedInputProps['aria-invalid'] = 'true';
  }
  if (describedById) {
    sharedInputProps['aria-describedby'] = describedById;
  }

  const focusBackToInput = useCallback(() => {
    const focusTarget = () => {
      internalInputRef.current?.focus?.();
    };
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(focusTarget);
    } else {
      focusTarget();
    }
  }, []);

  const handleOpenKeypad = useCallback(
    (event?: React.SyntheticEvent) => {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      if (keypadOpen) return;
      setDraftValue(Number.isNaN(value) ? '' : String(value));
      setKeypadOpen(true);
    },
    [keypadOpen, value]
  );

  const handleKeypadInput = useCallback((key: string) => {
    setDraftValue((prev) => {
      if (key === 'backspace') {
        return prev.slice(0, -1);
      }
      if (key === '.') {
        if (!prev) return '0.';
        if (prev.includes('.')) return prev;
        return `${prev}.`;
      }
      return prev === '0' ? key : `${prev}${key}`;
    });
  }, []);

  const closeKeypad = useCallback(() => {
    setKeypadOpen(false);
    focusBackToInput();
  }, [focusBackToInput]);

  const handleCommit = useCallback(() => {
    if (!draftValue.trim()) {
      closeKeypad();
      return;
    }
    const parsed = Number(draftValue);
    if (!Number.isNaN(parsed)) {
      onChange(parsed);
    }
    closeKeypad();
  }, [closeKeypad, draftValue, onChange]);

  const handleClear = useCallback(() => {
    setDraftValue('');
  }, []);

  const keypadRows: string[][] = [
    ['7', '8', '9'],
    ['4', '5', '6'],
    ['1', '2', '3'],
    ['.', '0', 'backspace'],
  ];

  const numericValue = Number.isFinite(value) ? (value as number) : 0;

  const resolvedCardTestId = testId ?? (isWeightCard ? TESTIDS.NURSE_OBS_WEIGHT_CARD : undefined);

  return (
    <>
      <Card
        variant="outlined"
        sx={{
          borderColor: isDanger ? 'error.main' : 'divider',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}
        data-testid={resolvedCardTestId}
      >
        <CardContent sx={{ p: { xs: 1.25, md: 1.75 }, flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
            {label}
          </Typography>
          <Stack
            direction="row"
            alignItems="center"
            spacing={1.1}
            sx={{ mt: 0.5, justifyContent: 'space-between', minHeight: { xs: 72, md: 82 }, flex: 1 }}
          >
            <IconButton
              size="medium"
              onClick={() => onChange(numericValue - step)}
              aria-label={`${label}を減らす`}
              aria-controls={fieldId}
              data-step={-step}
              sx={{ flexShrink: 0 }}
            >
              <RemoveIcon />
            </IconButton>
            <TextField
              id={fieldId}
              error={isDanger}
              inputRef={assignInputRef}
              inputProps={sharedInputProps}
              type="tel"
              InputProps={{
                readOnly,
                sx: {
                  '& .MuiOutlinedInput-input': {
                    textAlign: 'center',
                    fontSize: { xs: 22, md: 26 },
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                    py: 1,
                    color: 'text.primary',
                    letterSpacing: '0.04em',
                  },
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderWidth: 2,
                  },
                },
              }}
              value={Number.isFinite(value) ? String(value) : ''}
              placeholder="—"
              onChange={(event) => {
                const raw = event.target.value;
                const normalized = raw.replace(',', '.').trim();
                if (normalized === '' || normalized === '-' || normalized === '.' || normalized === '-.') {
                  onChange(numericValue);
                  return;
                }
                const parsed = Number(normalized);
                if (!Number.isFinite(parsed)) {
                  onChange(numericValue);
                  return;
                }
                onChange(parsed);
              }}
              onClick={(event) => handleOpenKeypad(event)}
              onKeyDown={(event) => {
                if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) {
                  event.preventDefault();
                  handleOpenKeypad(event);
                }
              }}
              sx={{
                flex: 1,
                minWidth: { xs: 112, md: 128 },
                '& .MuiOutlinedInput-root': {
                  borderRadius: 3,
                  minHeight: { xs: 52, md: 58 },
                },
              }}
            />
            <Typography
              color="text.secondary"
              sx={{ fontSize: 16, fontWeight: 600, minWidth: 28, textAlign: 'center', flexShrink: 0 }}
            >
              {unit}
            </Typography>
            <IconButton
              size="medium"
              onClick={() => onChange(numericValue + step)}
              aria-label={`${label}を増やす`}
              aria-controls={fieldId}
              data-step={step}
              sx={{ flexShrink: 0 }}
            >
              <AddIcon />
            </IconButton>
          </Stack>
        </CardContent>
      </Card>

      <Dialog open={keypadOpen} onClose={closeKeypad} maxWidth="xs" fullWidth>
        <DialogTitle>{`${label}の数値入力`}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Box sx={{ textAlign: 'right', mb: 2 }}>
            <Typography variant="h5" component="p" sx={{ fontWeight: 700 }}>
              {draftValue || '—'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {unit}
            </Typography>
          </Box>
          <Stack spacing={1}>
            {keypadRows.map((row) => (
              <Stack key={row.join('-')} direction="row" spacing={1}>
                {row.map((key) => (
                  <Button
                    key={key}
                    variant="outlined"
                    size="large"
                    fullWidth
                    sx={{ flex: 1 }}
                    onClick={() => handleKeypadInput(key)}
                    aria-label={key === 'backspace' ? '削除' : key === '.' ? '小数点' : key}
                  >
                    {key === 'backspace' ? '⌫' : key}
                  </Button>
                ))}
              </Stack>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClear} color="inherit">
            クリア
          </Button>
          <Button onClick={closeKeypad} color="inherit">
            キャンセル
          </Button>
          <Button onClick={handleCommit} variant="contained">
            決定
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default VitalCard;

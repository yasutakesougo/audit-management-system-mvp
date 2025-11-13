import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import BackspaceIcon from '@mui/icons-material/Backspace';
import * as React from 'react';

interface NumericInputDialogProps {
  open: boolean;
  label: string;
  unit?: string;
  value: string;
  min?: number;
  max?: number;
  allowDecimal?: boolean;
  onApply: (value: string) => void;
  onClose: () => void;
}

export default function NumericInputDialog({
  open,
  label,
  unit,
  value,
  min,
  max,
  allowDecimal = true,
  onApply,
  onClose,
}: NumericInputDialogProps) {
  const [inputValue, setInputValue] = React.useState('');

  React.useEffect(() => {
    if (open) {
      setInputValue(value);
    }
  }, [open, value]);

  const handleNumberClick = (num: string) => {
    setInputValue(prev => prev + num);
  };

  const handleDecimalClick = () => {
    if (allowDecimal && !inputValue.includes('.')) {
      setInputValue(prev => prev + '.');
    }
  };

  const handleBackspace = () => {
    setInputValue(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setInputValue('');
  };

  const handleApply = () => {
    const numValue = parseFloat(inputValue);
    if (!isNaN(numValue)) {
      if (min !== undefined && numValue < min) return;
      if (max !== undefined && numValue > max) return;
    }
    onApply(inputValue);
  };

  const handleCancel = () => {
    setInputValue(value);
    onClose();
  };

  const isValidInput = () => {
    if (!inputValue) return false;
    const numValue = parseFloat(inputValue);
    if (isNaN(numValue)) return false;
    if (min !== undefined && numValue < min) return false;
    if (max !== undefined && numValue > max) return false;
    return true;
  };

  const numberButtons = Array.from({ length: 10 }, (_, i) => (
    <Grid key={i} size={4}>
      <Button
        fullWidth
        variant="outlined"
        size="large"
        onClick={() => handleNumberClick(i.toString())}
        sx={{ minHeight: 56 }}
      >
        {i}
      </Button>
    </Grid>
  ));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle>{label}</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          inputProps={{
            inputMode: 'decimal',
            style: { textAlign: 'center', fontSize: '1.5rem' },
          }}
          InputProps={{
            endAdornment: unit ? <Typography variant="body2">{unit}</Typography> : undefined,
          }}
          margin="normal"
        />
        <Grid container spacing={1} sx={{ mt: 1 }}>
          {numberButtons}
          <Grid size={4}>
            {allowDecimal && (
              <Button
                fullWidth
                variant="outlined"
                size="large"
                onClick={handleDecimalClick}
                disabled={inputValue.includes('.')}
                sx={{ minHeight: 56 }}
              >
                .
              </Button>
            )}
          </Grid>
          <Grid size={4}>
            <Button
              fullWidth
              variant="outlined"
              size="large"
              onClick={handleBackspace}
              sx={{ minHeight: 56 }}
            >
              <BackspaceIcon />
            </Button>
          </Grid>
          <Grid size={4}>
            <Button
              fullWidth
              variant="outlined"
              size="large"
              onClick={handleClear}
              sx={{ minHeight: 56 }}
            >
              Clear
            </Button>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel}>キャンセル</Button>
        <Button 
          onClick={handleApply} 
          variant="contained"
          disabled={!isValidInput()}
        >
          適用
        </Button>
      </DialogActions>
    </Dialog>
  );
}
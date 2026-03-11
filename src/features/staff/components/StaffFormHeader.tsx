/** StaffForm — Header section component */
import CloseIcon from '@mui/icons-material/Close';
import PersonIcon from '@mui/icons-material/Person';
import { Box, IconButton, Typography } from '@mui/material';

interface StaffFormHeaderProps {
  mode: 'create' | 'update';
  onClose?: () => void;
  handleClose: () => void;
}

export function StaffFormHeader({ mode, onClose, handleClose }: StaffFormHeaderProps) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <PersonIcon color="primary" />
        <Typography variant="h6" component="h2">
          {mode === 'create' ? '新規職員登録' : '職員情報編集'}
        </Typography>
      </Box>
      {onClose && (
        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      )}
    </Box>
  );
}

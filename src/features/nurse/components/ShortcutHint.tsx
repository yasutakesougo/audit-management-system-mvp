import { TESTIDS } from '@/testids';
import KeyboardIcon from '@mui/icons-material/KeyboardOutlined';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

export default function ShortcutHint() {
  return (
    <Box
      data-testid={TESTIDS.NURSE_BULK_SHORTCUT_HINT}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1,
        px: 1.5,
        py: 1,
        borderRadius: 1,
        bgcolor: 'action.hover',
        color: 'text.secondary',
      }}
    >
      <KeyboardIcon fontSize="small" />
      <Typography component="span" variant="body2">
        Alt + S で一括同期
      </Typography>
    </Box>
  );
}

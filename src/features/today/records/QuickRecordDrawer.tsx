import CloseIcon from '@mui/icons-material/Close';
import {
    Box,
    Dialog,
    Drawer,
    IconButton,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import { QuickRecordFormEmbed } from './QuickRecordFormEmbed';

export type QuickRecordDrawerProps = {
  open: boolean;
  mode: 'unfilled' | 'user' | null;
  userId: string | null;
  onClose: () => void;
  onSaveSuccess?: () => void;
  autoNextEnabled?: boolean;
  setAutoNextEnabled?: (enabled: boolean) => void;
};

export const QuickRecordDrawer: React.FC<QuickRecordDrawerProps> = ({
  open,
  mode,
  userId,
  onClose,
  onSaveSuccess,
  autoNextEnabled = true,
  setAutoNextEnabled,
}) => {
  const theme = useTheme();
  // タブレット以上は右側Drawer、スマホは全画面Dialog (PR3ガードレール#3)
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const title = mode === 'unfilled' ? '未記録の一括照会' : `利用者記録: ${userId || ''}`;

  const content = (
    <Box
      data-testid="today-quickrecord-drawer"
      sx={{
        width: isMobile ? '100%' : 500, // Drawer幅は一時的に固定
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          px: 2,
          py: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Typography variant="h6" fontWeight="bold">
          {title}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {mode === 'unfilled' && setAutoNextEnabled && (
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={autoNextEnabled}
                  onChange={(e) => setAutoNextEnabled(e.target.checked)}
                  inputProps={{ 'aria-label': '連続入力' }}
                />
              }
              label={
                <Typography variant="body2" sx={{ userSelect: 'none' }}>
                  連続入力
                </Typography>
              }
            />
          )}
          <IconButton onClick={onClose} aria-label="close" data-testid="today-quickrecord-close">
            <CloseIcon />
          </IconButton>
        </Box>
      </Box>

      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          bgcolor: 'background.default',
        }}
      >
        <QuickRecordFormEmbed
          userId={userId || undefined}
          onClose={onClose}
          onSaveSuccess={onSaveSuccess}
        />
      </Box>
    </Box>
  );

  if (isMobile) {
    return (
      <Dialog fullScreen open={open} onClose={onClose}>
        {content}
      </Dialog>
    );
  }

  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      {content}
    </Drawer>
  );
};

import React, { useCallback, useContext } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import Stack from '@mui/material/Stack';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import { ColorModeContext } from '@/app/theme';
import { useSettingsContext } from './SettingsContext';
import { DensityControl, FontSizeControl } from './components';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ open, onClose }) => {
  const { mode, toggle } = useContext(ColorModeContext);
  const { settings, updateSettings } = useSettingsContext();

  const handleDensityChange = useCallback((newDensity: 'compact' | 'comfortable' | 'spacious') => {
    updateSettings({ density: newDensity });
  }, [updateSettings]);

  const handleFontSizeChange = useCallback((newFontSize: 'small' | 'medium' | 'large') => {
    updateSettings({ fontSize: newFontSize });
  }, [updateSettings]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        表示設定
        <IconButton onClick={onClose} size="small" sx={{ ml: 2 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 3 }}>
        <Stack spacing={3}>
          {/* テーマ設定 */}
          <Stack spacing={2}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              テーマ
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={mode === 'dark'}
                  onChange={toggle}
                  color="primary"
                />
              }
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  {mode === 'dark' ? <Brightness7Icon fontSize="small" /> : <Brightness4Icon fontSize="small" />}
                  <span>{mode === 'dark' ? 'ダークモード' : 'ライトモード'}</span>
                </Stack>
              }
            />
            <Typography variant="body2" color="text.secondary">
              {mode === 'dark'
                ? 'ダークテーマを有効にしています。目の疲れを軽減できます。'
                : 'ライトテーマを使用しています。明るい環境での使用に最適です。'}
            </Typography>
          </Stack>

          <Divider />

          {/* UI 密度設定 */}
          <Stack spacing={2}>
            <DensityControl 
              value={settings.density}
              onChange={handleDensityChange}
            />
          </Stack>

          <Divider sx={{ my: 2 }} />

          {/* フォントサイズ設定 */}
          <Stack spacing={2}>
            <FontSizeControl
              value={settings.fontSize}
              onChange={handleFontSizeChange}
            />
          </Stack>

          <Divider sx={{ my: 2 }} />

          <FormControlLabel
            control={
              <Switch
                checked={settings.layoutMode === 'focus'}
                onChange={(_, checked) =>
                  updateSettings({ layoutMode: checked ? 'focus' : 'normal' })
                }
                inputProps={{ 'aria-label': '集中モード（全画面）' }}
              />
            }
            label="集中モード（全画面）"
          />

          {/* 将来の設定項目プレースホルダー */}
          <Typography variant="caption" color="text.secondary" sx={{ pt: 2 }}>
            その他の表示設定（色カスタマイズなど）は今後実装予定です。
          </Typography>
        </Stack>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsDialog;

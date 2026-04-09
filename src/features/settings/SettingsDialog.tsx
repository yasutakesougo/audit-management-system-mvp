import type { NavGroupKey, NavItem } from '@/app/config/navigationConfig.types';
import {
  PLANNING_NAV_TELEMETRY_EVENTS,
  recordPlanningNavTelemetry,
} from '@/app/navigation/planningNavTelemetry';
import type { NavGroupVisibilityPreferences } from '@/features/settings/settingsModel';
import { ColorModeContext } from '@/app/theme';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import CloseIcon from '@mui/icons-material/Close';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import React, { useCallback, useContext } from 'react';
import { useLocation } from 'react-router-dom';
import { useSettingsContext } from './SettingsContext';
import { ColorPresetControl, DensityControl, FontSizeControl, NavGroupVisibilityControl } from './components';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  /** All nav items (unfiltered) for individual menu visibility controls */
  navItems?: NavItem[];
  disablePortal?: boolean;
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ open, onClose, navItems = [], disablePortal }) => {
  const { mode, toggle } = useContext(ColorModeContext);
  const { settings, updateSettings } = useSettingsContext();
  const location = useLocation();

  const handleDensityChange = useCallback((newDensity: 'compact' | 'comfortable' | 'spacious') => {
    updateSettings({ density: newDensity });
  }, [updateSettings]);

  const handleFontSizeChange = useCallback((newFontSize: 'small' | 'medium' | 'large') => {
    updateSettings({ fontSize: newFontSize });
  }, [updateSettings]);

  const handleColorPresetChange = useCallback((newPreset: 'default' | 'highContrast' | 'custom') => {
    updateSettings({ colorPreset: newPreset });
  }, [updateSettings]);

  const handleNavGroupVisibilityChange = useCallback((hiddenGroups: NavGroupKey[]) => {
    const wasPlanningHidden = settings.hiddenNavGroups.includes('planning');
    const isPlanningHidden = hiddenGroups.includes('planning');
    let nextNavGroupVisibilityPrefs: NavGroupVisibilityPreferences | undefined;
    if (wasPlanningHidden !== isPlanningHidden) {
      recordPlanningNavTelemetry({
        eventName: PLANNING_NAV_TELEMETRY_EVENTS.SETTINGS_TOGGLED,
        role: 'unknown',
        mode: settings.layoutMode,
        pathname: location.pathname,
        search: location.search,
        source: 'settings',
        trigger: 'user_toggle',
        visible: !isPlanningHidden,
        action: isPlanningHidden ? 'hide' : 'show',
        hiddenBySetting: isPlanningHidden,
      });
      nextNavGroupVisibilityPrefs = {
        ...settings.navGroupVisibilityPrefs,
        planning: isPlanningHidden ? 'hide' : 'show',
      };
    }
    updateSettings({
      hiddenNavGroups: hiddenGroups,
      ...(nextNavGroupVisibilityPrefs
        ? { navGroupVisibilityPrefs: nextNavGroupVisibilityPrefs }
        : {}),
    });
  }, [
    updateSettings,
    settings.hiddenNavGroups,
    settings.layoutMode,
    settings.navGroupVisibilityPrefs,
    location.pathname,
    location.search,
  ]);

  const handleNavItemVisibilityChange = useCallback((hiddenItems: string[]) => {
    updateSettings({ hiddenNavItems: hiddenItems });
  }, [updateSettings]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth disablePortal={disablePortal}>
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

          {/* カラープリセット設定 */}
          <Stack spacing={2}>
            <ColorPresetControl
              value={settings.colorPreset}
              onChange={handleColorPresetChange}
            />
          </Stack>

          <Divider sx={{ my: 2 }} />

          {/* レイアウトモード設定 */}
          <Stack spacing={2}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              📺 レイアウトモード
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              画面の表示スタイルを切り替えます。タブレット端末での運用にはキオスクモードがおすすめです。
            </Typography>
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
              label="集中モード（ヘッダー・サイドバー非表示）"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={settings.layoutMode === 'kiosk'}
                  onChange={(_, checked) =>
                    updateSettings({ layoutMode: checked ? 'kiosk' : 'normal' })
                  }
                  inputProps={{ 'aria-label': 'キオスクモード（タブレット端末用）' }}
                />
              }
              label="キオスクモード（タブレット端末用）"
            />
            {settings.layoutMode === 'kiosk' && (
              <Typography variant="caption" color="primary.main" sx={{ pl: 4 }}>
                ✅ キオスク有効: 全画面 ＋ タッチ最適化 ＋ 画面消灯防止（長押しで解除）
              </Typography>
            )}
          </Stack>

          <Divider sx={{ my: 2 }} />

          {/* サイドメニュー表示設定 */}
          <Stack spacing={2}>
            <NavGroupVisibilityControl
              hiddenGroups={settings.hiddenNavGroups}
              hiddenItems={settings.hiddenNavItems}
              allNavItems={navItems}
              onGroupChange={handleNavGroupVisibilityChange}
              onItemChange={handleNavItemVisibilityChange}
            />
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsDialog;

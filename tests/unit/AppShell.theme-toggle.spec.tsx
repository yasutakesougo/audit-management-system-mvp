import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SettingsDialog } from '@/features/settings/SettingsDialog';
import { ThemeRoot } from '@/app/theme';
import { SettingsProvider } from '@/features/settings/SettingsContext';
import { renderWithAppProviders } from '../helpers/renderWithAppProviders';

/**
 * テーマ切り替えのアクセシビリティテスト
 *
 * テーマ切り替えは AppShellHeader の IconButton から
 * SettingsDialog 内の Switch に移行されたため、テスト対象を更新。
 */
describe('SettingsDialog theme toggle accessibility', () => {
  it('toggles dark mode when the theme switch is clicked', () => {
    const onClose = () => {};

    renderWithAppProviders(
      <SettingsProvider>
        <ThemeRoot>
          <SettingsDialog open onClose={onClose} />
        </ThemeRoot>
      </SettingsProvider>,
    );

    // SettingsDialog内のテーマ切り替えスイッチを取得
    // MUI Switch は <input type="checkbox"> として描画される
    // FormControlLabel のラベルから取得
    const themeSwitch = screen.getByLabelText(/ライトモード|ダークモード/i);

    // 初期状態: ライトモード (checked=false)
    expect(themeSwitch).not.toBeChecked();

    // ダークモードに切り替え
    fireEvent.click(themeSwitch);
    expect(themeSwitch).toBeChecked();

    // ライトモードに戻す
    fireEvent.click(themeSwitch);
    expect(themeSwitch).not.toBeChecked();
  });
});

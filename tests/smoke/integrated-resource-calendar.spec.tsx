/**
 * IntegratedResourceCalendar スモークテスト
 * 基本的な機能が動作することを確認
 */

import IntegratedResourceCalendarPage from '@/pages/IntegratedResourceCalendarPage';
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithAppProviders } from '../helpers/renderWithAppProviders';

const EXTENDED_TIMEOUT = 10000;

describe('IntegratedResourceCalendar smoke tests', () => {
  it('renders without crashing', () => {
    expect(() => {
      renderWithAppProviders(<IntegratedResourceCalendarPage />);
    }).not.toThrow();
  });

  it('displays the page title', async () => {
    renderWithAppProviders(<IntegratedResourceCalendarPage />);

    // ページタイトルが表示されることを確認
    expect(screen.getByText('統合リソースカレンダー')).toBeInTheDocument();
    expect(screen.getByText('Plan vs Actual 管理ビュー')).toBeInTheDocument();
  });

  it('shows Sprint 3 implementation notice', async () => {
    renderWithAppProviders(<IntegratedResourceCalendarPage />);

    // Sprint 3実装中の通知が表示されることを確認
    expect(screen.getByText(/Sprint 3 実装中/)).toBeInTheDocument();
  });

  it('renders FullCalendar component', async () => {
    renderWithAppProviders(<IntegratedResourceCalendarPage />);

    // FullCalendarの基本要素が存在することを確認
    await waitFor(() => {
      // カレンダーのツールバーが表示されるのを待機
      const calendarElement = document.querySelector('.fc');
      expect(calendarElement).toBeInTheDocument();
    }, { timeout: EXTENDED_TIMEOUT });
  });

  it('contains mock resource data', async () => {
    renderWithAppProviders(<IntegratedResourceCalendarPage />);

    await waitFor(() => {
      // モックリソースが表示されることを確認
      expect(screen.getByText(/田中 花子/)).toBeInTheDocument();
      expect(screen.getByText(/佐藤 太郎/)).toBeInTheDocument();
      expect(screen.getByText(/車両A/)).toBeInTheDocument();
    }, { timeout: EXTENDED_TIMEOUT });
  });

  it('displays mock events', async () => {
    renderWithAppProviders(<IntegratedResourceCalendarPage />);

    await waitFor(() => {
      // モックイベントが表示されることを確認
      expect(screen.getByText(/利用者宅訪問/)).toBeInTheDocument();
      expect(screen.getByText(/デイサービス送迎/)).toBeInTheDocument();
    }, { timeout: EXTENDED_TIMEOUT });
  });

  // PvsA表示のテスト（ステータスアイコンなど）
  it('shows PvsA status indicators', async () => {
    renderWithAppProviders(<IntegratedResourceCalendarPage />);

    await waitFor(() => {
      // ステータスアイコンが表示されることを確認
      const eventElements = document.querySelectorAll('.pvsA-event-content');
      expect(eventElements.length).toBeGreaterThan(0);
    }, { timeout: EXTENDED_TIMEOUT });
  });

  // 型安全性のテスト
  it('imports types without errors', async () => {
    // 型定義ファイルが正しくimportできることを確認
    const types = await import('@/features/resources/types');
    expect(types).toBeDefined();
  });
});

/**
 * 将来のE2Eテスト用メモ
 *
 * 以下の機能は実際のブラウザ環境でのE2Eテストで確認:
 *
 * 1. リアルタイム更新（5秒後のステータス変化）
 * 2. イベントクリック→詳細ダイアログ表示
 * 3. ドラッグ&ドロップ操作
 * 4. 編集制御（実績ありイベントの編集禁止）
 * 5. スナックバー表示
 *
 * Playwright テスト例:
 *
 * test('real-time status update', async ({ page }) => {
 *   await page.goto('/admin/integrated-resource-calendar');
 *
 *   // 初期状態: waiting
 *   await expect(page.locator('text=⏳')).toBeVisible();
 *
 *   // 5秒待機してin-progressに変わることを確認
 *   await page.waitForTimeout(5000);
 *   await expect(page.locator('text=🔄')).toBeVisible();
 * });
 *
 * テスト基盤の改善点:
 *
 * ✅ renderWithAppProviders使用 - Router future flags適用 + Toast Provider統合
 * ✅ CI安定性向上 - timeout 5000ms に延長
 * ✅ Testing Library準拠 - screen.getByText主体、document.querySelectorは最小限
 * ✅ 型安全性検証 - @/features/resources/types import確認
 *
 * 保守性向上:
 * - 他テストファイルとの一貫性確保
 * - Router future warnings完全抑制
 * - CI環境での安定動作
 * - 将来のE2E拡張への明確な道筋
 */
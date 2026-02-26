import { expect, test } from '@playwright/test';

test.describe('AppShell sidebar aria-current', () => {
  test('marks current route with aria-current="page"', async ({ page }) => {
    // 1) /users へ
    await page.goto('/users');

    // 2) サイドメニュー内の「利用者」リンクが current
    const usersLink = page.getByRole('link', { name: '利用者' });
    await expect(usersLink).toHaveAttribute('aria-current', 'page');

    // 3) 別リンクは aria-current を持たない（例：黒ノート一覧）
    const blackNoteLink = page.getByRole('link', { name: '黒ノート一覧' });
    await expect(blackNoteLink).not.toHaveAttribute('aria-current', 'page');
  });

  test('marks /dashboard with aria-current="page" and non-current links without it', async ({ page }) => {
    // /dashboard に行く
    await page.goto('/dashboard');

    // サイドメニュー内の a[href="/dashboard"] が aria-current="page" を持つ
    const dashboardLink = page.getByRole('navigation', { name: /主要ナビゲーション/i }).locator('a[href="/dashboard"]');
    await expect(dashboardLink).toHaveAttribute('aria-current', 'page');

    // a[href="/records"]（黒ノート一覧）が aria-current を持たない
    const recordsLink = page.getByRole('navigation', { name: /主要ナビゲーション/i }).locator('a[href="/records"]');
    await expect(recordsLink).not.toHaveAttribute('aria-current', 'page');
  });


  test('keeps aria-current even when sidebar is collapsed', async ({ page }) => {
    await page.goto('/users');

    // AppShell.tsx に定義されている aria-label="ナビを折りたたみ" に合わせてクリック
    const collapseBtn = page.getByRole('button', { name: /ナビを折りたたみ/i });
    await collapseBtn.waitFor({ state: 'visible' });
    await collapseBtn.click();

    // 折りたたみ後も aria-current が保持されることの確認
    // 折りたたみ時はテキストが非表示になりTooltip（title属性）のみになるため、role指定のnameではなくロケータを変える
    const mainNav = page.getByRole('navigation', { name: /主要ナビゲーション/i });
    const currentLink = mainNav.locator('a[aria-current="page"]');
    await expect(currentLink).toHaveAttribute('href', '/users');
  });
});

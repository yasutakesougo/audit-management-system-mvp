import { expect, test } from '@playwright/test';
import { bootNursePage } from './_helpers/bootNursePage';
import { MEDICATION_SEED_USERS, seedMedicationDemoData } from './_helpers/nurseMedicationSeed';

test.skip(true, 'Legacy nurse medication inventory UI is not part of the BP MVP surface.');

const defaultUser = MEDICATION_SEED_USERS[0];

if (!defaultUser) {
  throw new Error('MEDICATION_SEED_USERS is empty; cannot run medication e2e spec.');
}

test.describe('@ci-smoke nurse medication', () => {
  test.beforeEach(async ({ page }) => {
    await bootNursePage(page, { seed: { nurseDashboard: true } });
    await seedMedicationDemoData(page);
  });

  test('registers a backup medication with expiry tracking', async ({ page }) => {
    await page.goto('/nurse/medication');
    await expect(page.getByRole('heading', { name: '服薬ストック一覧' })).toBeVisible();
  await expect(page.getByRole('heading', { name: defaultUser.name })).toBeVisible();

    await page.getByRole('button', { name: '在庫を登録' }).click();

    const dialog = page.getByRole('dialog', { name: '服薬ストックを登録' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('combobox', { name: '区分' }).click();
    await page.getByRole('option', { name: '頓服' }).click();
    await dialog.getByLabel('薬剤名').fill('レスキュー座薬 10mg');
    await dialog.getByLabel('用法・指示').fill('発作時 1本 経肛門（最大1日2回）');
    await dialog.getByLabel('在庫数').fill('3');
    await dialog.getByLabel('単位').fill('本');
    await dialog.getByLabel('消費期限').fill('2026-03-31');
    await dialog.getByLabel('保管場所').fill('医務室：耐熱保冷庫');
    await dialog.getByLabel('処方医・医療機関').fill('△△こどもクリニック / 鈴木医師');
    await dialog.getByLabel('備考').fill('使用後は速やかに医師へ報告し、補充手配を行う');

    await dialog.getByRole('button', { name: '登録する' }).click();

    await expect(page.getByRole('alert')).toContainText(`${defaultUser.name} さんの在庫を登録しました`);
    await expect(page.getByText('レスキュー座薬 10mg')).toBeVisible();
  });
});

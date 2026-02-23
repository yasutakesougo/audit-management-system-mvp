# Schedule Org Tab E2E Test Contract

## 概要
Schedule Org Tab の E2E テストが安定して動作するための「契約」を定義したドキュメント。

## 改善完了サマリ

| 改善項目 | Before | After | 効果 |
|---------|--------|-------|------|
| **1. Fixture 契約保証** | 暗黙的（存在のみ） | 明示的（利用経路も検証） | fixture が確実に適用されることを保証 |
| **2. Testid 粒度固定** | 曖昧（`schedule-org-tab`） | 明確（`schedule-org-tabpanel`） | パネル vs タブの区別が明確 |
| **3. ラベル分離** | 完全一致必要 | 部分一致 OK | 文言変更に強い |
| **4. 契約ドキュメント** | なし | コメント＋コード内 assert | 将来の変更者が契約を認識できる |

## 再発防止に効く理由

- ✅ **存在保証**: `DEFAULT_ORG_FIXTURES` に入っている
- ✅ **利用保証**: テスト側で option 存在を assert
- ✅ **命名明確化**: testid が何を指すか一意
- ✅ **文言耐性**: ID ベース検証＋部分一致

## 契約内容

### Fixture Contract
**ファイル**: `tests/e2e/_helpers/bootSchedule.ts`

```typescript
/**
 * DEFAULT_ORG_FIXTURES: E2E test contract for org-based schedule views.
 * Tests (e.g., schedule-org-tab.smoke.spec.ts) rely on these org codes:
 * - 'all': All organizations view
 * - 'main': Main facility
 * - 'shortstay': Short-term stay service
 * DO NOT remove or rename OrgCode values without updating dependent tests.
 */
const DEFAULT_ORG_FIXTURES = [
  { OrgCode: 'all', Title: '全事業所（統合ビュー）', ... },
  { OrgCode: 'main', Title: '生活介護（本体）', ... },
  { OrgCode: 'shortstay', Title: '短期入所', ... },
];
```

### UI Contract
**ファイル**: `src/features/schedules/routes/WeekPage.tsx`

- **Testid**: `schedule-org-tabpanel` (組織タブパネル全体)
- **Testid**: `schedule-org-select` (組織選択 select 要素)
- **Testid**: `schedule-org-summary` (選択中の組織名表示)

### Test Contract
**ファイル**: `tests/e2e/schedule-org-tab.smoke.spec.ts`

```typescript
// Contract: DEFAULT_ORG_FIXTURES must include 'all', 'main', 'shortstay'
await expect(select.locator('option[value="all"]')).toBeAttached();
await expect(select.locator('option[value="main"]')).toBeAttached();
await expect(select.locator('option[value="shortstay"]')).toBeAttached();
```

## 変更履歴

- **cc950d7**: Fixture追加 + UI testid 実装 + ラベル統一
- **c80809a**: 契約強化（fixture assert + 部分一致 + ドキュメント）

## 関連 PR

- PR #568: fix(firebase): skip Firebase initialization in E2E mode to prevent auth blocking

# 段階1 実装ガイド：グループラベル再編

> **実装予定時間**: 1 時間  
> **難易度**: 🟢 低（ラベル変更のみ）  
> **リスク**: 🟢 低（UI の見た目変更）

---

## 📝 変更内容サマリー

```typescript
// 変更ファイル: src/app/config/navigationConfig.ts (1箇所)

// Before
export const groupLabel: Record<NavGroupKey, string> = {
  daily: '🗓 日次',
  record: '🗂 記録・運用',
  review: '📊 振り返り・分析',
  master: '👥 マスタ',
  admin: '🛡 管理',
  settings: '⚙️ 設定',
};

// After
export const groupLabel: Record<NavGroupKey, string> = {
  daily: '📌 今日の業務',
  record: '📚 記録を参照',
  review: '🔍 分析して改善',
  master: '👥 利用者・職員',
  admin: '⚙️ システム管理',
  settings: '⚙️ 表示設定',
};
```

---

## 🔧 実装ステップ

### ステップ 1-1: navigationConfig.ts を編集

**ファイル**: `src/app/config/navigationConfig.ts`  
**行番号**: L44-49  
**変更量**: 6 行

```typescript
/**
 * Navigation group labels with new, action-oriented names
 * Order: daily → record → review → master → admin → settings
 * 
 * Changes (2026-02-23):
 * - daily: 日次 → 今日の業務 (daily nature emphasis)
 * - record: 記録・運用 → 記録を参照 (past data reference)
 * - review: 振り返り・分析 → 分析して改善 (action-oriented)
 * - master: マスタ → 利用者・職員 (specific nouns)
 * - admin: 管理 → システム管理 (clear admin area)
 * - settings: 設定 → 表示設定 (specificity)
 */
export const groupLabel: Record<NavGroupKey, string> = {
  daily: '📌 今日の業務',
  record: '📚 記録を参照',
  review: '🔍 分析して改善',
  master: '👥 利用者・職員',
  admin: '⚙️ システム管理',
  settings: '⚙️ 表示設定',
};
```

---

## ✅ テスト & 確認

### テスト1: 単体テスト（navigationConfig.spec.ts）

```typescript
// tests/unit/app/config/navigationConfig.spec.ts

describe('navigationConfig', () => {
  describe('groupLabel', () => {
    it('should have updated labels', () => {
      expect(groupLabel.daily).toBe('📌 今日の業務');
      expect(groupLabel.record).toBe('📚 記録を参照');
      expect(groupLabel.review).toBe('🔍 分析して改善');
      expect(groupLabel.master).toBe('👥 利用者・職員');
      expect(groupLabel.admin).toBe('⚙️ システム管理');
      expect(groupLabel.settings).toBe('⚙️ 表示設定');
    });

    it('should maintain all required keys', () => {
      const requiredKeys: NavGroupKey[] = [
        'daily',
        'record',
        'review',
        'master',
        'admin',
        'settings',
      ];
      
      requiredKeys.forEach((key) => {
        expect(groupLabel[key]).toBeDefined();
        expect(typeof groupLabel[key]).toBe('string');
      });
    });
  });
});
```

**実行**:
```bash
npm test -- navigationConfig.spec.ts
```

### テスト2: E2E テスト（ビジュアル確認）

```bash
# サイドメニューが表示される E2E テストを実行
npm run test:e2e:smoke -- --project=chromium

# 期待結果: '📌 今日の業務' がメニューに表示されている
```

### テスト3: 手動 UI 確認

```bash
# Dev サーバーを起動
npm run dev

# ブラウザで http://localhost:5173 を開く
#期待結果:
# □ 左サイドバーのグループラベルが新ラベルになっている
# □ 絵文字が正しく表示されている
# □ 折りたたみ時は絵文字のみ表示
# □ 展開時は完全なテキストが表示
```

---

## 📊 確認チェックリスト

実装完了後、以下を確認してください：

- [ ] `groupLabel` が新ラベルに更新された
- [ ] TypeScript コンパイル エラーなし
  ```bash
  npm run typecheck
  ```
- [ ] 既存テスト全て PASS
  ```bash
  npm test
  ```
- [ ] E2E smoke test PASS
  ```bash
  npm run test:e2e:smoke
  ```
- [ ] ローカルで UI が正しく表示
  - [ ] デスクトップビュー
  - [ ] モバイルビュー（≤600px）
  - [ ] ダークテーマ
  - [ ] ライトテーマ
- [ ] スクリーンショットを更新（ドキュメント用）

---

## 🔄 ロールバック手順

万が一問題が発生した場合：

```bash
# 最後の変更を取り消す
git checkout -- src/app/config/navigationConfig.ts

# または最後の commit を取り消す
git revert HEAD
```

---

## 📸 ビフォー・アフター

### 実装前（現行）

```
🗓 日次
├─ 日次記録
├─ 健康記録
├─ ...

🗂 記録・運用
├─ 黒ノート一覧
├─ ...

📊 振り返り・分析
├─ 分析
├─ ...

👥 マスタ
├─ 利用者
├─ 職員

🛡 管理
├─ 自己点検
├─ 監査ログ
```

### 実装後（提案版）

```
📌 今日の業務
├─ 日次記録
├─ 健康記録
├─ ...

📚 記録を参照
├─ 黒ノート一覧
├─ ...

🔍 分析して改善
├─ 分析
├─ ...

👥 利用者・職員
├─ 利用者
├─ 職員

⚙️ システム管理
├─ 自己点検
├─ 監査ログ
```

**変化**:
- **より具体的** な名前で、ユーザーの利用シーンが想像しやすい
- **絵文字が統一** され、視覚的に区分しやすい
- **「業務」「参照」「改善」「管理」** という動詞が暗に含まれている

---

## 💬 ユーザーへの説明文

このラベル変更をユーザーに説明する際のサンプル文：

```
📋 メニューが見やすくなりました

サイドメニューのラベルが変わりました：

✨ 変更点：
- 「日次」→ 「📌 今日の業務」：毎日触る機能をより明確に
- 「記録・運用」→ 「📚 記録を参照」：過去のデータを見返すエリア
- 「振り返り・分析」→ 「🔍 分析して改善」：データから学ぶエリア
- 「マスタ」→「👥 利用者・職員」：基本情報がどこにあるか一目瞭然
- 「管理」→ 「⚙️ システム管理」：管理者機能の領域を明確化

より直感的に目的の機能を探せるようになります。
```

---

## 🚀 次のステップ

段階1 の実装が完了したら、以下のいずれかに進みます：

| 選択肢 | 推奨タイミング | 内容 |
|--------|..................|------|
| **段階2 へ** | 1 週間後 | セパレーター強化 + カラーリング |
| **ユーザーテスト** | 即座に | UX 改善の効果を測定 |
| **段階3 計画** | 2 週間後 | お気に入い + ショートカット設計 |
| **一旦保留** | フィードバック待ち | ユーザーの反応を見てから |

---

## 📞 質問 & サポート

実装中に質問があれば：

1. **文法エラー**: `npm run typecheck` で確認
2. **テスト失敗**: `npm test -- --debug` でデバッグ
3. **ビジュアル崩れ**: ブラウザの DevTools で CSS を確認
4. **ロールバック**: `git checkout` で復元

---

**準備完了**: 段階1 の実装コードは上記の通りです。  
**推奨開始**: 即座に実装可能です。

いかがでしょうか？段階1 からスタートしますか、それとも他のアプローチを優先しますか？

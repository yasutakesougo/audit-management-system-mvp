# Monthly SP Structure Audit Runbook

> **目的**: SP リスト構造のドリフト（コードと SharePoint の乖離）を月次で早期発見する  
> **所要時間**: 約 10 分  
> **実施頻度**: 毎月 1 日（GitHub Actions が自動起動）または任意タイミング

---

## ① CI 整合性チェック（コード層 — 常時稼働）

PR マージ時・push 時に自動実行される。手動実行も可能。

```bash
npm run sp:audit
```

### チェック内容

| チェック | 内容 |
|---|---|
| [A] | `ListKeys` の件数 === `LIST_CONFIG` の件数 |
| [B] | `lists.manifest.json` の全エントリが `ListKeys` に存在するか |
| [C] | `ListKeys` の全メンバーが manifest または `_excluded` に記録されているか |

### 対処判断

| 結果 | 対処 |
|---|---|
| **PASSED** | 変更不要 |
| `[A]` エラー | `ListKeys` に追加した場合 `LIST_CONFIG` への登録漏れ |
| `[B]` エラー | manifest に架空のリスト名がある → `ListKeys` へ追加 or manifest から削除 |
| `[C]` Warning | `ListKeys` に登録されているが manifest 未掲載 → manifest に追加 or `_excluded` に記録 |

---

## ② SP 実体チェック（SharePoint 層 — 月次）

### 手順

**Step 1**: ブラウザで SharePoint サイトを開く

```
https://isogokatudouhome.sharepoint.com/sites/welfare
```

**Step 2**: F12 → コンソール → `scripts/sp-preprod/audit-browser-console.js` の内容を貼り付けて Enter

**Step 3**: 結果を記録する

```
===== FINAL AUDIT =====
Missing/List  : 0
Missing/Field : 0
Mismatch/Index: 0
Mismatch/Uniq : 0
OK            : XX
=======================
```

### 対処優先順位

```
1位 Mismatch/Unique  ← 重複データ混入リスク。放置すると本番障害に直結
2位 Missing/List     ← 機能自体が使えない状態
3位 Missing/Field    ← 一部機能が不正データを返す可能性
4位 Mismatch/Index   ← パフォーマンス劣化。即時影響は低い
```

> **判断原則**: 上位ほど緊急対応。1位・2位は当日中に対処、3位は週内、4位は次回月次でよい。

### 対処内容

| 優先 | カテゴリ | 対処 |
|---|---|---|
| 🔴 1 | **Mismatch/Unique** | 重複データが混入するリスク → **まず重複確認**してから制約追加 |
| 🔴 2 | **Missing/List** | 新機能追加でコードには実装されているがSPに未作成 → provision コンソールスクリプトで作成 |
| 🟡 3 | **Missing/Field** | リスト作成後にカスタムフィールドが追加されていない → フィールド追加コンソールスクリプトで対処 |
| 🟢 4 | **Mismatch/Index** | パフォーマンス低下の懸念 → インデックス追加コンソールスクリプトで対処 |
| ✅ — | **全件 OK** | 変更不要 |

### Issue 起票（エラー検出時）

```bash
# Issue フォーマット付きで実行し、出力をコピーして gh issue create に使う
npm run sp:audit -- --issue-format
```

---

## ③ 記録方法

月次チェック後、以下に結果を追記する:

```
docs/sharepoint/sp-structure-audit-log.md
```

### 記録フォーマット

```markdown
## YYYY-MM-DD

- 実施者: XXX
- SP lists found: XX
- Missing/List  : 0
- Missing/Field : 0
- Mismatch/Index: 0
- Mismatch/Uniq : 0
- OK: XX
- 対応事項: なし / [対応内容を記載]
```

---

## ④ 異常時のエスカレーション基準

| 状況 | 対応 |
|---|---|
| Missing/List が 1 件以上 | 直近のコミット差分を確認し、新規 `ListKeys` 追加がないか確認。ある場合は provision を実施。 |
| Mismatch/Unique で重複データ検出 | **そのまま制約を設定しない**。重複データを手動で解消してから制約追加。 |
| Missing/Field が 5 件以上 | manifest を確認し、フィールド定義（FIELD_MAP）と SP の乖離が大きい場合は /architect に相談。 |

---

## 関連ファイル

| ファイル | 役割 |
|---|---|
| `scripts/sp-preprod/lists.manifest.json` | SP リスト定義の SSOT |
| `scripts/sp-preprod/audit-browser-console.js` | SP 実体確認スクリプト |
| `scripts/sp-manifest-lint.ts` | CI 整合性チェックスクリプト |
| `src/sharepoint/fields/listRegistry.ts` | `ListKeys` / `LIST_CONFIG` 定義 |
| `docs/sharepoint/sp-list-registry-policy.md` | SP リスト管理ポリシー |

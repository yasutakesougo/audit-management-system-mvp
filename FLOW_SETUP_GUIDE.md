# Power Automate Flow 設定ガイド
## 15分ループを止めて Notified フラグを正しく機能させるための最終実行ガイド

**重要**: React 側は方針どおりに Notified を制御できる状態ですが、実際に二重投稿を止めるかは **Flow の Get items と Update item が 100%** 決定します。このガイドに沿って 1 回の実行で勝敗を確定してください。

---

## 📋 事前準備（1分）

**必須確認**:
- 対象リスト: **Diagnostics_Reports**
- 必須列: `Overall` (Choice), `Notified` (Boolean), `NotifiedAt` (DateTime)
- テスト用: warn/fail のアイテムを1件作成（React からでも SharePoint からでも OK）
- **重要**: そのアイテムの Notified が **false** になっていることを確認
  - ここが true なら Flow は拾わない（→ 詰み）

---

## 🎯 Flow 最終実行ガイド（1回の実行で勝敗確定）

### ✅ Step 0: トリガーの切り替え（重要）

**最初の検証は「手動トリガー」でやる** → Recurrence だとログが追いづらい

- 編集画面の最初のアクション（現在: Recurrence 15 分）を **手動実行** に変更
- 検証が終わったら Recurrence に戻す

---

### ✅ Step 1: Get items（複数の項目の取得）

**ここで "拾い続ける原因" が確定する最初の分岐点です**

**設定**:
```
Site Address: https://.../sites/msteams_417ab9
List Name:    Diagnostics_Reports
```

**OData Filter Query（どっちか動く方を採用）**:

**まず A を試す**:
```
Notified ne true
```

**A が「クエリが無効」とエラーなら B に切り替え**:
```
Notified ne 1
```

> SharePoint/コネクタの差で boolean が true/1 で扱われます。通った方を正に固定してください。

**Top Count**:
```
50
```

**期待結果**:
- warn/fail で Notified=false のアイテムが `value` 配列に入る
- Notified=true のアイテムは拾われない

---

### ✅ Step 2: Apply to each（Foreach）

**ここは "String になってる地獄" を潰すステップ**

**正しい設定方法**:
1. "Apply to each" アクションをクリック
2. 入力フィールド → **動的なコンテンツ** タブ
3. `複数の項目の取得` → **value** をクリック

> ✅ これが最も事故が少ないです

**どうしても式で入れる場合**（3点メニュー → 式）:
```
@body('複数の項目の取得')?['value']
```

**❌ これ以外の形式（例：文字列として入っている形）は String 扱いになって、後の items(...) が失敗します**

---

### ✅ Step 3: Condition（pass を弾く）

**ここで pass/pass\n/PASS を全部落とします**

**手順**:
1. Condition アクションの右上 **…** → **式**
2. 現在の内容を削除
3. 以下をコピペ:

```
@not(equals(
  toLower(trim(string(items('Apply_to_each')?['Overall']?['Value']))),
  'pass'
))
```

**重要**:
- `Apply_to_each` は**あなたのループ名に合わせてください**（別名なら修正）
- `trim()` が `pass\n` (改行混入) を殺します ← ここが地味に効く
- `toLower()` が PASS/Pass を落とします

**期待結果**:
- Overall = pass のアイテムは投稿されない
- warn/fail だけが次に進む

---

### ✅ Step 4: Teams に投稿（Flow bot）

**設定例**:
```
Channel: #your-channel
Subject: 診断結果
Message: 
作成者: @{items('Apply_to_each')?['Author']?['DisplayName']}
Overall: @{items('Apply_to_each')?['Overall']?['Value']}
Title: @{items('Apply_to_each')?['Title']}
```

> 投稿者名は Flow bot になります（安武宗吾にはなりません）

---

### ✅ Step 5: Update item（項目の更新）← **ここが二重投稿地獄の爆弾**

**このステップが失敗 or 文字列化すると 15 分ループ確定です**

**必須設定**:

| フィールド | 値 |
|-----------|-----|
| **ID** | `items('Apply_to_each')?['ID']` （動的コンテンツ） |
| **Notified** | `true` |
| **NotifiedAt** | `@{utcNow()}` （**式タブから**） |

**NotifiedAt の入力方法（重要）**:
1. NotifiedAt フィールドをクリック
2. 右下の **式** タブをクリック
3. 以下を入力:
```
@{utcNow()}
```
4. OK をクリック

**❌ これはダメ**:
```
"utcNow()"        ← 文字列リテラル（更新されない地獄）
"@ utcNow() "     ← 文字列リテラル（更新されない地獄）
```

**期待結果**:
- SharePoint で Notified=true に更新される
- NotifiedAt に現在時刻が記録される
- 次回の Get items でこのアイテムは拾われない

---

## 🧪 1回の実行で勝敗が確定する検証（最重要）

Flow を1回実行したら、**必ずこの 3 つをチェック**:

### ✅ チェック A: Update item の出力

**確認方法**:
1. Flow の実行履歴を開く
2. "項目の更新" アクションをクリック
3. 出力パネルを見る

**確認内容**:
```json
{
  "body": {
    "Notified": true,
    "NotifiedAt": "2026-01-25T15:30:45.123Z",
    ...
  }
}
```

**❌ Notified が false のまま or NotifiedAt が文字列なら**:
- Update item の ID / Notified / NotifiedAt の設定を確認
- NotifiedAt が式（`@{utcNow()}`）になっているか再確認

---

### ✅ チェック B: SharePoint 側の実値

**確認方法**:
1. SharePoint の Diagnostics_Reports リストを開く
2. テスト用アイテムをクリック
3. 詳細パネルで Notified / NotifiedAt を確認

**確認内容**:
```
Notified:   ✅ true に更新されている
NotifiedAt: ✅ 投稿直後の時刻が記録されている
```

**❌ Notified が false のまま / NotifiedAt が空なら**:
- Update item が実際には実行されていない
- アクション出力エラーがないか確認
- ID の指定が間違っていないか確認

---

### ✅ チェック C: 次回の Get items が空になるか

**確認方法**:
1. テスト用アイテムの Notified が true のままで
2. Flow を **もう1回実行**
3. 実行履歴の "複数の項目の取得" 出力を確認

**確認内容**:
```json
{
  "body": {
    "value": []   ← 空配列 = 勝ち！
  }
}
```

**❌ 同じアイテムがまた拾われたら**:
- Get items の Filter Query が間違っている（手順1に戻る）
- Notified が実は false のままになっている（チェック A/B を再確認）

---

## ⚠️ よくある詰みポイント（即死回避）

### 詰みポイント 1: Apply to each が String になってる

**症状**: foreach の中の `items('Apply_to_each')` が赤くなる / エラー出る

**原因**: Apply to each の入力が `@{outputs(...)}` という文字列として入ってる

**確認方法**:
```json
❌ "inputs": {
  "from": "eyJWYWx... " ← 文字列（Base64化）
}

✅ "inputs": {
  "from": "@body('複数の項目の取得')?['value']"
}
```

**修正**:
- Apply to each の入力を **動的なコンテンツ** → value に統一
- または式タブで `@body('複数の項目の取得')?['value']` を確認

---

### 詰みポイント 2: Get items が「クエリが無効」

**症状**: "複数の項目の取得" がエラーで止まる / "クエリが無効" メッセージ

**原因**: `Notified ne true` が環境で通らない

**修正**:
- Filter Query を `Notified ne 1` に切り替え
- どっちが動くかは環境依存です

---

### 詰みポイント 3: Notified が投稿後に更新されない

**症状**: 
- チェック A の出力には Notified=true が出ているのに
- チェック B で SharePoint は Notified=false のまま
- チェック C で次回また拾われる

**原因候補**（優先度順）:
1. **NotifiedAt が文字列になっている** ← 最多
   - 式タブ `@{utcNow()}` を確認
2. **Update item の ID が違う**
   - `items('Apply_to_each')?['ID']` を確認
3. **Update item の列名が違う**
   - SharePoint の内部名（ID / Notified / NotifiedAt）を確認

**確認方法**:
- Flow の実行履歴から Update item のアクション JSON を確認
- `"NotifiedAt": "@{utcNow()}"` になっているか
- `"NotifiedAt": "utcNow()"` （文字列）になってないか

---

## 🎬 実行手順（まとめ）

| ステップ | 実行 | 確認ポイント |
|---------|------|------------|
| **事前準備** | Notified=false のテストアイテム作成 | チェックA/B/Cの準備 |
| **Step 1** | Get items（Filter: Notified ne true） | value に未通知アイテム |
| **Step 2** | Apply to each（入力: value） | items(...) が赤くない |
| **Step 3** | Condition（trim() 入りの式） | pass は投稿されない |
| **Step 4** | Teams 投稿 | warn/fail だけ投稿される |
| **Step 5** | Update item（NotifiedAt: @{utcNow()}） | チェック A: true になっているか |
| **検証** | 2回目実行 + チェック B/C | value: [] になったか |

**最終判定**:
- ✅ チェック A/B/C すべてクリア → **勝ち**（15分ループ停止）
- ❌ どれか1つでも失敗 → 詰みポイント 1～3 を確認

---

## 📌 現状確認：5つのチェックポイント

### ✅ CP1: SharePoint リスト列（内部名）確認

**確認箇所**: SharePoint の Diagnostics_Reports リスト設定

| 列名 | 内部名 | 型 | 必須 |
|------|--------|-----|------|
| Notified | Notified | Yes/No (Boolean) | ✅ |
| NotifiedAt | NotifiedAt | 日時 | ✅ |
| Overall | Overall | **Choice: pass/warn/fail** | ✅ |
| TopIssue | TopIssue | 1行テキスト | ✅ |
| SummaryText | SummaryText | 複数行テキスト | ✅ |
| ReportLink | ReportLink | ハイパーリンク | ✅ |

**✅ 合格条件**：[src/sharepoint/fields.ts](src/sharepoint/fields.ts#L261) の `FIELD_MAP_DIAGNOSTICS_REPORTS` と内部名が完全一致

```typescript
export const FIELD_MAP_DIAGNOSTICS_REPORTS = {
  id: 'Id',
  title: 'Title',
  overall: 'Overall',        // ← Overall であること確認
  topIssue: 'TopIssue',
  summaryText: 'SummaryText',
  reportLink: 'ReportLink',
  notified: 'Notified',       // ← Yes/No 型
  notifiedAt: 'NotifiedAt',   // ← 日時型
  created: 'Created',
  modified: 'Modified',
};
```

---

### ✅ CP2: Flow の Get items が「配列」を返している

**確認箇所**: Power Automate の **Get items** アクション

**実行**:
1. Flow 内の "Get items" アクションをクリック
2. 出力パネルで `value` フィールドが見える
3. Apply to each ループの入力が `value` になっているか確認

**✅ 合格条件**:
```json
{
  "body": {
    "value": [
      { "Id": 1, "Title": "...", "Notified": false, ... },
      { "Id": 2, "Title": "...", "Notified": false, ... }
    ]
  }
}
```
- `value`: [...] という配列が出る
- Apply to each の入力が `value` である

---

### ✅ CP3: Flow のフィルタが「未通知だけ」を拾えている

**確認箇所**: Power Automate の **Get items** > フィルタークエリ

**設定方法**:
1. "Get items" アクション右上の **…** → **フィルタークエリ** をクリック
2. 以下のいずれかを入力:

```
候補A（推奨）: Notified ne true
候補B（Aで失敗したら）: Notified ne 1
```

**テスト方法**:
1. SharePoint で、Notified = **true** に手動で更新したアイテムを1件作成
2. Flow を実行
3. 出力: `value: []` （空配列）になっているか確認

**✅ 合格条件**: Notified=true のアイテムが `value` に出ない

---

### ✅ CP4: Condition が pass を確実に弾けている

**確認箇所**: Power Automate の **Condition** アクション（"高度なモード"）

**現在の問題**: Overall の比較がズレて pass も投稿されている可能性

**修正手順**:
1. Condition アクション右上の **…** → **式** をクリック
2. 現在の設定を削除
3. 以下をコピペ:

```
@not(equals(
  toLower(trim(string(items('Apply_to_each')?['Overall']?['Value']))),
  'pass'
))
```

**重要**:
- `trim()` を入れて改行混入を潰す（`pass\n` 事故防止）
- `items('Apply_to_each')` はあなたのループ名に合わせる（別名なら修正）

**✅ 合格条件**:
- Overall = pass のアイテムは投稿されない
- warn/fail だけが Teams に投稿される

---

### ✅ CP5: Patch（項目の更新）が確実に実行される

**確認箇所**: Power Automate の **Patch** または **項目の更新** アクション

**現在の問題**: NotifiedAt が **文字列** になっていて式が実行されない

```json
❌ NG: "item/NotifiedAt": "@ NotifiedAt=utcNow() "   （文字列リテラル）
❌ NG: "item/NotifiedAt": "utcNow()"                （文字列リテラル）
✅ OK: "item/NotifiedAt": "@{utcNow()}"             （式）
```

**テスト**:
1. Flow を実行して投稿が成功
2. SharePoint で該当アイテムの Notified を確認
3. `Notified = true` になっているか
4. `NotifiedAt` に 現在時刻が入っているか

**✅ 合格条件**: 投稿後、同じアイテムが次回の Get items で拾われない

---

## 🔒 最終保険：トラブル時の即チェック 3行

Flow が稼働中に問題が出た場合、以下の順で判定してください：

### ❌ パターン1: 投稿が出たのに止まらない

**症状**: Flow が実行 → Teams に投稿される → 次回また同じアイテムが投稿される

**即チェック**:
```
SharePoint の Diagnostics_Reports で該当アイテムを開く
→ Notified が true になっているか確認

❌ false のまま / 空 → Update item が効いてない
  └─ Flow の実行履歴で "項目の更新" アクションを確認
  └─ エラーが出ていないか / ID が正しいか確認

✅ true になっている → 2回目実行で value: [] を確認すること
```

---

### ❌ パターン2: Get items が毎回アイテムを拾う

**症状**: Flow を何度実行しても `value: [...]` が空にならない

**即チェック**:
```
OData フィルタが効いていない可能性：

1. Filter Query を確認
   ❌ "Notified ne true" が壊れている / 列名が違う
   ✅ "Notified ne 1" に切り替えて試す

2. SharePoint でリストを確認
   ❌ Notified 列がない / 内部名が違う
   ✅ 列の内部名を確認（[列の設定] → 内部名）

3. Get items の "Top Count" を確認
   ❌ 50 になってない → 同じアイテムが重複して出ている可能性
```

---

### ❌ パターン3: Notified は true なのに次回も拾われる

**症状**: SharePoint では `Notified=true` になっているのに、Flow が何度も実行される

**即チェック**:
```
Notified 列そのものがおかしい可能性：

1. SharePoint で列の型を確認
   ❌ Yes/No（Boolean）になっていない
   ❌ テキスト / 数値型になってないか
   → 列を作り直し（型の変更は副作用が大きい）

2. Get items で正しいリストを取得しているか
   ❌ "複数の項目の取得" が Diagnostics_Reports でなく別リストから取得
   ✅ Site Address / List Name を再確認

3. Filter Query が複数あるなら
   ❌ "Notified ne true" が AND で別条件と組まれている
   ✅ フィルタをシンプルに（Notified ne true だけ）に戻す
```

---

## 📌 Teams投稿テンプレート（オプション推奨）

現在の投稿文に既に `Title` が入っているので **そのままで強い** です。

理由:
- Title は `環境キー` として機能
- 後から検索・重複検知・問い合わせ対応が爆速
- これ以上の追加は不要

---

##  参考リンク

- React 実装: [src/sharepoint/diagnosticsReports.ts](src/sharepoint/diagnosticsReports.ts)
- 型定義: [src/sharepoint/fields.ts](src/sharepoint/fields.ts)
- UI: [src/features/diagnostics/health/HealthDiagnosisPage.tsx](src/features/diagnostics/health/HealthDiagnosisPage.tsx)
- テスト: [src/sharepoint/diagnosticsReports.spec.ts](src/sharepoint/diagnosticsReports.spec.ts)
- 統合設計書: [DIAGNOSTICS_INTEGRATION_COMPLETE.md](DIAGNOSTICS_INTEGRATION_COMPLETE.md)

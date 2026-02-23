# Cloudflare Workers 環境変数設定ガイド

**対象**: Staff Attendance 機能リリース  
**環境**: Production (本番環境)  
**実施者**: Ops / Infra Team

---

## 概要

このガイドは、Cloudflare Workers 上で Staff Attendance 機能に必要な環境変数を設定するための手順書です。

---

## 必要な環境変数

| 変数名 | 値 | 優先度 | 内容 |
|-------|-----|--------|------|
| `VITE_FEATURE_STAFF_ATTENDANCE` | `1` | 🔴 必須 | Staff Attendance 機能フラグ |
| `VITE_SCHEDULE_ADMINS_GROUP_ID` | [AD Group ID] | 🟠 推奨 | 管理者グループ ID |

---

## � **情報セキュリティ分類（重要）**

**今回設定する環境変数は、いずれもシークレット情報ではありません** ✅

| 環境変数 | 分類 | 設定方法 | 理由 |
|--------|------|--------|------|
| `VITE_FEATURE_STAFF_ATTENDANCE` | **Public** | Environment Variables | UI表示フラグ、ソースコード公開 |
| `VITE_SCHEDULE_ADMINS_GROUP_ID` | **Public** | Environment Variables | Azure AD グループ ID、権限制御用（隠す必要なし） |

### 環境変数の種類と使い分け

```
🟩 Environment Variables (今回のケース)
   用途: 機能フラグ、設定値、グループID
   設定場所: Cloudflare Dashboard → Settings → Variables
   可視性: ブラウザで確認可能

🟨 Secrets (将来のシークレット情報)
   用途: API キー、パスワード、トークン
   設定場所: CLI: wrangler secret put
   可視性: 隠蔽（値は表示されない）
   注記: 環境変数の VITE_ プレフィックスは使用禁止
```

**今後の参考**: API キーなどを扱う場合は `wrangler secret` を使用してください
```bash
# 例: API Key をシークレット化する場合
wrangler secret put API_KEY
> Enter API Key value...
```

---

## �🔧 設定手順

### ステップ 1: Cloudflare Dashboard へログイン

```
https://dash.cloudflare.com/
```

---

### ステップ 2: Workers プロジェクトを開く

1. **Workers & Pages** をクリック
2. 対象プロジェクト: `audit-management-system-mvp` (または実際の名称)
3. プロジェクト内に移動

---

### ステップ 3: Settings タブを開く

```
[Project Name] → Settings
```

パスの例:
```
Workers & Pages 
  → audit-management-system-mvp 
    → Overview / Deployments / Analytics / Settings
```

---

### ステップ 4: Variables セクションを確認

**Settings** → **Variables** セクション

以下の3つの環境変数スコープが表示されます：
- ✅ **Environment Variables** (通常環境)
- ✅ **Secrets** (機密情報)
- ✅ **KV Namespace Bindings** (データベース接続)

---

### ステップ 5: 環境変数を追加 / 更新

#### 5.1 `VITE_FEATURE_STAFF_ATTENDANCE`

**操作**:

```
[Add Variable] ボタン をクリック
```

**入力フィールド**:

| フィールド | 入力値 |
|-----------|-------|
| **Variable name** | `VITE_FEATURE_STAFF_ATTENDANCE` |
| **Value** | `1` |
| **Environment** | Production (本番環境をチェック) |

**確認**:
- [ ] Variable name: `VITE_FEATURE_STAFF_ATTENDANCE`
- [ ] Value: `1` (文字列型)
- [ ] Environment: **Production**

**保存**: `Add Variable` ボタンをクリック

---

#### 5.2 `VITE_SCHEDULE_ADMINS_GROUP_ID`

**前提条件**: Azure AD グループ ID を事前に確認

**操作**:

```
[Add Variable] ボタン をクリック
```

**入力フィールド**:

| フィールド | 入力値 |
|-----------|-------|
| **Variable name** | `VITE_SCHEDULE_ADMINS_GROUP_ID` |
| **Value** | `[Azure AD Group ID]` |
| **Environment** | Production (本番環境をチェック) |

**例**:
```
変数名: VITE_SCHEDULE_ADMINS_GROUP_ID
値: 12345678-1234-1234-1234-123456789012
```

**確認**:
- [ ] Variable name: `VITE_SCHEDULE_ADMINS_GROUP_ID`
- [ ] Value: 有効な UUID 形式 (36文字のハイフン区切り)
- [ ] Environment: **Production**

**保存**: `Add Variable` ボタンをクリック

---

### ステップ 6: 変更をデプロイ

**重要**: 環境変数を追加/更新したら、Worker を **再デプロイ** する必要があります。

**デプロイ方法 A: Cloudflare Dashboard から**

```
Workers → [Project Name] → Deployments
  → [Latest Deployment] の横の [Settings]
  → [Rollback] または [Redeploy latest version]
```

**デプロイ方法 B: CLI から**

```bash
cd audit-management-system
npm run deploy  # または Wrangler コマンド

# または詳細デプロイ:
npx wrangler deploy
```

**デプロイ完了の確認**:
```
✨ Success! Deployed worker
```

---

### ⏱️ ステップ 6.5: **環境変数反映待ち時間**

**デプロイ後、環境変数が本番環境に反映されるまでの時間**:

| シナリオ | 反映時間 | 対処 |
|--------|--------|------|
| 自動反映（推奨） | **5〜10 分** | 待機してから検証 |
| 手動デプロイ完了 | **即座** | デプロイ完了後すぐ検証可 |
| キャッシュ残存 | **最大 30 分** | ブラウザキャッシュクリア (Ctrl+Shift+Delete) |

**反映状況の確認方法**:

1. **ブラウザ F12 開く** (開発者ツール)
2. **Console タブ** に移動
3. 以下を実行:
   ```javascript
   // Worker環境変数が読み込まれているか確認
   console.log(globalThis.__ENV__ || 'ENV not loaded yet')
   
   // または個別確認
   fetch('/api/config')  // 設定APIエンドポイント
   ```

4. **VITE_FEATURE_STAFF_ATTENDANCE が見える** ✅ 反映完了

---

### ステップ 7: 環境変数が反映されたか確認

**確認方法 A: Cloudflare Dashboard**

```
Workers → [Project Name] → Settings → Variables
```

設定した変数が表示されているか確認：
- ✅ `VITE_FEATURE_STAFF_ATTENDANCE` = `1`
- ✅ `VITE_SCHEDULE_ADMINS_GROUP_ID` = `[UUID]`

**確認方法 B: ログ出力から確認**

```
Workers → [Project Name] → Analytics / Logs
```

デプロイ後のアクセスログで、環境変数が正しく読み込まれているか確認

---

## 🧪 検証手順

### 検証 1: ブラウザから本番サイトにアクセス

```
https://audit.example.com/
```

**期待結果**:
- ✅ ページが正常に読み込まれる
- ✅ ナビゲーションに **「スタッフ出勤」** メニューが表示される
- ✅ ユーザーの権限に応じて、メニューの可視性が適切に制御される

---

### 検証 2: 開発環境での E2E テスト実行

```bash
cd audit-management-system

# 環境変数をセット
export VITE_FEATURE_STAFF_ATTENDANCE=1
export VITE_SCHEDULE_ADMINS_GROUP_ID="[対象のグループID]"

# E2E スモークテストを実行
npm run test:e2e:smoke
```

**期待結果**:
```
✓ 45 passed
✓ 2 skipped
✓ 0 failed
```

---

### 検証 3: 権限チェック

**テストケース 1**: 管理者ユーザーでアクセス
```
予想: スタッフ出勤ページへアクセス可能 ✅
```

**テストケース 2**: 一般ユーザーでアクセス
```
予想: アクセス制限メッセージが表示される ✅
```

---

## ❌ トラブルシューティング

### 問題 1: スタッフ出勤メニューが表示されない

**原因**: `VITE_FEATURE_STAFF_ATTENDANCE` が設定されていない

**対処**:
1. Cloudflare Dashboard で Variables を確認
2. 値が `1` (文字列) に設定されているか確認
3. Worker を再デプロイ
4. ブラウザキャッシュをクリア (Ctrl+Shift+Delete)

---

### 問題 2: 権限チェックが機能しない

**原因**: `VITE_SCHEDULE_ADMINS_GROUP_ID` が不正な値

**対処**:
1. Azure AD で グループ ID を再確認
2. UUID 形式が正しいか確認 (36文字のハイフン区切り)
3. 該当グループがユーザーに割り当てられているか確認
4. Worker を再デプロイ

---

### 問題 3: E2E テストが失敗する

**原因**: 環境変数が本番環境に反映されていない

**対処**:
```bash
# ローカル環境で確認
npm run build --mode production
npm run test:e2e:smoke
```

エラーメッセージをチェック → Dev Team に報告

---

## 📋 チェックリスト

設定完了時の確認事項:

```
[ ] VITE_FEATURE_STAFF_ATTENDANCE = "1" (Production)
[ ] VITE_SCHEDULE_ADMINS_GROUP_ID = "[UUID]" (Production)
[ ] Worker を再デプロイ完了
[ ] ブラウザでメニュー表示確認 ✅
[ ] E2E テスト実行 (45/45 合格) ✅
[ ] 権限チェック動作確認 ✅
```

---

## 📞 サポート

設定に問題が発生した場合:

1. **Dev Team に報告**: エラーメッセージと試した対処方法を含める
2. **ログを確認**: Cloudflare Logs / Worker Analytics
3. **本番環境ロールバック**: 必要に応じて設定を元に戻す

---

## 参考リンク

- Cloudflare Workers ドキュメント: https://developers.cloudflare.com/workers/
- Environment Variables: https://developers.cloudflare.com/workers/configuration/environment-variables/
- Azure AD グループ ID 確認: https://portal.azure.com/

---

**作成日**: 2026-02-23  
**最終確認**: 2026-02-24

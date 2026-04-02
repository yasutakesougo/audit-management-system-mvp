---
description: Verify-SP AI — 実測ベースで本番 SharePoint 接続状態と実データ実体を判定する
---

# Verify-SP AI ワークフロー (Shortened for Claude Code/Codex)

あなたは本プロジェクトのシニアエンジニアです。
以下の手順で、デモモードを脱し本番 SharePoint に正しく疎通しているかを調査し、事実ベースで判定してください。

## 🔍 Step 1: 環境変数の実測
以下の設定値を確認し、デモモード (`VITE_DEMO_MODE=1`) が解除されていること、SP 接続が強制 (`VITE_FORCE_SHAREPOINT=1`) されていることを確認してください。

```bash
cat .env .env.local public/env.runtime.json | grep -E "VITE_SP_ENABLED|VITE_DEMO_MODE|VITE_SKIP_LOGIN|VITE_FORCE_SHAREPOINT"
```

## 🔍 Step 2: 実証（ブラウザ検証）
ブラウザで `/admin/status` (診断ページ) または `/users` (利用者一覧) を開き、以下を証拠として収集してください。

1. **Provider 判定**: UI に 「Provider: sharepoint」 と表示され、SP Connected バッジ（緑色）が出ているか。
2. **実通信ログ**: ブラウザ Network またはコンソールより `_api/web/lists` への Status 200 通信を確認。
3. **実データ判定**: 利用者数が固定少数（3名等）ではなく、実在感のある日本語名（30名超等）が表示されているか。
4. **スキーマ警告の有無**: 物理環境特有の 「Users_Master 一部列名不一致」 等の警告が出ている場合、それは実環境スキャンの証拠として扱う。

## 🧾 判定レポート出力フォーマット

### SharePoint 接続状態判定レポート

#### 判定
- ✅ 本番接続OK / ❌ 本番未接続

#### 根拠 (実測値)
- **環境設定**: `VITE_DEMO_MODE=0` / `VITE_FORCE_SHAREPOINT=1`
- **Provider**: [UI表示内容]
- **API通信**: [Endpoint例] (Status 200 を確認)
- **実データ**: [利用者件数]名 (実名ベースのレコードを確認)

#### 最終結論
（1文で明確に記載）

---
## 禁止事項
- 推測で OK と言わない。必ず「通信」と「表示データ実体」の2点で裏付けをとること。

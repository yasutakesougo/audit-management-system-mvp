# Handoffs Implementation Verification Checklist

本ドキュメントは、申し送り（Handoffs）機能の SharePoint 接続モード（`VITE_SP_ENABLED=true`）の動作確認用チェックリストです。

## 前提条件

1. **SharePoint へのデプロイ**
   - `provision/schema.xml` をもとに、`scripts/provision-handoffs-pnp.ps1` を用いて、対象サイトに `Handoffs` リストが正常に作成されていること。

2. **アプリの環境変数設定**
   - `.env.local` 等で以下の環境変数が設定されていること:
     ```env
     VITE_SP_ENABLED=true
     VITE_SP_RESOURCE=...
     VITE_SP_SITE_RELATIVE=...
     VITE_SP_SITE_URL=...
     VITE_MSAL_CLIENT_ID=...
     ```

## テストケース一覧

### 1. リストスキーマの正確性
- [ ] SharePointの「設定 > アプリの追加」等から作成された `Handoffs` リストを開き、リスト設定から内部名が期待通り `cr015_...` となっている。
- [ ] `cr015_recordId` と `cr015_targetDate` にインデックスが張られている。
- [ ] `cr015_recordId` に一意の制約（Enforce unique values）がかかっている。

### 2. CRUD機能の疎通
- [ ] **Create (POST)**: `HandoffComposerDialog` から申し送りを追加し、エラーが出ずに完了する。
- [ ] SharePointの直接見え方確認: SharePointのリスト上に「未読 (unread)」状態で対象のデータが存在している。
- [ ] タイトルが `{userId}_{targetDate}_{priority}` 形式でセットされている。
- [ ] **Read (GET)**: `/today` 画面などをリロードしても対象日の申し送りが読み込まれる。
- [ ] 未読アイテムに対し赤い「未読」ラベルなどが正しく表示される。
- [ ] 対象者未指定の場合の表現（「全体共有」など）がされている。
- [ ] **Update (PATCH / MERGE)**: アイテムカードの「確認済みにする」をクリックし、エラーがなくグレーアウト状態に切り替わる。
- [ ] リロードしても既読状態（ステータスが `read`）になっている。

## 注意事項
- Handoff には今の段階では Delete / 編集 は未実装で仕様外ですが、今後の拡張に備えて `recordId` での一意性を担保しています。
- REST APIの `$filter=cr015_recordId eq 'xxx'` による単一取得に依存した Update() になっている点を確認します。

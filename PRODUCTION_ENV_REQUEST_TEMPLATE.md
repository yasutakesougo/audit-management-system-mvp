# 運用チーム向け: 環境変数設定依頼メール（テンプレート）

---

**件名**: [緊急対応] 本番環境 - Staff Attendance 機能リリース環境変数設定依頼

**宛先**: インフラ/運用チーム、Cloudflare Workers 管理者

---

## メール本文

お疲れ様です。

**Audit Management System** の **Staff Attendance (スタッフ出勤管理) 機能** が本番環境にリリースされます。

本リリースに必要な環境変数セットアップについて、**最終確認と設定依頼**です。

---

## 📋 設定対象環境変数

### 環境変数 1: `VITE_FEATURE_STAFF_ATTENDANCE`

| 項目 | 内容 |
|------|------|
| **変数名** | `VITE_FEATURE_STAFF_ATTENDANCE` |
| **値** | `1` |
| **設定箇所** | Cloudflare Workers KV / 環境変数設定 |
| **説明** | スタッフ出勤管理機能を有効化 |
| **リリース日** | 2026年2月25日（予定） |

**設定手順**:
1. Cloudflare Dashboard にログイン
2. Workers → [プロジェクト名] → Settings
3. Variables セクションを開く
4. 以下を追加 (または確認/更新):
   ```
   VITE_FEATURE_STAFF_ATTENDANCE = "1"
   ```
5. 保存して デプロイ

---

### 環境変数 2: `VITE_SCHEDULE_ADMINS_GROUP_ID`

| 項目 | 内容 |
|------|------|
| **変数名** | `VITE_SCHEDULE_ADMINS_GROUP_ID` |
| **値** | [Azure AD グループ ID] ※確認待ち |
| **設定箇所** | Cloudflare Workers KV / 環境変数設定 |
| **説明** | スケジュール管理権限を持つ Azure AD グループ |
| **権限レベル** | 管理者のみ |

**確認項目**:
- [ ] 対象 Azure AD グループが特定されているか
- [ ] グループ ID が正確か
- [ ] 該当ユーザーが実際にそのグループに所属しているか
- [ ] SharePoint サイトの権限設定と一致しているか

**該当する可能性のあるグループ**:
- `audit-admins` / `audit-managers` グループの ID
- 既存の「スケジュール管理者」グループ

---

## ✅ 前提条件 (Dev チーム確認済み)

- ✅ UI/機能実装完了
- ✅ E2E テスト: **45/45 合格**
- ✅ ユニットテスト: **8/8 合格**
- ✅ Code Review: **PR #582 マージ完了**
- ✅ TypeScript コンパイル: **エラーなし**
- ✅ ESLint チェック: **通過**

---

## 🚀 設定後の検証

設定完了後は、以下の検証をお願いします：

```bash
# 開発環境で本番設定をシミュレート
npm run build -- --mode production
npm run test:e2e:smoke  # E2E テスト再実行
```

**期待結果**:
- E2E テスト: 45/45 合格
- ナビゲーション: スタッフ出勤メニュー表示
- 権限チェック: 管理者のみアクセス可能

---

## ⚠️ **重要：設定反映タイミングの確認**

**Cloudflare Workers の環境変数設定後、以下のいずれかの操作が必要です**：

```
□ 設定保存後、自動で反映される場合
  → 5〜10 分待ってから検証を実行

□ 手動デプロイが必要な場合
  → Workers → Deployments → [最新デプロイ] → Redeploy
  → デプロイ完了後に検証を実行

□ 不明な場合
  → Cloudflare サポートドキュメント確認
  → または Dev Team に確認
```

**確認方法**:
```
1. 環境変数を設定保存
2. 本番環境にアクセス: https://audit.example.com/
3. ブラウザコンソール (F12) で確認:
   - window.__ENV__.VITE_FEATURE_STAFF_ATTENDANCE === "1"
4. 確認後、E2E テストを実行
```

**※反映されていない場合は Dev Team に報告してください**

---

## 🔐 **情報セキュリティ：環境変数の分類**

今回設定する2つの環境変数は、**いずれもシークレット情報ではありません** ✅

| 環境変数 | 分類 | アクセス制御 | 理由 |
|--------|------|-----------|------|
| `VITE_FEATURE_STAFF_ATTENDANCE` | **Public** | 不要 | UI表示の機能フラグ、ソースコードに含まれる |
| `VITE_SCHEDULE_ADMINS_GROUP_ID` | **Public** | 不要 | Azure AD グループ ID、権限チェック用（隠す必要なし） |

**注記**: 今後 API キー や パスワード を扱う場合:
- `VITE_` プレフィックス → 使用禁止 ❌
- `wrangler secret` コマンド使用 → 使用推奨 ✅

詳細は Cloudflare ドキュメント参照：
https://developers.cloudflare.com/workers/configuration/secrets/

---

## 📞 **サポート体制**

設定に不明な点や問題が発生した場合：

| 場面 | 連絡先 | 対応内容 |
|------|--------|--------|
| 設定手順の確認 | Dev Team | `CLOUDFLARE_ENV_SETUP_GUIDE.md` で詳細説明 |
| Azure AD グループ ID 不明 | AD管理者 | グループ ID 特定支援 |
| 環境変数反映されない | Dev Team + Cloudflare Support | トラブルシューティング |
| 緊急ロールバック | インフラ / DevOps | 設定を元に戻す |

---

## 📅 対応期限

| マイルストーン | 期限 | 担当 |
|---------------|------|------|
| 本番環境 環境変数設定 | **2026年2月24日** | Ops/Infra |
| 環境変数設定確認 | **2026年2月24日 17:00** | Dev + Ops |
| 本番デプロイ | **2026年2月25日** | DevOps |
| リリース公開 | **2026年2月25日 12:00** | PM |

---

## 🔗 参考資料

- ✅ 設定確認チェックリスト: `PRODUCTION_ENV_CHECKLIST.md`
- ✅ PR #582: Staff Attendance 機能実装
- ✅ E2E テスト結果ログ: `tests/e2e/`

---

## 💬 質問・不明点

以下の項目が不明な場合は、**開発チーム** までお問い合わせください：

1. Azure AD グループ ID の特定方法
2. Cloudflare Workers の環境変数設定方法
3. テスト実行方法

---

## 完了報告

設定が完了したら、以下の形式で報告をお願いします：

```
設定完了報告

✅ VITE_FEATURE_STAFF_ATTENDANCE = "1" ... [完了日時]
✅ VITE_SCHEDULE_ADMINS_GROUP_ID = "[グループID]" ... [完了日時]
✅ 本番環境デプロイ完了 ... [完了日時]

次のステップ: E2E テスト実行予定
```

---

**送信者**: Dev Team  
**送信日**: 2026-02-23  
**優先度**: 🔴 High

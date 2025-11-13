# 🧭 Security Playbook（セキュリティプレイブック）

> 最終更新日: 2025-11-11  
> 管理責任者: システム管理部門  
> 対象: 開発・運用・監査チーム  
> 関連ドキュメント: [README.md](./README.md)

---

## 1. 目的とスコープ

このプレイブックは、本システムにおける **認証・通信・データ保護・監査** の全方針を一元化し、
技術的・組織的なセキュリティ基準を開発チーム・運用チーム間で共通化することを目的とします。

適用範囲:
- Web アプリケーション（SPA, API, Power Automate 連携）
- SharePoint Online / Graph API / Azure AD
- 内部 CI/CD（GitHub Actions）およびローカル開発環境

---

## 2. 方針の全体構造

| カテゴリ | 主な内容 | 詳細ドキュメント |
|-----------|-----------|------------------|
| CSP（コンテンツセキュリティ） | script-src / style-src の厳格化、Report-Only 運用、CI ガード | [csp.md](./csp.md) |
| MSAL / Azure AD 認証 | Redirect フロー、SPA 登録、スコープ管理、トークンリフレッシュ | msal.md（予定） |
| SharePoint 権限管理 | 委任スコープ、アプリ権限付与、リストスキーマ整合 | sharepoint-access.md（予定） |
| データ保護・保持ポリシー | 個人情報・支援記録の分類、保持期間、削除フロー | data-protection.md（予定） |
| CI/CD セキュリティ | CSP Guard, lint/typecheck, Secrets 管理, branch protection | 本書および ci-security.md（予定） |

---

## 3. インシデント対応手順

1. **違反検知**  
   - CSP Collector（`violations.ndjson`）または MSAL エラーレポートを自動検知  
   - GitHub Actions の `test-csp.yml` がアラートを発行した場合は Slack / Teams 通知

2. **一次分析**  
   - NDJSON の内容（`source-file`, `blocked-uri`, `directive`）を抽出  
   - ローカルで再現し、再発防止策を Issue に記録

3. **是正措置**  
   - CSP ヘッダー修正、ライブラリ更新、環境変数の更新を実施  
   - 対応完了後に CI の再実行 → 成功を確認してクローズ

4. **報告・共有**  
   - `/docs/security/violations/YYYY-MM-DD.md` に概要と修正内容を残す  
   - 定例レビューで再発防止策をチーム共有

---

## 4. CI/CD セキュリティガードライン

- **lint / typecheck**: 全ブランチで必須。`husky` フックによる pre-commit 検証を維持。  
- **CSP Guard**: `test-csp.yml` により Report-Only 検証を自動実行。  
- **Secrets 管理**: GitHub Secrets + `.env.local`（ローカル限定）で分離管理。  
- **Branch Protection**: main / staging への直接 push 禁止。PR 経由でのみマージ可能。  
- **E2E スモーク**: `schedule-week.aria.smoke.spec.ts` 等で主要 UI の健全性を保証。

---

## 5. 年次レビューと証跡管理

| 対象 | 頻度 | 実施者 | 証跡 |
|------|------|--------|------|
| CSP Report 分析 | 半年 | 開発責任者 | `/csp-reports/YYYY` |
| MSAL App 権限確認 | 年 1 回 | 管理者 | Azure Portal Export |
| SharePoint スキーマ検証 | 半年 | Power Platform 管理者 | `schema-audit.md` |
| Data Retention レビュー | 年 1 回 | 個人情報保護責任者 | `data-protection.md` |

---

## 6. 改訂とドキュメント運用

- 更新提案は GitHub Issue タグ `security:policy` で管理。  
- 改訂時は Pull Request に以下を必ず含める：
  - 変更概要・根拠リンク（法令・ Microsoft Docs 等）
  - 実装済み CI での通過証跡（lint/test/log）
- 承認後、`CHANGELOG.md` にセキュリティ更新履歴を追記。

---

## 7. 参考文献

- [Microsoft 365 Security Best Practices](https://learn.microsoft.com/ja-jp/microsoft-365/security/)
- [Azure AD MSAL.js Docs](https://learn.microsoft.com/azure/active-directory/develop/msal-overview)
- [OWASP ASVS 4.0.3](https://owasp.org/www-project-application-security-verification-standard/)
- [JNSA セキュリティ実装チェックリスト](https://www.jnsa.org/result/ossdl/)

---

> **補足:**  
> 本書は「技術基準書」として監査・開発双方で共有可能です。  
> 監査レビュー用に PDF 変換する場合は `npm run docs:pdf` スクリプトを利用してください。

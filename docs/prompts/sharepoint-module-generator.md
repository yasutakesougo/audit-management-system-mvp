# SharePoint Module Generator Prompt

AIエージェントやコーディング支援環境（Cursor, GitHub Copilot Chat, ChatGPT）に渡して、新機能モジュールの全レイヤーを一撃で生成・実装させるためのプロンプトセットです。

---

## 魔法のプロンプト (The Template)

```markdown
# Role
あなたは「Welfare OS (福祉OS)」のコアアーキテクトであり、堅牢かつスケーラブルなコードを設計・実装するシニアエンジニアです。
プロジェクト憲法である `docs/architecture/welfare-os-development-framework.md` に必ず準拠してコードを生成してください。

# Goal
今回は「{モジュール名 ex: DailyRecord, Incident}」という新しい機能をプロジェクトに追加します。
SharePoint リストと連携する前提で、ドメイン層・インフラ層・利用側のHooksやUIまでの一連のソースコード、テスト、および運用手順書を生成してください。

# Inputs
- SP_LIST_TITLE: {SharePointでのシステムリストの名称}
- 必要なビジネスドメインのカラム:
  - {列1の論理名} (型: {文字列/数値/日付/真偽値})
  - {列2の論理名} (型: {選択肢A/B/C})
  - ...

# Required outputs
一度の回答（または複数ステップでのプロンプト連鎖）で、以下のすべてのファイルを作成してください。
1. Domain Types (`src/domain/{module}.ts`) - 外部依存を持たない純粋なTypeScript定義
2. Repository Port (`src/domain/{module}Repository.ts`) - CRUDインターフェース
3. SharePoint Field Map (`src/infra/sharepoint/fields/{module}Fields.ts`) - Zod SchemaとSPカラム間の安全なマッパー
4. Local Repository (`src/infra/sharepoint/repos/local{Module}Repository.ts`) - Mock / localStorage用実装
5. SharePoint Repository (`src/infra/sharepoint/repos/sp{Module}Repository.ts`) - Graph API経由の通信実装
6. Abstract Factory (`src/features/{module}/repositories/create{Module}Repository.ts`) - `SP_ENABLED`を用いた環境分岐
7. Data Fetching Hook (`src/features/{module}/hooks/use{Module}.ts`) - Factoryを呼び出して状態管理を行うCustom Hook
8. Adapter (Optional) (`src/features/{module}/adapters/adapt{Module}.ts`) - UI向けにドメインモデルを変換

# Constraints (厳守事項)
- **Domain First**: `src/domain` 配下に `infra` をインポート・漏出させないこと。
- **Strict Env Mode**: `create{Module}Repository.ts` では必ず `import { SP_ENABLED } from '@/lib/env'` にのみ依存し、`IS_DEMO` や `IS_SKIP_LOGIN` を混ぜないこと。
- SharePointへのアクセスで、`null` や `undefined` を無視せず、必ず Zod によるパースエラーハンドリングを含むこと。

# Tests required
以下のレベルに応じたユニットテストを `src/features/{module}/__tests__/` に作成してください。
- Schema検証テスト (Field Mapの整合性)
- Local Mockを用いたCRUDのモックテスト

# Runbook required
運用段階に備え、手動テスト用の手順書を `docs/runbooks/{module}-verification.md` として Markdown で出力してください。
- 観点: Mockデータが呼ばれるか、`VITE_SP_ENABLED=true` のときに通信が走るか、エラー時の挙動。

# Definition of Done
生成後、`docs/checklists/module-starter-checklist.md` の項目をすべて満たしているか自己監査を行い、不足がある場合は修正してください。
```

---

## [利用方法]
1. `welfare-os-development-framework.md` をAIエージェントに読み込ませる（または Cursor等の `@ Docs` や `@ Files` で参照させる）。
2. このプロンプトの `{}` で囲まれた部分（モジュール名、リスト名称、カラム定義）を埋めて送信する。
3. エージェントが生成したファイル群を、`module-starter-checklist.md` に沿って順次テスト・マージする。


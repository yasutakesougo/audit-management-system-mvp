# TODO 負債 Issue 化 — 2026-03-18

Nightly Patrol 2026-03-17 で検出した TODO 7件を分類・Issue 化する。

---

## 分類マップ

| # | ラベル | TODO 内容 | ファイル | 優先度 |
|---|--------|-----------|---------|--------|
| A | `infra-debt` | Phase 3 で spFetch に移行（useFetcher） | `pages/opening-verification/useFetcher.ts:28` | P2 |
| B | `infra-debt` | Phase 3 で spFetch に移行（meeting-minutes） | `features/meeting-minutes/sp/sharepointRepository.ts:13` | P2 |
| C | `domain-backlog` | 採用 → 計画反映 | `features/monitoring/domain/ispPlanDraftUtils.ts:315` | P3 |
| D | `domain-backlog` | 保留 → 再評価 | `features/monitoring/domain/ispPlanDraftUtils.ts:323` | P3 |
| E | `domain-backlog` | 未判断 → 判断確定 | `features/monitoring/domain/ispPlanDraftUtils.ts:331` | P3 |
| F | `config-debt` | facilityName を設定から取得 | `features/handoff/analysis/components/HandoffAnalysisDashboard.tsx:169` | P2 |
| G | `ai-integration` | Azure OpenAI へ切替 | `features/handoff/analysis/components/HandoffAnalysisDashboard.tsx:91` | P1 |

---

## Issue 一覧

### Issue 1: `chore(infra): spFetch 移行 — useFetcher + meeting-minutes のネイティブ fetch を排除`

**ラベル:** `chore`, `infra-debt`, `P2`

---

#### 概要
`useFetcher.ts` と `meeting-minutes/sharepointRepository.ts` で使われているネイティブ `fetch()` 呼び出しを、プロジェクト標準の `spFetch` ラッパーに統一する。

#### 背景
現在2か所に `// eslint-disable-next-line no-restricted-globals -- TODO: Phase 3 で spFetch に移行` が残存している。  
`no-restricted-globals` ルールはネイティブ `fetch` の直接使用を禁止しているが、これらは ESLint 抑制で回避されている。  
`spFetch` に統一することで、認証ヘッダー・エラーハンドリング・ログが標準化される。

#### 要件
##### 必須（P0）
- [ ] `useFetcher.ts` の `fetch()` を `spFetch` または同等のラッパーに置換
- [ ] `meeting-minutes/sharepointRepository.ts` の `spJson()` 内部 `fetch()` を `spFetch` に置換
- [ ] `eslint-disable-next-line no-restricted-globals` コメントを両ファイルから除去

##### 任意（P1）
- [ ] `spJson<T>` ヘルパーを `spClient` 層の共通型で再実装し、重複を除去

#### 技術的な方針
- 変更対象:
  - `src/pages/opening-verification/useFetcher.ts`
  - `src/features/meeting-minutes/sp/sharepointRepository.ts`
- アプローチ: `spFetch` の型シグネチャを確認し、認証ヘッダー付与の責務をラッパー側に委譲
- 注意点: `meeting-minutes` は `credentials: 'include'` を使用しているため、`spFetch` への移行時に認証方式の差異を要確認

#### 受入条件
- [ ] `eslint-disable-next-line no-restricted-globals` が2ファイルから消えている
- [ ] lint / typecheck が通る
- [ ] meeting-minutes の CRUD 操作が既存動作を維持している

#### 関連
- Depends on: なし
- Related: `spClient` 実装 (`src/lib/spClient.ts`)

---

### Issue 2: `feat(monitoring): ISP 計画ドラフト — 採用・保留・未判断のアクション生成を完成させる`

**ラベル:** `feat`, `domain-backlog`, `P3`

---

#### 概要
`ispPlanDraftUtils.ts` の `buildNextActionsSection` に残存する3つの TODO（採用→計画反映、保留→再評価、未判断→判断確定）を実装し、次期アクション生成を完成させる。

#### 背景
現在のコードは各ステータスの判断を列挙するだけで「具体的な次のアクション文」は `decisionToNextActionLine` ヘルパーが生成している。  
コードコメントとして残っている TODO は実装上の穴ではなく **コメントの命名が「TODO」になっているだけ**だが、Nightly Patrol の検出対象になっている。  
これらの TODO コメントを実装意図を明示したドキュメントコメントに書き換え、Patrol の誤検知を防ぐ。

#### 要件
##### 必須（P0）
- [ ] `// 採用 → 計画反映 TODO` → `// 採用判断: 計画反映アクション行を生成` に書き換え
- [ ] `// 保留 → 再評価 TODO` → `// 保留判断: 次回モニタリング再評価アクション行を生成` に書き換え
- [ ] `// 未判断 → 判断確定 TODO` → `// 未判断目標: 判断確定アクション行を生成` に書き換え

##### 任意（P1）
- [ ] 各セクションに JSDoc を追加し、生成ルールを文書化

#### 技術的な方針
- 変更対象: `src/features/monitoring/domain/ispPlanDraftUtils.ts` (L315, L323, L331)
- アプローチ: コメントのリネームのみ（ロジック変更なし）
- 注意点: spec ファイルの `it('採用された判断に対する TODO が生成される')` は **テスト記述文字列**なので変更不要

#### 受入条件
- [ ] `grep -r "TODO" src/features/monitoring/` が 0件になること
- [ ] `ispPlanDraftUtils.spec.ts` の全テストが通ること
- [ ] lint / typecheck 通過

#### 関連
- Depends on: なし
- Related: `ispPlanDraftTypes.ts`, `ispRecommendationDecisionUtils.ts`

---

### Issue 3: `feat(config): facilityName を AppConfig から取得し ハードコードを除去`

**ラベル:** `feat`, `config-debt`, `P2`

---

#### 概要
`HandoffAnalysisDashboard.tsx` の AI 要約入力フィールド `facilityName` が `''`（空文字列ハードコード）になっている。  
環境変数または AppConfig から実際の事業所名を取得する。

#### 背景
AI 要約プロンプトが `facilityName: ''` のままでは、生成される要約文に事業所名が含まれない。  
実地指導・監査用途での利用を想定すると、事業所名の自動付与は必須である。

#### 要件
##### 必須（P0）
- [ ] `getAppConfig()` または環境変数から `facilityName` を取得する
- [ ] `VITE_FACILITY_NAME` 環境変数を `.env.example` に追加
- [ ] `HandoffAnalysisDashboard.tsx` の TODO コメントを削除

##### 任意（P1）
- [ ] `AppConfig` 型に `facilityName?: string` を追加し、型安全に参照
- [ ] 未設定時は `''` のままにし動作を壊さない

#### 技術的な方針
- 変更対象:
  - `src/features/handoff/analysis/components/HandoffAnalysisDashboard.tsx` (L169)
  - `src/lib/env.ts` または `getAppConfig` 定義ファイル
  - `.env.example`
- アプローチ: `getAppConfig().VITE_FACILITY_NAME ?? ''` でフォールバック付き参照
- 注意点: 既存の AppConfig に追加項目が増えるため、型定義と env バリデーションを合わせて更新

#### 受入条件
- [ ] `facilityName: ''` のハードコードが消えている
- [ ] `VITE_FACILITY_NAME` が `.env.example` に記載されている
- [ ] TODO コメントが消えている
- [ ] lint / typecheck 通過

#### 関連
- Depends on: なし
- Related: `src/lib/env.ts`, `src/lib/ai/buildHandoffSummaryPrompt.ts`

---

### Issue 4: `feat(ai): HandoffAnalysisDashboard の AI クライアントを Azure OpenAI に切替`

**ラベル:** `feat`, `ai-integration`, `P1`

---

#### 概要
`HandoffAnalysisDashboard.tsx` で `createMockAiClient()` が使われている。  
環境変数から Azure OpenAI エンドポイント・キーを取得し、本番 AI クライアントに切り替える。

#### 背景
申し送り AI 分析のインサイト生成は現在モックのみで動作している。  
Azure OpenAI に接続することで、現場職員が実際に使える AI 要約が提供できる。  
これは「AI DevOS」の中核機能の一つであり、P1 優先度で対応する。

#### 要件
##### 必須（P0）
- [ ] `VITE_AZURE_OPENAI_ENDPOINT` / `VITE_AZURE_OPENAI_KEY` / `VITE_AZURE_OPENAI_DEPLOYMENT` 環境変数定義を `.env.example` に追加
- [ ] `createAzureOpenAiClient()` を実装（または既存なら使用）
- [ ] 環境変数が揃っている場合のみ本番クライアントを使用し、未設定はモックにフォールバック
- [ ] TODO コメントを削除

##### 任意（P1）
- [ ] AI クライアント切替ロジックを `src/lib/ai/aiClient.ts` に `createAiClient()` ファクトリとして集約
- [ ] 本番/モック切替をテスト可能にするため、`aiClientRef` を外部から注入できるよう Props 化

#### 技術的な方針
- 変更対象:
  - `src/features/handoff/analysis/components/HandoffAnalysisDashboard.tsx` (L91-92)
  - `src/lib/ai/aiClient.ts`
  - `.env.example`
- アプローチ: 環境変数の有無でクライアントを分岐（Feature Flag パターン）
- 注意点: Azure OpenAI は CORS 制限があるため、ブラウザから直接呼び出す場合は API キーを VITE_ で公開することになる → セキュリティレビュー必要

#### 受入条件
- [ ] `createMockAiClient()` が環境変数未設定時のフォールバックとしてのみ使われている
- [ ] TODO コメントが消えている
- [ ] `.env.example` に Azure OpenAI 変数 3件が追加されている
- [ ] lint / typecheck 通過

#### 関連
- Depends on: Issue 3（facilityName取得）
- Related: `src/lib/ai/aiClientTypes.ts`, `src/lib/ai/handoffAiService.ts`

---

## Issue 分割計画（実装順）

| # | Issue | 依存 | 優先度 | 見積もり |
|---|-------|------|:------:|---------|
| 1 | chore(infra): spFetch 移行 — useFetcher + meeting-minutes | なし | P2 | 1h |
| 2 | feat(monitoring): ISP 計画ドラフト TODO コメント書き換え | なし | P3 | 15min |
| 3 | feat(config): facilityName を AppConfig から取得 | なし | P2 | 30min |
| 4 | feat(ai): HandoffAnalysisDashboard Azure OpenAI 切替 | #3 | P1 | 3h |

**Issue 2 は最小作業（コメント書き換えのみ）のため、次の Nightly でまとめて片付けても良い。**  
**Issue 4 はセキュリティレビューを含むため、単独 PR で慎重に進める。**

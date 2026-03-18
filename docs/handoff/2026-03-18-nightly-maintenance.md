# Handoff: Nightly Maintenance 仕様固定スプリント — 2026-03-18

> ブランチ: `refactor/isp-schema-split`
> セッション完了時刻: 2026-03-18T09:36 JST

---

## 1. 完了したこと

- [x] `isp/schema.ts` 分割（1030行 → 5ファイル × 約200行）
- [x] `any` 型 10件 全除去（境界ごとに正しい治し方を選択）
- [x] TODO 7件 分類・Issue化・即時実装 → `grep 'TODO' src` = **0件**
- [x] `facilityName` を `AppConfig` から取得（`VITE_FACILITY_NAME` 環境変数化）
- [x] `env.runtime.example.json` / `docs/env-reference.md` に `VITE_FACILITY_NAME` 追記
- [x] `/test-design` 3 feature（dailyOps / safety / meeting-minutes）設計書作成
- [x] `dailyOps` 契約テスト 23件（buildCompositeFilter / toIsoDateOnly / mapFromSp / Factory）
- [x] `safety` 制度要件境界値テスト 23件（meetsQuarterlyRequirement / meetsBiannualRequirement）
- [x] `meeting-minutes` 検索契約テスト 41件（matchesSearch 複合フィルタ / nextId）
- [x] `overallLevel` 判定ロジックを `domain/safety/safetyLevel.ts` に純関数切り出し
- [x] `safetyLevel` 契約テスト 25件（critical>warning 優先順位・境界値・actionRequiredCount）
- [x] `docs/test-design/safety.md` のリスクポイント記述修正（日数→会計年度回数）

**テスト追加合計: 112件**

---

## 2. 現在の状態

| 項目 | 状態 |
|------|:---:|
| ブランチ | `refactor/isp-schema-split` |
| lint | ✅ (各コミットで通過) |
| テスト (domain/safety) | ✅ 87件 |
| テスト (dailyOps) | ✅ 23件 |
| テスト (meeting-minutes) | ✅ 41件 |
| `grep 'TODO' src` | ✅ 0件 |
| PR 作成 | ❌ 未作成（次セッション） |

---

## 3. 残課題

| # | 課題 | 優先 | 見積 | 備考 |
|---|------|:---:|:---:|------|
| **Issue 1** | `spFetch` 移行（`useFetcher.ts` + `meeting-minutes/sharepointRepository.ts`） | P2 | 1h | 移行後に SP 側 buildFilter テストが書ける |
| **Issue 4** | Azure OpenAI 切替（`HandoffAnalysisDashboard.tsx`） | P1 | 3h | セキュリティレビュー要・`VITE_OPENAI_*` 追加 |
| — | `meeting-minutes/sharepointRepository` の `buildFilter` テスト | P2 | 30min | **Issue 1 完了後** に実施（spFetch 移行前は書かない） |
| — | `safety/overallLevel` を使った `useSafetyOperationsSummary` フックテスト | P3 | 30min | renderHook + localStorage mock |
| — | `refactor/isp-schema-split` ブランチの PR 作成 | P1 | 15min | 次セッション最初に |

Issue 詳細: `docs/tech-debt/todo-issues-2026-03-18.md`

---

## 4. 次の1手

**`refactor/isp-schema-split` の PR を作成し、`main` にマージする。**

```bash
# PR 作成コマンド例
gh pr create \
  --title "refactor: Nightly Maintenance — schema分割・any除去・TODO整理・テスト112件" \
  --body "docs/tech-debt/todo-issues-2026-03-18.md を参照" \
  --base main
```

---

## 5. コンテキスト（次のAIが知るべきこと）

### 設計判断

#### ISP schema 分割
- 分割先: `src/domain/isp/schema/`
  - `base.ts` — 共通スカラー型
  - `complianceMetadata.ts` — コンプライアンスメタデータ
  - `planningSheet.ts` — 個別支援計画シート
  - `procedureRecord.ts` — 手続き記録
  - `index.ts` — 再エクスポート
- `src/domain/isp/schema.ts` は後方互換のため残存（`index.ts` を re-export）

#### overallLevel 純関数
- `src/domain/safety/safetyLevel.ts` に新規作成
- `useSafetyOperationsSummary.ts` から委譲（ロジック変更なし）
- `SafetyLevelInput` 型は Pick を使った最小構造（各サマリ型のサブセット）

#### テスト設計上の発見
- `meetsQuarterlyRequirement` は「90日以内」**ではなく**「会計年度内4回以上」で判定
- `meetsBiannualRequirement` は「completed のみ」カウント（cancelled / planned 除外）
- `vi.useFakeTimers` で `2026-03-18` に固定 → 会計年度 = 2025/4/1〜2026/3/31

#### @internal export パターン
純関数テストのために以下でモジュール-private 関数を公開:
```ts
/** @internal テスト用に公開。プロダクションコードからは直接使わないこと。 */
export const buildCompositeFilter = ...
```
同パターンを `dailyOps/sharePointAdapter.ts` と `meeting-minutes/localStorageRepository.ts` に適用済み。

### 注意点

- `dist/env.runtime.example.json` と `public/env.runtime.example.json` は同じ内容を保つ（2ファイル同時更新が必要）
- `spFetch` 移行（Issue 1）が完了するまで `meeting-minutes/sp/sharepointRepository.ts` のテストを書かない（認証ヘッダーの差異が大きい）
- `VITE_FACILITY_NAME` は未設定の場合 空文字フォールバック（`HandoffAnalysisDashboard` でプロンプトに埋め込まれる）

### 参照ファイル

| ファイル | 用途 |
|---------|------|
| `docs/tech-debt/todo-issues-2026-03-18.md` | 残 Issue 詳細 |
| `docs/test-design/dailyOps.md` | dailyOps テスト設計 |
| `docs/test-design/safety.md` | safety テスト設計（境界修正済み） |
| `docs/test-design/meeting-minutes.md` | meeting-minutes テスト設計 |
| `src/domain/safety/safetyLevel.ts` | overallLevel 純関数 |
| `src/domain/isp/schema/index.ts` | ISP schema 再エクスポート |

---

## 6. 関連 Issue / PR

| 種別 | 内容 | 状態 |
|------|------|:----:|
| Issue (doc) | spFetch 移行 (useFetcher + meeting-minutes) | 📋 起票済み |
| Issue (doc) | Azure OpenAI 切替 (HandoffAnalysisDashboard) | 📋 起票済み |
| PR | refactor/isp-schema-split → main | ❌ **未作成** |

---

## 7. 今回固定した仕様一覧

次のセッションで改修が起きたとき、このテスト群が回帰を検知する。

| 仕様 | テストファイル | 件数 |
|------|-------------|:---:|
| 複合キー重複排除（time=null節） | `dailyOps/__tests__/sharePointAdapter.spec.ts` | 7 |
| SP DateTime → date-only 正規化 | 同上 | 4 |
| demo port 切替（shouldSkipSharePoint） | `dailyOps/__tests__/dailyOpsSignalsFactory.spec.ts` | 3 |
| 会計年度内 委員会4回要件 | `domain/safety/__tests__/safetyRequirements.spec.ts` | 7 |
| 会計年度内 研修2回要件（completed のみ） | 同上 | 6 |
| 参加率 0除算安全 / 境界 | 同上 | 10 |
| `critical > warning` 優先順位 | `domain/safety/__tests__/safetyLevel.spec.ts` | 5 |
| 件数境界（0→good / 1→critical） | 同上 | 4 |
| actionRequiredCount 加算ロジック | 同上 | 7 |
| matchesSearch: q / tag / category / from / to | `meeting-minutes/sp/__tests__/localStorageRepository.spec.ts` | 37 |
| nextId 空配列・非連続ID | 同上 | 4 |

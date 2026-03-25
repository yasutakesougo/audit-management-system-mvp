# ExceptionCenter Horizontal Rollout

transport で完成した
`parentId + enrichment + deep link + collapse + persistence`
の型を、他ドメインへ横展開するための runbook。

## 対象

- ExceptionCenter（`/admin/exception-center`）
- 横展開先:
  - corrective-action
  - handoff
  - daily-record

## 先に決める前提

- 表示の最小単位は「集約 parent + 個別 child」。
- child は必ず対応導線付き deep link を持つ。
- 折りたたみは parent 単位で制御する。
- 展開状態は localStorage 永続化するが、復元時に「存在しない parentId」は採用しない。
- storage 読み書き失敗時は初期展開ルールに安全フォールバックする。

## 優先順位表（横展開順）

| 優先 | ドメイン | 適合度 | 実装難易度 | 優先理由 | 先行着手ファイル |
| --- | --- | --- | --- | --- | --- |
| 1 | corrective-action | 高 | 中 | 既に `ExceptionItem` 化済みで、利用者/提案単位の分解がある。transport 型へ最短で寄せられる。 | `src/features/exceptions/hooks/useCorrectiveActionExceptions.ts` / `src/features/exceptions/domain/mapSuggestionToException.ts` |
| 2 | handoff | 高 | 中 | `重要×未完了` は既存検知済み。担当者・対象者単位の child 化と deep link の相性が良い。 | `src/features/exceptions/domain/exceptionLogic.ts`（`detectCriticalHandoffs`） / `src/features/exceptions/hooks/useExceptionDataSources.ts` |
| 3 | daily-record | 中 | 中〜高 | 未入力検知は既存だが、未入力理由や停滞理由の enrichment 設計が必要。効果は高いが仕様決めが先に要る。 | `src/features/exceptions/domain/exceptionLogic.ts`（`detectMissingRecords`） / `src/features/exceptions/hooks/useExceptionDataSources.ts` |

判定基準:

- 適合度: transport の実装パターンをそのまま適用できる度合い
- 実装難易度: 新規判定ロジック・データ収集・導線調整の総量

## 標準化ステータス（2026-03-25）

| ドメイン | parent + child(max5) | deep link | collapse/persistence | unit/hook/page | E2E 導線保証 |
| --- | --- | --- | --- | --- | --- |
| transport-alert | 適用済み | 適用済み | 適用済み | 適用済み | （既存運用） |
| corrective-action | 適用済み | 適用済み | 共通UIで適用済み | 適用済み | `tests/e2e/exception-center.corrective-child-flow.spec.ts` |
| handoff | 適用済み | 適用済み | 共通UIで適用済み | 適用済み | `tests/e2e/exception-center.handoff-child-flow.spec.ts` |
| daily-record | 適用済み | 適用済み | 共通UIで適用済み | 適用済み | `tests/e2e/exception-center.daily-child-flow.spec.ts` |

## ドメイン別スコープ（初回リリース）

### 1) corrective-action

- Parent: 利用者単位（例: `corrective-user-{userId}-{date}`）
- Child: 提案単位（既存 suggestion 1件 = child 1件）
- enrichment: suggestion evidence / reason / priority
- deep link: 既存 CTA (`actionPath`) を child に維持
- 初期展開: child に `critical/high` が含まれる parent を展開

### 2) handoff

- Parent: 利用者単位または担当者単位（運用で選択）
- Child: handoff 1件ごと
- enrichment: severity / status / createdAt / category
- deep link: `/handoff-timeline?range=day&date=YYYY-MM-DD&handoffId={id}`
- 初期展開: `重要` + `未対応/対応中` を含む parent を展開

### 3) daily-record

- Parent: 「未入力種別 × 対象者群」（例: activity 未入力、support 未入力）
- Child: 対象者 1人ごとの未入力項目
- enrichment: 最終更新時刻、前回記録日、担当者
- deep link: `/daily/activity?userId={id}&date={date}` など画面別に固定
- 初期展開: 当日分かつ high 以上を含む parent を展開

## 適用テンプレート（ドメインごとにコピー）

### A. 仕様定義

- ドメイン名:
- Parent 集約キー:
- Child 生成キー:
- targetDate 基準:
- 対応導線（deep link）:
- 初期展開ルール:

### B. 実装タスク

1. `domain/build{Domain}Exceptions.ts` を作成し、`ExceptionItem[]` を返す。
2. Parent 生成時に `id` を安定化し、Child に `parentId` を付与する。
3. child 行へ enrichment（対象者名、理由、追加メタ）を付加する。
4. child 行の `actionPath` を必ず個別 deep link にする。
5. hook でデータ取得 → KPI/判定 → Exception 変換の順で統合する。
6. `ExceptionCenterPage` の `aggregateExceptions()` 入力へ追加する。
7. SummaryCard（カテゴリ件数）を必要に応じて更新する。

### C. 永続化ルール

- storage key: `exception-collapsed-parents:{domain}` を推奨
- 保存形式: `string[]`（collapsed parent IDs）
- 復元ガード:
  - JSON parse 失敗時は無視
  - 文字列配列以外は無視
  - 現在の `parentIds` に存在しない ID は除外
- フォールバック:
  - 有効保存値が 0 件なら初期展開ルールを適用

### D. テストテンプレート

1. builder unit:
   - parent/child が正しく生成される
   - child に `parentId` が入る
   - deep link が対象者単位になる
2. grouping unit:
   - `groupExceptionsByParent` で親直下に child が並ぶ
   - orphan child が standalone で落ちない
3. UI unit:
   - parent 個別開閉
   - 一括展開/一括折りたたみ
   - localStorage 復元（有効 ID のみ）
   - storage 異常時フォールバック

### E. 受け入れ条件（DoD）

- 親子表示で「集約→個別対応」が 2クリック以内で完了する。
- deep link で対象者・対象日へ直接遷移できる。
- リロード後も展開状態が復元される。
- 存在しない parentId 復元で UI が壊れない。
- storage 障害時に初期展開ルールで継続利用できる。

### F. E2E 完了条件（標準運用ゲート）

- `flat`: parent 配下に child が表示される。
- `grouped`: parent 行の二重集約が発生しない（child のみで利用者集約される）。
- child CTA でドメイン画面へ遷移し、URL パラメータ（例: `userId` / `date` / `handoffId`）が正しい。
- deep link 遷移先で対象コンテキスト（対象者/対象レコード/対象カード）が確認できる。

実行コマンド（3ドメイン一括）:

```bash
npx playwright test \
  tests/e2e/exception-center.corrective-child-flow.spec.ts \
  tests/e2e/exception-center.daily-child-flow.spec.ts \
  tests/e2e/exception-center.handoff-child-flow.spec.ts \
  --project=chromium
```

## 実行順（推奨）

1. corrective-action を first ship
2. handoff を second ship
3. daily-record を third ship

各 ship で必ず以下を実施:

- builder unit + UI unit を先に追加
- feature flag 不要ならそのまま出荷、必要ならカテゴリ単位で gate
- 週次レビューで「誤検知率 / CTA到達率 / 再表示率」を確認

## 薄い共通化候補（やりすぎない）

- `groupExceptionsByParent` / `getInitialExpandedParents` を共通 utility として維持。
- `usePersistedCollapsedParents(key)` のような薄い hook 抽出を許容（key はドメイン分離）。
- builder は `build{Domain}Exceptions.ts` を維持し、deep link 生成のみ helper 化する。

原則:

- 抽象化よりも「runbook をそのまま適用できる差し替えやすさ」を優先する。

## 関連ファイル

- `src/features/exceptions/components/ExceptionTable.tsx`
- `src/features/exceptions/domain/groupExceptionsByParent.ts`
- `src/features/exceptions/domain/buildTransportExceptions.ts`
- `src/features/exceptions/hooks/useTransportExceptions.ts`
- `src/pages/admin/ExceptionCenterPage.tsx`

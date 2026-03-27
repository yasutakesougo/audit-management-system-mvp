# Daily Module - Pure Domain Extraction Candidates (PR 2 Blueprint)

> **Goal:** `daily` モジュールの UI/Hook/Store から、外部副作用を持たない「純粋関数 (Pure Function)」を抽出し、高いカバレッジのユニットテストで保護する。
> **Strategy:** 抽出作業を一度に行わず、`2-A` (Validation/Mappers), `2-B` (Builders/Payloads), `2-C` (Bridges) の 3ステップ で安全に分解・移行する。

---

## 判定基準 (The "Pure" Rule)
抽出対象となるロジックの条件：
**「引数を受けて値を返すだけで、Zustand (Store)・spFetch (Network)・Router・React State (Mutation) に一切触らないこと」**

---

## PR 2-A: Validation & Mappers 抽出
（最も副作用が少なく、UIから剥がしやすいドメインロジック群）

### 1. `validateTimeOverlap` (時間重複チェック)
- **概要:** 支援記録の開始〜終了時間が、他の記録と重複していないか検証する。
- **入力:** `newRecord: { startTime, endTime }`, `existingRecords: Array<{ startTime, endTime }>`
- **出力:** `boolean` (重複ありなら `true`)、または重複している記録のリスト
- **既存の場所:** `hooks/legacy/useTableDailyRecordForm` や `components/forms/DailyRecordForm` の内部
- **テスト観点:**
  - 境界値（ちょうど終了時間に開始した場合どうなるか）
  - 同時刻の開始、完全包含パターンの網羅

### 2. `calculateSupportDuration` (支援時間計算)
- **概要:** 開始時間と終了時間の差分から、正味の支援分数を算出する（国保連請求の基礎データ）。
- **入力:** `startTime: string (HH:mm)`, `endTime: string (HH:mm)`
- **出力:** `number` (分)
- **既存の場所:** UIコンポーネントの onChange ハイジャック内や、Zustandの setter 内
- **テスト観点:**
  - 終了時間が翌日（24:00超過）になるケースの考慮
  - 不正な文字列が入った時のフォールバック処理

### 3. `mapToTableViewModel` (表示用データ整形)
- **概要:** SPから取得した生の `SupportRecord` リストを、Table画面で使いやすい平坦な `RowData` に変換する。
- **入力:** `SupportRecord_Daily[]`, `Users[]`
- **出力:** `TableDailyRecordRow[]`
- **既存の場所:** `hooks/orchestrators/useTableDailyRecordSelection` など
- **テスト観点:**
  - 欠損データ（Userマスタから消えた等）への堅牢性
  - ソート・グループ化のためのキー生成が正しく行われるか

---

## PR 2-B: Builders (Payload 生成の分離)
（保存前に状態を Sharepoint 用の DTO (Data Transfer Object) に変換する重いロジック群）

### 1. `buildSharePointPayload` (SP保存用DTO生成)
- **概要:** Form の State や Zustand の Draft から、SP_LIST_REGISTRY が要求する完全な Payload を生成する。
- **入力:** `draft: DailyFormState`, `currentUser: User`, `targetDate: string`
- **出力:** `Partial<SupportRecord_Daily>` (SP送信用の JSON)
- **既存の場所:** `hooks/mutations/useTableDailyRecordPersistence` などの `mutate` 関数内部
- **テスト観点:**
  - `ISODate` や Time string のフォーマット厳密性
  - null / undefined のクレンジング（SPがエラーを吐かないか）
  - ユーザーのメタデータ（記録者名など）が正しく付与されているか

### 2. `createRecordSnapshot` (差分比較用スナップショット)
- **概要:** 編集前の記録状態と、現在のフォーム状態を比較し、「本当に変更されたか（Dirtyか）」を判定するためのハッシュ生成・プロパティ抽出。
- **入力:** `originalRecord: SupportRecord`, `currentForm: FormState`
- **出力:** `boolean` (isDirty) または `Record<string, {old, new}>` (変更差分)
- **既存の場所:** Orchestrator内における無駄な保存を弾くガード節
- **テスト観点:**
  - オブジェクトのディープな変更（タグの増減など）を正しく検知できるか

---

## PR 2-C: Bridges (計画展開・テンプレート変換)
（システムの「動脈」となる、事前計画から当日のタスクへの変換ロジック群）

### 1. `planningToProcedureConverter` (ISP → 当日手順展開)
- **概要:** 氷山モデル（IBD）や個別支援計画（ISP）で立案された「支援方針・着眼点」を、当日現場のスタッフが見る手順（Procedure）フォーマットに変換する。
- **入力:** `SupportPlan`, `BehaviorPatterns`, `Date`
- **出力:** `DailyProcedureStep[]`
- **既存の場所:** `stores/procedureStore` の初期化プロセスや `hooks/legacy` 内に暗黙的に混入
- **テスト観点:**
  - 計画に「月水金のみ実行」といったスケジュールがある場合、正しくスキップ/採用されるか
  - 過去の記録からのフィードバック（前日未達だったもの等）が反映されるか

### 2. `generateHandoffSummary` (申し送り文字列のビルド)
- **概要:** 当日の全支援記録、特記事項、バイタルデータをサマリーして申し送り（Handoff）用の文字列テキストや構造データを吐き出す。
- **入力:** `SupportRecord_Daily[]`, `NurseRecords[]`
- **出力:** `string` または `HandoffSummaryObject`
- **既存の場所:** `handoff` モジュールまたは `daily` モジュールの境界
- **テスト観点:**
  - 異常値（バイタル異常など）がある場合、必ず先頭（アラート）として抽出されるか

---

## 実行ルールと手順 (How to Execute)

1. **抽出先ディレクトリ:** 上記関数はすべて `src/features/daily/domain/` 配下（`validation/`, `mappers/`, `builders/`, `bridges/`）に `.ts` ファイルとして配置する。
2. **純化 (Purify):** 型情報を `domain/types` などから引き込み、Reactの Hook API（`useMemo`, `useState`）や外部参照（`spFetch`, Zustand の `get()`）を引数に置き換える。
3. **テスト駆動 (TDD-ish):** 元のコードが持っていた分岐条件を仕様化し、同じディレクトリ内に `%name%.spec.ts` を配置して Vitest で保証する。
4. **呼び出し元のリファクタ:** UI や Orchestrator Hook は、抽出した関数を `import` して **「値を渡して受け取る」** だけの薄い処理に変更する。 

This PR is a non-behavioral structure-only refactor for schedules module hardening.
No logic changes are intended; file moves, responsibility clarification, and pure-function extraction only.

## 変更内容
`schedules` モジュール全体の責務を可視化するため、以下のようにディレクトリ構造を定義・整理し、純粋関数を抽出しやすい土壌を形成しました。

### 1. `domain` 層の再編 (Pure functions)
既存の `domain/` ディレクトリ内で無秩序に配置されていた純粋なドメイン知識（関数群）を分類しました。
- `domain/validation/`: 時間重複チェック (`scheduleNextGap.ts`) や、時間帯制約などの判定 (`scheduleAutofillRules.ts`)
- `domain/builders/`: インライン作成やクイックテンプレートからのエンティティ組み立て (`scheduleQuickTemplates.ts`, `inlineScheduleDraft.ts`)
- `domain/mappers/`: 表示用データ整形やメタデータの抽出 (`categoryLabels.ts`, `userStatus.ts`)

### 2. コンポーネントおよびフックへのディレクトリ枠組みの用意
今後の PR に備え、以下の構造的なディレクトリ枠組みを `schedules` 内に用意しました。これに従って肥大化したコンポーネントや Hook を整理していく計画です。
- `components/pages/`, `components/dialogs/`, `components/sections/`, `components/timeline/`
- `hooks/orchestrators/`, `hooks/view-models/`, `hooks/mutations/`, `hooks/legacy/`

### 3. Import の完全修正
ファイル移動に伴う import パスをすべて修正しました。（`tsc` による型チェック通過済み）

## メモ: 旧 `/schedule` 系の残骸候補について
- `src/pages/ScheduleUnavailablePage.tsx`
- `src/features/schedules/hooks/useSchedules.ts` (CRUD等と重複の疑いのある旧実装)
これらは今後移行、もしくは削除される想定です。

## テスト状況
- [x] Lint checks pass
- [x] Type checks pass (`tsc --noEmit`)
- [x] Unit tests pass

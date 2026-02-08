# Schedules Architecture (現行/レガシー)

## 現行 (source of truth)
- `src/features/schedules`
- すべての新規UI/UXとルーティングはこの系統のみを使用する。

## レガシー (凍結)
- `src/features/schedule`
- 新規参照・新規変更は行わない。
- 既存参照は段階的に `features/schedules` へ移行する。

## 例外ルール
- legacy 外の例外は `src/types/module-stubs.d.ts`（type-only）に限定する。
- 例外的に移植が必要な場合は、必ず理由をPRに明記し、
  追加の参照を増やさない方針で実施する。

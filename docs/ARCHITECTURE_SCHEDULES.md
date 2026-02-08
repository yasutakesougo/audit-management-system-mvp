# Schedules Architecture (現行/レガシー)

## 現行 (source of truth)
- `src/features/schedules`
- すべての新規UI/UXとルーティングはこの系統のみを使用する。

## レガシー (削除済み)
- `src/features/schedule` は削除済み。
- 参照は禁止（CI で強制）。

# Schedules Architecture (現行/レガシー)

## Docs guard
- docs 内で「legacy schedule（単数系）のパス文字列」が出たら古い記述。
- 最新の方針は本ページを参照。

## 現行 (source of truth)
- `src/features/schedules`
- すべての新規UI/UXとルーティングはこの系統のみを使用する。

## レガシー (削除済み)
- legacy schedule（単数系パス）は削除済み。
- 参照は禁止（CI で強制）。

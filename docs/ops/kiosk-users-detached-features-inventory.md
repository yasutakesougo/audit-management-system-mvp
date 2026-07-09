# `/kiosk/users` 別事業所試行 前提: 不要機能表示の read-only 棚卸し

## 目的

実装せず、現状の導線定義だけで「初期試行で `/kiosk/users` 以外をどう扱うか」を整理する。

## Kiosk下部導線の現状

`src/app/components/KioskNavigation.tsx` より、現状は次を表示想定。

- ホーム（`/kiosk`）
- 予定（`/schedules/day`）
- 通所（`/daily/attendance`）
- 記録（`/daily/table`）
- 支援手順（`/kiosk/users`）
- トイレ確認（`/kiosk/toilet`）
- コーヒー精算（`/billing`）
- 受電ログ（ダイアログ）
- 申し送り（ダイアログ）

## Kioskルート構成の補足

`src/app/routes/kioskRoutes.tsx` でルートとして直接用意されるのは以下。

- `/kiosk`
- `/kiosk/toilet`
- `/kiosk/users`
- `/kiosk/users/:userId/procedures`
- `/kiosk/users/:userId/procedures/:slotKey`

したがって、導線上の各リンクはルート外の画面も含み、表示可否は別途制御対象。

## 初期試行（read-only）での推奨整理

- 代替的に `support-only` 表示に寄せるなら、まず `/kiosk/users` へ導線を集約し、他機能導線は運用ルールで未使用宣言する（実装は次フェーズ）。
- 保存なしのログイン確認では、表示・遷移が壊れていないことだけを目視確認。
- 試行環境の正式運用前提（env・nav制御・機能フラグ整備）を法人側承認で固定する。


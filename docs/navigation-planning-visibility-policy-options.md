# Planning表示ポリシー比較（3案）

> 作成日: 2026-04-09  
> 対象: サイドメニュー `planning` グループの表示ポリシー

## 背景

2026-04-09 時点で以下は対応済み:

- `survey/tokusei` の nav/route 権限不一致を解消（`admin` に統一）
- `Planning` ハブと配下ページの二重 active を解消

未決事項は、`planning` グループを「常時表示固定」に寄せるかどうか。

## 比較対象

| 案 | 方針 | メリット | リスク | 実装影響 |
|---|---|---|---|---|
| A. 常時固定 | `today` / `platform` と同様に `planning` を非表示不可にする（staff以上） | 導線喪失を防ぎやすい。教育コストが低い | 現場によってはメニュー肥大感が増える | `NavGroupVisibilityControl` の固定対象追加、設定UI文言見直し |
| B. 初期ON（推奨） | `planning` を staff以上で初期表示ONにするが、個人設定でOFFは許容 | 導線を維持しつつ現場裁量を残せる | 非表示にされるケースは残る | 設定初期化/マイグレーション追加、利用実態の計測追加 |
| C. 現状維持 + 代替導線 | `planning` は任意表示のまま。主要画面に代替CTAを追加 | 既存UXへの影響が最小 | サイドメニューとしての一貫性は弱い | Today/Hub/Users詳細などに補助導線を追加 |

## 評価軸

1. 業務クリティカル導線の消失率（`planning` 到達率の低下有無）
2. 画面ノイズ増加の許容度（現場ヒアリング）
3. ロール別運用負荷（staff/reception/admin）
4. kiosk 運用との整合（`today` 集中方針を崩さないこと）

## 推奨

`B. 初期ON（推奨）` を先行採用し、2〜4週間の運用データで固定化可否を判定する。

- 理由: 安全性（導線確保）と柔軟性（現場裁量）のバランスが最も良い
- kiosk は現行維持（`today` のみ表示）を前提とする

## B案マイグレーション契約（確定）

- 対象は `hiddenNavGroups` に `planning` の明示設定が存在しないユーザーのみ
- 既に `planning` を明示的に非表示にしているユーザー設定は尊重する
- `kiosk` は例外で、従来どおり `today` 以外を非表示のままとする
- 初期ON付与は一度きりの後方互換マイグレーションとして扱う
- マイグレーション後の表示変更は通常の個人設定操作に委ねる

## 受け入れ条件

- `planning` 未設定ユーザーでは初回のみ表示ONになる
- `planning` を既にOFFにしているユーザーはOFFのまま
- `kiosk` では `planning` は表示されない
- 設定画面でのON/OFF操作は従来どおり有効
- telemetry は初回露出・到達・設定変更・7日後維持を継続して欠損なく送る

## 実装メモ（B案）

1. `settingsModel` にナビポリシー版を持たせる（例: `navPolicyVersion`）
2. 読み込み時マイグレーションで、staff以上の `hiddenNavGroups` から `planning` を初期解除  
   明示的にユーザーがOFFした場合は保持
3. `planning` グループ表示切替をテレメトリ送信（ON/OFF、role、mode）
4. 2〜4週間後に以下を見て A/B/C を再判定

- `planning` 到達率
- `planning` 非表示率
- 導線迷子系の問い合わせ件数

## 影響ファイル（想定）

- `src/features/settings/settingsModel.ts`
- `src/features/settings/useSettings.ts`（または設定ロード処理）
- `src/features/settings/components/NavGroupVisibilityControl.tsx`
- `src/app/useAppShellState.ts`（必要に応じてテレメトリ連携）

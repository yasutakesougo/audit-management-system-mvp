# Corrective-Action Telemetry Review

corrective-action lifecycle telemetry を週次運用で読み解き、
ルール調整・UI改善・永続化優先度を決めるための runbook。

## 対象

- Telemetry Dashboard（`/admin/telemetry`）
- Corrective-Action Lifecycle セクション

## 関連PR

- #1154 dismiss/snooze 運用ループ
- #1156 suggestion lifecycle telemetry 送信
- #1160 telemetry 集計 + 取得 + dashboard 表示

## 目的

- ノイズルールを特定する
- 有効ルールを維持・強化する
- UI改善対象（Today / ExceptionCenter）を絞る
- 永続化や ExceptionCenter 改善の優先順位を決める

## 先に見る順番

1. 総数カード（shown / clicked / dismissed / snoozed / resurfaced）
2. rule 別テーブル
3. sourceScreen 別テーブル
4. priority 別テーブル

## 指標の解釈ルール

| 指標 | 高いときの意味 | 低いときの意味 | 注意点 |
| --- | --- | --- | --- |
| CTA率 | 提案が行動につながっている | 導線不足 / 信頼不足 / ノイズ | shown が少ないとぶれやすい |
| dismiss率 | ノイズ候補、閾値過敏の可能性 | ノイズは少ない可能性 | 高CTA率と同時に高い場合は文言不一致を疑う |
| snooze率 | 必要性はあるがタイミングが合っていない | 今すぐ判断されやすい | 業務ピーク時間の影響を受ける |
| resurfaced率 | snooze 後も未解決で再浮上している | snooze で自然解消している | 分母は snoozed。snoozed が少ないと解釈注意 |
| 無反応率 | 見えているが判断されていない | 判断導線が機能している | shown 母数が小さい週は過大評価しない |

## アクション基準（初期値）

| 条件（直近7日） | 目安 | 対応 |
| --- | --- | --- |
| dismiss率が高い | 60%以上 | rule 閾値見直し、文言見直し、priority 再評価 |
| CTA率が高い | 40%以上 | 有効ルール候補として維持、導線強化、自動化候補化 |
| snooze率が高い | 30%以上 | 表示タイミング見直し、ExceptionCenter 表示改善優先 |
| resurfaced率が高い | 20%以上 | snooze preset 見直し、未解決課題として週次レビューで追跡 |
| 無反応率が高い | 50%以上 | UI配置・文言・優先度の見直し |

注記: 目安値は初期値。2〜4週間の運用実績で更新する。

## 週次レビュー手順

- 誰が: 管理者または支援計画レビュー担当
- いつ: 週1回（週初または週末）
- 何を見る: 直近7日の rule / sourceScreen / priority
- 何を決める:
  - 維持するルール
  - 閾値調整候補
  - UI改善候補
  - 永続化・ExceptionCenter改善の優先順位
- どこに残す: issue / weekly note / planning backlog

## 注意事項

- デフォルト期間は直近7日
- `suggestion_shown` は `stableId + sourceScreen` で dedupe 済み
- `suggestion_resurfaced` は `snoozedUntil` 経過後の再表示のみ
- 分母0の率は 0 扱い（NaN/Infinity は出ない）
- 件数が少ない週は率の変動が大きいので、絶対件数も併せて判断する

## 更新ルール

- threshold を変えたら、この runbook の「アクション基準（初期値）」も更新する
- 新しい lifecycle 指標を追加したら「指標の解釈ルール」に追記する

# TodayOps 技術仕様

## NextAction 永続化キー仕様

### キー形式

```
today.nextAction.v1:{date}:{stableEventId}
```

- `date`: `YYYY-MM-DD` (日ごとに自然にリセット)
- `stableEventId`: `{ScheduleItem.id}|{time}|{title}`

### 保存値

```json
{
  "startedAt": "2026-02-27T10:00:00Z",
  "doneAt": "2026-02-27T10:30:00Z"
}
```

### Done 後の次予定算出

`useNextAction` は次予定を選ぶ際に **`doneAt` が設定されたアイテムを除外** する。
Done を押した瞬間に次の未完了予定へ自動遷移し、全予定完了なら「本日の予定はすべて完了しました」を表示。

### 日付境界

キーに `{date}` を含むため、翌日は自然に別エントリとなる。
古い日付のエントリは参照されないが、明示的な GC は未実装（P2 候補）。

## 変更履歴

| PR | 日付 | 内容 |
|---|---|---|
| #641 | 2026-02-27 | P0: 4カード構成 + useDashboardSummary 接続 |
| #642 | 2026-02-27 | P1-A: Start/Done + localStorage 永続化 + Done スキップ |

# モニタリング会議 期限通知フロー（Power Automate）

## 目的

モニタリング会議の未実施・期限超過を未然に防ぐため、
**会議実施日 (`cr014_meetingDate`) を基準に 75/83/90 日の段階で Teams 通知を送る**
スケジュール済みクラウドフローを構築する。

思想: 「人が気づく」のではなく「システムが先に知らせる」。

---

## 環境設定（確定値）

| 項目 | 値 |
|------|----|
| SharePoint サイト | `https://isogokatudouhome.sharepoint.com/sites/welfare` |
| Users リスト | `Users_Master` |
| Monitoring リスト | `MonitoringMeetings` |
| Teams Team ID | `b3e2ae5a-1ed6-4cd7-aa1c-bc00455360f0` |
| Teams チャネル | 監査アラート |
| アプリ公開 URL | `https://audit-management-system-mvp.momosantanuki.workers.dev` |
| ディープリンク形式 | `{公開URL}/monitoring-meeting/{cr013_userId}` |
| 実行時刻 | 毎日 09:00 (JST) |

> **注意 — 利用者名フィールド**: 確定版テンプレート初稿で `cr013_userName` と記載がありましたが、
> `Users_Master` の実際の内部名は **`cr013_fullName`** です
> ([`usersMasterFields.drift.spec.ts`](../../src/sharepoint/fields/__tests__/usersMasterFields.drift.spec.ts))。
> 本ガイドは `cr013_fullName` で統一しています。

---

## 関連ドキュメント / SSOT

| 種別 | 参照 |
|------|------|
| フィールド定義 (SSOT) | [`src/sharepoint/fields/monitoringMeetingFields.ts`](../../src/sharepoint/fields/monitoringMeetingFields.ts) |
| リスト登録 | [`src/sharepoint/spListRegistry.ts`](../../src/sharepoint/spListRegistry.ts) (`MonitoringMeetings` / `Users_Master`) |
| ドメイン型 | [`src/domain/isp/monitoringMeeting.ts`](../../src/domain/isp/monitoringMeeting.ts) |
| 既存フロー実装ガイド (スタイル参照) | [`flow-implementation-guide.md`](./flow-implementation-guide.md) |

---

## 前提 — SharePoint リスト / 内部名

### MonitoringMeetings

| 論理名 | SP 内部名 | 型 | 備考 |
|--------|-----------|-----|------|
| `userId` | `cr014_userId` | Text | 利用者紐付けキー |
| `userName` | `cr014_userName` | Text | 表示用 |
| `meetingDate` | `cr014_meetingDate` | **Text** | 会議実施日 (文字列保存) |
| `status` | `cr014_status` | Text | `draft` / `finalized` |
| `finalizedAt` | `cr014_finalizedAt` | **Text** | 確定日時 (ISO 文字列) |

> ⚠️ **`meetingDate` / `finalizedAt` は Text 列**。
> Power Automate で日付演算するには、`formatDateTime()` で一度整形してから
> `dateDifference` / `ticks()` に渡すこと。

### Users_Master

| 論理名 | SP 内部名 | 備考 |
|--------|-----------|------|
| `userId` | `cr013_userId` | 主キー |
| `fullName` | `cr013_fullName` | 通知本文に使用 |
| `isActive` | `cr013_isActive` | `true` のみ対象 |

---

## フロー全体像

```
[Recurrence 毎朝 9:00 JST]
    ↓
[Initialize variables]
    ↓
[Get items: Users_Master] (isActive eq true)
    ↓
[Apply to each user]
    ├─ [Get items: MonitoringMeetings] (最新1件, finalized)
    ├─ [Condition: 記録あり?]
    │     └─ No → スキップ (未実施は別ロジック)
    ├─ [Compose: baseDate] (meetingDate ?? finalizedAt)
    ├─ [Compose: daysElapsed]
    ├─ [Switch: daysElapsed]
    │     ├─ 90日以上 → 🚨 期限超過 通知
    │     ├─ 83日以上 → ⚠️ 1週間前 通知
    │     └─ 75日以上 → 🔔 2週間前 通知
    └─ (それ未満は通知しない)
    ↓
[Post summary to Teams] (任意・夜バッチ想定)
```

---

## 1. トリガー

**アクション**: `Recurrence` (Schedule)

| 項目 | 値 |
|------|----|
| 繰り返し間隔 | 1 日 |
| 時刻 | `09:00` |
| タイムゾーン | `(UTC+09:00) 大阪、札幌、東京` |

---

## 2. 変数初期化

| アクション | 名前 | 種類 | 初期値 |
|-----------|------|------|--------|
| Initialize variable | `varToday` | String | `@{formatDateTime(convertTimeZone(utcNow(),'UTC','Tokyo Standard Time'),'yyyy-MM-dd')}` |
| Initialize variable | `notifiedCount` | Integer | `0` |
| Initialize variable | `skippedNoRecord` | Integer | `0` |

> `varToday` を変数化することで Apply to each 内で `utcNow()` を再計算せず、
> 1 回の実行内で日付境界がぶれないようにする。

---

## 3. 利用者一覧の取得

**アクション**: `Get items` (SharePoint) — `Get_Users`

| 項目 | 値 |
|------|----|
| サイトアドレス | `https://isogokatudouhome.sharepoint.com/sites/welfare` |
| リスト名 | `Users_Master` |
| フィルタークエリ | `cr013_isActive eq 1` |
| Select クエリ | `Id,cr013_userId,cr013_fullName` |
| 上位件数 | `5000` |

---

## 4. Apply to each — 利用者ループ

**From**: `body('Get_Users')?['value']`

### 4-1. 最新モニタリング記録取得

**アクション**: `Get items` (SharePoint) — `Get_LatestMeeting`

| 項目 | 値 |
|------|----|
| サイトアドレス | `https://isogokatudouhome.sharepoint.com/sites/welfare` |
| リスト名 | `MonitoringMeetings` |
| フィルタークエリ | `cr014_userId eq '@{items('Apply_to_each')?['cr013_userId']}' and cr014_status eq 'finalized'` |
| 並べ替え順序 | `cr014_meetingDate desc` |
| 上位件数 | `1` |
| Select クエリ | `Id,cr014_userId,cr014_userName,cr014_meetingDate,cr014_status,cr014_finalizedAt` |

> **ガード**: `cr014_status eq 'finalized'` で draft を除外。
> draft 滞留は別フロー (将来拡張) で扱う。

### 4-2. 記録有無の判定

**アクション**: `Condition` — `Has_Record`

**条件**:
```
@greater(length(body('Get_LatestMeeting')?['value']), 0)
```

- **No** → `Increment variable (skippedNoRecord)` のみ。次の利用者へ。
- **Yes** → 続行。

### 4-3. 基準日の決定

**アクション**: `Compose` — `Compose_BaseDate`

```
@{
  if(
    empty(first(body('Get_LatestMeeting')?['value'])?['cr014_meetingDate']),
    formatDateTime(first(body('Get_LatestMeeting')?['value'])?['cr014_finalizedAt'], 'yyyy-MM-dd'),
    formatDateTime(first(body('Get_LatestMeeting')?['value'])?['cr014_meetingDate'], 'yyyy-MM-dd')
  )
}
```

> `meetingDate` が空なら `finalizedAt` にフォールバック。
> 両方 Text 列なので `formatDateTime()` で `yyyy-MM-dd` に正規化しておく。

### 4-4. 経過日数の算出

**アクション**: `Compose` — `Compose_DaysElapsed`

```
@{
  div(
    sub(
      ticks(variables('varToday')),
      ticks(outputs('Compose_BaseDate'))
    ),
    864000000000
  )
}
```

> `ticks()` は 100ns 単位。1日 = `864000000000`。

### 4-5. 通知条件分岐

**アクション**: `Switch` — `Switch_Threshold`

**On**: `true` （各 case で式を評価する擬似 if-else）

| Case 式 | 状態 | アクション |
|---------|------|-----------|
| `@greaterOrEquals(outputs('Compose_DaysElapsed'), 90)` | 🚨 期限超過 | 通知 (重大) |
| `@greaterOrEquals(outputs('Compose_DaysElapsed'), 83)` | ⚠️ 残 1 週間 | 通知 (注意) |
| `@greaterOrEquals(outputs('Compose_DaysElapsed'), 75)` | 🔔 残 2 週間 | 通知 (予防) |
| Default | 通知しない | — |

> Power Automate の `Switch` は値一致しか扱えないため、
> 実装上は **ネストした `Condition` (3 段) で上から判定** するのが安全。
> 90 → 83 → 75 の順で評価し、最初にマッチした段階で通知して
> `Terminate` (scope 内) or 次のユーザーへ進める。

#### 実装パターン: ネスト Condition

```
Condition_90: @greaterOrEquals(outputs('Compose_DaysElapsed'), 90)
  Yes:
    Post_Teams_Critical
    Increment notifiedCount
  No:
    Condition_83: @greaterOrEquals(outputs('Compose_DaysElapsed'), 83)
      Yes:
        Post_Teams_Warning
        Increment notifiedCount
      No:
        Condition_75: @greaterOrEquals(outputs('Compose_DaysElapsed'), 75)
          Yes:
            Post_Teams_Notice
            Increment notifiedCount
```

---

## 5. Teams 通知メッセージ

**アクション**: `Post message in a chat or channel (V3)` (Teams)

- **Post as**: `Flow bot`
- **Post in**: `Channel`
- **Team**: `b3e2ae5a-1ed6-4cd7-aa1c-bc00455360f0` (確定値)
- **Channel**: `監査アラート`

### 5-1. 共通本文テンプレート（単一アクションで 3 段階対応）

ネスト Condition を避け、通知アクション 1 つで 3 段階を表示したい場合は
`if()` を本文側に埋め込むパターンでも動作する:

```
【モニタリング期限通知】

利用者名: @{items('Apply_to_each')?['cr013_fullName']}
最終実施日: @{outputs('Compose_BaseDate')}
経過日数: @{outputs('Compose_DaysElapsed')} 日

⚠️ 状態:
@{if(greaterOrEquals(outputs('Compose_DaysElapsed'),90),'期限超過',
   if(greaterOrEquals(outputs('Compose_DaysElapsed'),83),'残り1週間',
   '残り2週間'))}

対応をお願いします。
詳細: https://audit-management-system-mvp.momosantanuki.workers.dev/monitoring-meeting/@{items('Apply_to_each')?['cr013_userId']}
```

> ただし Adaptive Card で **色・アイコン・タイトルを段階別に出し分けたい**場合は
> ネスト Condition で 3 アクションに分けるほうが推奨 (§4-5 参照)。

### 5-2. ステータス表示ルール

| 経過日数 | 表示 |
|---------|------|
| 75–82 日 | `期限まで残り 2 週間` |
| 83–89 日 | `期限まで残り 1 週間` |
| 90 日以上 | `期限超過` |

### 5-3. Adaptive Card (推奨)

```json
{
  "type": "AdaptiveCard",
  "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
  "version": "1.3",
  "body": [
    {
      "type": "TextBlock",
      "text": "⚠️ モニタリング期限通知",
      "weight": "Bolder",
      "size": "Medium",
      "color": "Warning"
    },
    {
      "type": "FactSet",
      "facts": [
        { "title": "利用者", "value": "@{items('Apply_to_each')?['cr013_fullName']}" },
        { "title": "最終実施日", "value": "@{outputs('Compose_BaseDate')}" },
        { "title": "経過日数", "value": "@{outputs('Compose_DaysElapsed')} 日" },
        { "title": "状態", "value": "{STATUS}" }
      ]
    }
  ],
  "actions": [
    {
      "type": "Action.OpenUrl",
      "title": "この利用者のモニタリングを開く",
      "url": "https://audit-management-system-mvp.momosantanuki.workers.dev/monitoring-meeting/@{items('Apply_to_each')?['cr013_userId']}"
    }
  ]
}
```

- 90 日以上: `color: "Attention"` / タイトル `🚨 モニタリング期限超過`
- 83 日以上: `color: "Warning"` / タイトル `⚠️ 期限まで残り 1 週間`
- 75 日以上: `color: "Accent"`  / タイトル `🔔 期限まで残り 2 週間`

---

## 6. ガード条件まとめ

以下の場合は**通知しない**:

| 条件 | 理由 | 将来対応 |
|------|------|---------|
| `Get_LatestMeeting` が 0 件 | 未実施は別ロジックで扱う | 「初回未実施」フロー |
| `cr014_status` が `finalized` でない | draft は確定前なので期限にカウントしない | 「draft 滞留」フロー |
| `meetingDate` / `finalizedAt` 両方空 | 基準日が立たない | データ品質異常として別 ch へエスカレ |
| `daysElapsed` < 75 | 通知対象外 | — |

`Compose_BaseDate` が empty になった場合の防御として、最上位に
`Condition: empty(outputs('Compose_BaseDate'))` を置くのが安全。

---

## 7. 実装のコツ

- **OData フィルターで最小取得**: 各ユーザーで `$top=1 & $orderby=cr014_meetingDate desc`。
- **式評価は Compose に切り出す**: Condition 内にネストした式を書かない (デバッグ不能になる)。
- **Text 列の日付**は必ず `formatDateTime()` で正規化してから `ticks()` に渡す。
- **時刻境界**: `varToday` をフロー開始時に JST で固定。実行途中で `utcNow()` を呼ばない。
- **再試行ポリシー**: SharePoint アクションは `指数 / 3 回 / PT5M` を設定。

---

## 8. 完了定義 (DoD)

- [ ] 毎日 09:00 JST にフローが実行される
- [ ] `Users_Master` (isActive=true) がループ対象になる
- [ ] 各利用者の最新 finalized 記録が取得できる
- [ ] `meetingDate` 優先 / `finalizedAt` フォールバックで基準日が決まる
- [ ] 経過日数が JST ベースで正しく算出される
- [ ] 75 / 83 / 90 日の 3 段階で通知が分岐する
- [ ] Teams チャネルに Adaptive Card が投稿される
- [ ] 記録なしユーザーは通知されず `skippedNoRecord` に計上される
- [ ] 実行履歴で全ユーザー走査が成功することを確認

---

## 9. 次フェーズ（参考）

- **担当者個別メンション**: `cr014_recordedBy` からプロフィール解決して `@mention`
- **draft 滞留アラート**: `cr014_status eq 'draft'` かつ `cr014_recordedAt` が X 日以上古い
- **初回未実施アラート**: `Get_LatestMeeting` が 0 件のユーザーを別途集計
- **ダッシュボード連携**: 通知発火ログを `SupportPlanAuditLog` 等に永続化
- **2 週間前の早期リマインド強化**: 60 / 75 / 90 の 3 段階に拡張

---

## テスト手順（本番前）

### ステップ 1 — ダミーデータ準備

`Users_Master` に以下のテストユーザーを `cr013_isActive = true` で作成。
`cr014_userId` は必ず Users_Master の `cr013_userId` と一致させること。

| # | `cr013_userId` | `cr013_fullName` | 用途 |
|---|---------------|------------------|------|
| 1 | `TEST_A` | テスト利用者A | 境界下 (通知対象外) |
| 2 | `TEST_B` | テスト利用者B | 75日 境界 |
| 3 | `TEST_C` | テスト利用者C | 83日 境界 |
| 4 | `TEST_D` | テスト利用者D | 90日 境界 |
| 5 | `TEST_E` | テスト利用者E | 記録なし |
| 6 | `TEST_F` | テスト利用者F | meetingDate 欠損 → finalizedAt フォールバック |
| 7 | `TEST_G` | テスト利用者G | draft のみ (ガード検証) |

続いて `MonitoringMeetings` に以下を作成（`TODAY` は実行日 JST）:

| `cr014_userId` | `cr014_meetingDate` | `cr014_finalizedAt` | `cr014_status` |
|---------------|---------------------|---------------------|----------------|
| `TEST_A` | `TODAY - 74` 日 | `TODAY - 74` 日 | `finalized` |
| `TEST_B` | `TODAY - 78` 日 | `TODAY - 78` 日 | `finalized` |
| `TEST_C` | `TODAY - 85` 日 | `TODAY - 85` 日 | `finalized` |
| `TEST_D` | `TODAY - 95` 日 | `TODAY - 95` 日 | `finalized` |
| (`TEST_E` 行なし) | — | — | — |
| `TEST_F` | (空欄) | `TODAY - 80` 日 | `finalized` |
| `TEST_G` | `TODAY - 100` 日 | (空欄) | `draft` |

### ステップ 2 — 期待結果マトリクス

| ケース | `Compose_BaseDate` | `Compose_DaysElapsed` | 通過する分岐 | Teams 通知 | カウンター |
|--------|--------------------|----------------------|--------------|------------|-----------|
| A (74 日) | `TODAY - 74` | `74` | どの Condition も通らない | **なし** | なし |
| B (78 日) | `TODAY - 78` | `78` | `Condition_75` = Yes | 🔔 **残り2週間** | `notifiedCount +1` |
| C (85 日) | `TODAY - 85` | `85` | `Condition_83` = Yes | ⚠️ **残り1週間** | `notifiedCount +1` |
| D (95 日) | `TODAY - 95` | `95` | `Condition_90` = Yes | 🚨 **期限超過** | `notifiedCount +1` |
| E (なし) | — | — | `Has_Record` = No | **なし** | `skippedNoRecord +1` |
| F (Fallback) | `TODAY - 80` | `80` | `Condition_75` = Yes | 🔔 **残り2週間** | `notifiedCount +1` |
| G (draft) | — | — | `Get_LatestMeeting` が 0 件 (finalized フィルタ) → `Has_Record` = No | **なし** | `skippedNoRecord +1` |

**合計期待値** (1 回の実行で):

- `notifiedCount = 4` (B, C, D, F)
- `skippedNoRecord = 2` (E, G)
- Teams チャネル投稿 = 4 件

### ステップ 3 — 境界値の追加テスト（任意だが推奨）

境界日で **off-by-one** が起きないか検証する:

| `cr014_meetingDate` | `DaysElapsed` | 期待分岐 | 意味 |
|---------------------|---------------|---------|------|
| `TODAY - 74` 日 | `74` | なし | 境界の 1 日手前 |
| `TODAY - 75` 日 | `75` | 🔔 残り2週間 | 75 日ちょうど |
| `TODAY - 82` 日 | `82` | 🔔 残り2週間 | 83 日境界の 1 日手前 |
| `TODAY - 83` 日 | `83` | ⚠️ 残り1週間 | 83 日ちょうど |
| `TODAY - 89` 日 | `89` | ⚠️ 残り1週間 | 90 日境界の 1 日手前 |
| `TODAY - 90` 日 | `90` | 🚨 期限超過 | 90 日ちょうど |

> Tick 計算は 100ns 精度のため、`meetingDate` を `00:00:00` JST で投入すれば
> 境界日の判定はきれいに整数で揃う。時刻付きで投入すると `DaysElapsed` が
> `74.xxx` になる可能性があるので、`div()` の結果は整数前提で比較する
> (`greaterOrEquals` は浮動小数でも動作するが、可読性のため `int()` ラップを推奨)。

### ステップ 4 — 手動実行と検証

1. Power Automate デザイナで **Test** → **Manually** → **Save & Test** → **Run flow**
2. **Run history** を開き、成功 (緑) を確認
3. 各 `Apply_to_each` 反復について以下をクリックして検証:
   - `Get_LatestMeeting` の `value` が 0 件 or 1 件
   - `Compose_BaseDate` の出力
   - `Compose_DaysElapsed` の出力（**期待値マトリクスと一致するか**）
   - 通過した `Condition` の分岐
4. **Teams チャネル「監査アラート」** で 4 件のメッセージを確認:
   - B → 「残り2週間」
   - C → 「残り1週間」
   - D → 「期限超過」
   - F → 「残り2週間」
5. 各メッセージ末尾のディープリンクをクリックし、該当利用者のモニタリング画面
   (`https://audit-management-system-mvp.momosantanuki.workers.dev/monitoring-meeting/{userId}`)
   に遷移できるか確認

### ステップ 5 — 合格基準（テスト DoD）

- [ ] ステップ 2 の「合計期待値」が実行結果と一致
- [ ] ステップ 3 の境界値テストで 6 ケース全てが期待分岐に入る
- [ ] Teams チャネルに 4 件のメッセージが重複なく届く
- [ ] `TEST_E` / `TEST_G` で通知が**発生しない**ことを Run history で確認
- [ ] `TEST_F` で `Compose_BaseDate` が `finalizedAt` を採用している（Run history の出力でフォールバック動作を確認）
- [ ] Run history に失敗 (赤) が 1 件もない

### ステップ 6 — 本番投入

1. 全テストユーザー (`TEST_A` 〜 `TEST_G`) を `cr013_isActive = false` に変更（物理削除は不可）
2. フローを **On** に切り替え
3. 翌朝 9:00 JST の自動実行 Run history を確認
4. 初回 1 週間は毎朝 Run history をチェックし、異常があればフローを **Off**

---

## 参考リンク

- [Power Automate SharePoint コネクタ](https://learn.microsoft.com/ja-jp/connectors/sharepointonline/)
- [Adaptive Cards デザイナー](https://adaptivecards.io/designer/)
- [Power Automate 式リファレンス](https://learn.microsoft.com/ja-jp/azure/logic-apps/workflow-definition-language-functions-reference)

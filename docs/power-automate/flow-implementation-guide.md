# Power Automate フロー実装ガイド

## フロー作成手順

### 1. 基本設定

1. **Power Automate** を開く
2. **新しいフロー** → **スケジュール済みクラウドフロー** を選択
3. フロー名: `月次記録集計フロー (Daily Aggregation)`
4. スケジュール設定:
   - **繰り返し間隔**: 1日
   - **実行時刻**: 午後11:00
   - **タイムゾーン**: (UTC+09:00) 大阪、札幌、東京

### 2. 変数初期化

#### 変数一覧

```json
{
  "targetMonths": ["2025-10", "2025-11"],
  "holidays_2025_10": ["2025-10-14"],
  "holidays_2025_11": ["2025-11-03", "2025-11-23"],
  "processedUsers": 0,
  "errorCount": 0,
  "lowCompletionUsers": [],
  "executionStartTime": "",
  "teamsWebhookUrl": "https://outlook.office.com/webhook/[your-webhook]"
}
```

#### Power Automate アクション

1. **Initialize variable** - targetMonths
   - 名前: `targetMonths`
   - 種類: `Array`
   - 値: `["@{formatDateTime(utcNow(), 'yyyy-MM')}", "@{formatDateTime(addDays(utcNow(), -30), 'yyyy-MM')}"]`

2. **Initialize variable** - holidays (今月)
   - 名前: `holidays_current`
   - 種類: `Array`
   - 値: `["2025-11-03", "2025-11-23"]` (※要更新)

3. **Initialize variable** - processedUsers
   - 名前: `processedUsers`
   - 種類: `Integer`
   - 値: `0`

4. **Initialize variable** - errorCount
   - 名前: `errorCount`
   - 種類: `Integer`
   - 値: `0`

5. **Initialize variable** - lowCompletionUsers
   - 名前: `lowCompletionUsers`
   - 種類: `Array`
   - 値: `[]`

6. **Initialize variable** - executionStartTime
   - 名前: `executionStartTime`
   - 種類: `String`
   - 値: `@{utcNow()}`

### 3. SharePoint データ取得

#### A. SupportRecord_Daily 取得

**アクション**: `Get items` (SharePoint)

- **サイトアドレス**: `https://[your-tenant].sharepoint.com/sites/[site-name]`
- **リスト名**: `SupportRecord_Daily`
- **並べ替え順序**: `UserId` 昇順
- **上位件数の制限**: `5000`
- **フィルタークエリ**:

```odata
(startswith(cr013_recorddate, '@{first(variables('targetMonths'))}') or startswith(cr013_recorddate, '@{last(variables('targetMonths'))}'))
and UserId ne null
```

- **Select**: `UserId,cr013_recorddate,Completed,Incident,cr013_specialnote`

#### B. 既存MonthlyRecord_Summary取得

**アクション**: `Get items` (SharePoint)

- **サイトアドレス**: (同上)
- **リスト名**: `MonthlyRecord_Summary`
- **フィルタークエリ**:

```odata
(YearMonth eq '@{first(variables('targetMonths'))}' or YearMonth eq '@{last(variables('targetMonths'))}')
```

### 4. ユーザー別集計処理

#### A. ユニークユーザー抽出

**アクション**: `Select` (Data Operation)

- **From**: `body('Get_items_-_SupportRecord_Daily')?['value']`
- **Map**: `item()?['UserId']`

**アクション**: `Union` (Data Operation)

- **From**: `body('Select')`
- **Join with**: `createArray()`

#### B. ユーザー毎ループ処理

**アクション**: `Apply to each` - Process each user

- **Select an output from previous steps**: `body('Union')`

##### B-1. 対象月毎のループ

**内部アクション**: `Apply to each` - Process each month

- **Select an output**: `variables('targetMonths')`

##### B-2. 月次集計計算

**内部アクション群**:

1. **Filter array** - User records for month
   ```json
   @and(
     equals(item()?['UserId'], items('Apply_to_each_-_Process_each_user')),
     startswith(item()?['cr013_recorddate'], items('Apply_to_each_-_Process_each_month'))
   )
   ```

2. **Compose** - Calculate working days
   ```javascript
   // 稼働日数計算ロジック
   // ※ 実装は複雑なため、カスタム関数またはAzure Functionsを推奨
   @{div(mul(length(variables('holidays_current')), -1), 1)}
   ```

3. **Compose** - Calculate KPIs
   ```json
   {
     "userId": "@{items('Apply_to_each_-_Process_each_user')}",
     "yearMonth": "@{items('Apply_to_each_-_Process_each_month')}",
     "totalDays": "@{outputs('Compose_-_Calculate_working_days')}",
     "completedCount": "@{length(filter(body('Filter_array_-_User_records_for_month'), equals(item()?['Completed'], true)))}",
     "pendingCount": "@{length(filter(body('Filter_array_-_User_records_for_month'), equals(item()?['Completed'], false)))}",
     "specialNoteCount": "@{length(filter(body('Filter_array_-_User_records_for_month'), not(empty(item()?['cr013_specialnote']))))}",
     "incidentCount": "@{length(filter(body('Filter_array_-_User_records_for_month'), equals(item()?['Incident'], true)))}",
     "completionRate": "@{div(mul(length(filter(body('Filter_array_-_User_records_for_month'), equals(item()?['Completed'], true))), 100), outputs('Compose_-_Calculate_working_days'))}"
   }
   ```

##### B-3. MonthlyRecord_Summary 更新

1. **Compose** - Generate Key
   ```javascript
   @{concat(outputs('Compose_-_Calculate_KPIs')?['userId'], '_', outputs('Compose_-_Calculate_KPIs')?['yearMonth'])}
   ```

2. **Get items** - Check existing record
   - **フィルタークエリ**: `Key eq '@{outputs('Compose_-_Generate_Key')}'`

3. **Condition** - Record exists?
   - **条件**: `@greater(length(body('Get_items_-_Check_existing_record')?['value']), 0)`

4. **If yes** - Update existing record
   ```json
   {
     "TotalDays": "@{outputs('Compose_-_Calculate_KPIs')?['totalDays']}",
     "WorkingDays": "@{outputs('Compose_-_Calculate_KPIs')?['totalDays']}",
     "CompletedCount": "@{outputs('Compose_-_Calculate_KPIs')?['completedCount']}",
     "PendingCount": "@{outputs('Compose_-_Calculate_KPIs')?['pendingCount']}",
     "EmptyCount": "@{sub(outputs('Compose_-_Calculate_KPIs')?['totalDays'], add(outputs('Compose_-_Calculate_KPIs')?['completedCount'], outputs('Compose_-_Calculate_KPIs')?['pendingCount']))}",
     "SpecialNoteCount": "@{outputs('Compose_-_Calculate_KPIs')?['specialNoteCount']}",
     "IncidentCount": "@{outputs('Compose_-_Calculate_KPIs')?['incidentCount']}",
     "CompletionRate": "@{outputs('Compose_-_Calculate_KPIs')?['completionRate']}",
     "LastAggregatedAt": "@{utcNow()}"
   }
   ```

5. **If no** - Create new record
   ```json
   {
     "Key": "@{outputs('Compose_-_Generate_Key')}",
     "UserId": "@{outputs('Compose_-_Calculate_KPIs')?['userId']}",
     "YearMonth": "@{outputs('Compose_-_Calculate_KPIs')?['yearMonth']}",
     "TotalDays": "@{outputs('Compose_-_Calculate_KPIs')?['totalDays']}",
     "WorkingDays": "@{outputs('Compose_-_Calculate_KPIs')?['totalDays']}",
     "CompletedCount": "@{outputs('Compose_-_Calculate_KPIs')?['completedCount']}",
     "PendingCount": "@{outputs('Compose_-_Calculate_KPIs')?['pendingCount']}",
     "EmptyCount": "@{sub(outputs('Compose_-_Calculate_KPIs')?['totalDays'], add(outputs('Compose_-_Calculate_KPIs')?['completedCount'], outputs('Compose_-_Calculate_KPIs')?['pendingCount']))}",
     "SpecialNoteCount": "@{outputs('Compose_-_Calculate_KPIs')?['specialNoteCount']}",
     "IncidentCount": "@{outputs('Compose_-_Calculate_KPIs')?['incidentCount']}",
     "CompletionRate": "@{outputs('Compose_-_Calculate_KPIs')?['completionRate']}",
     "LastAggregatedAt": "@{utcNow()}"
   }
   ```

##### B-4. 要注意ユーザー判定

**内部アクション**: `Condition` - Low completion rate?

- **条件**: `@less(outputs('Compose_-_Calculate_KPIs')?['completionRate'], 70)`

**If yes**: `Append to array variable`
- **名前**: `lowCompletionUsers`
- **値**:
```json
{
  "userId": "@{outputs('Compose_-_Calculate_KPIs')?['userId']}",
  "yearMonth": "@{outputs('Compose_-_Calculate_KPIs')?['yearMonth']}",
  "completionRate": "@{outputs('Compose_-_Calculate_KPIs')?['completionRate']}"
}
```

##### B-5. カウンター更新

**アクション**: `Increment variable`
- **名前**: `processedUsers`
- **値**: `1`

### 5. エラーハンドリング

#### A. Try-Catch パターン

各SharePoint操作を `Scope` アクションで囲み、エラー時の処理を定義:

1. **Scope** - SharePoint Operations
2. **Scope** - Handle SharePoint Errors
   - **実行条件**: `@equals(result('SharePoint_Operations'), 'Failed')`
   - **アクション**: `Increment variable` (errorCount)

#### B. リトライ設定

SharePointアクションの設定:
- **再試行ポリシー**: `指数`
- **再試行回数**: `3`
- **再試行間隔**: `PT5M, PT10M, PT20M`

### 6. Teams通知

#### A. 成功通知

**アクション**: `Post message in a chat or channel` (Teams)

**条件**: `@and(equals(variables('errorCount'), 0), greater(variables('processedUsers'), 0))`

**メッセージ**:
```json
{
  "type": "message",
  "attachments": [{
    "contentType": "application/vnd.microsoft.card.adaptive",
    "content": {
      "type": "AdaptiveCard",
      "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
      "version": "1.0",
      "body": [
        {
          "type": "TextBlock",
          "text": "✅ 月次記録集計完了",
          "weight": "Bolder",
          "size": "Medium",
          "color": "Good"
        },
        {
          "type": "FactSet",
          "facts": [
            {
              "title": "実行日時",
              "value": "@{formatDateTime(variables('executionStartTime'), 'yyyy-MM-dd HH:mm', 'ja-JP')}"
            },
            {
              "title": "処理利用者数",
              "value": "@{variables('processedUsers')}名"
            },
            {
              "title": "要注意者",
              "value": "@{length(variables('lowCompletionUsers'))}名"
            },
            {
              "title": "処理時間",
              "value": "@{div(sub(ticks(utcNow()), ticks(variables('executionStartTime'))), 600000000)}分"
            }
          ]
        }
      ],
      "actions": [
        {
          "type": "Action.OpenUrl",
          "title": "月次記録を確認",
          "url": "https://[your-app-domain]/records/monthly"
        }
      ]
    }
  }]
}
```

#### B. 要注意アラート

**条件**: `@greater(length(variables('lowCompletionUsers')), 0)`

**アクション**: `Post message in a chat or channel` (Teams)

**メッセージ**:
```json
{
  "type": "message",
  "attachments": [{
    "contentType": "application/vnd.microsoft.card.adaptive",
    "content": {
      "type": "AdaptiveCard",
      "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
      "version": "1.0",
      "body": [
        {
          "type": "TextBlock",
          "text": "⚠️ 月次記録完了率要注意",
          "weight": "Bolder",
          "size": "Medium",
          "color": "Warning"
        },
        {
          "type": "TextBlock",
          "text": "@{length(variables('lowCompletionUsers'))}名の利用者の完了率が70%を下回っています。"
        },
        {
          "type": "TextBlock",
          "text": "@{join(map(variables('lowCompletionUsers'), concat(item()?['userId'], ': ', string(item()?['completionRate']), '% (', item()?['yearMonth'], ')')), '\\n')}",
          "wrap": true
        }
      ],
      "actions": [
        {
          "type": "Action.OpenUrl",
          "title": "詳細確認",
          "url": "https://[your-app-domain]/records/monthly?filter=low"
        }
      ]
    }
  }]
}
```

#### C. エラー通知

**条件**: `@greater(variables('errorCount'), 0)`

**アクション**: `Post message in a chat or channel` (Teams)

**メッセージ**:
```json
{
  "type": "message",
  "attachments": [{
    "contentType": "application/vnd.microsoft.card.adaptive",
    "content": {
      "type": "AdaptiveCard",
      "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
      "version": "1.0",
      "body": [
        {
          "type": "TextBlock",
          "text": "🚨 月次記録集計エラー",
          "weight": "Bolder",
          "size": "Medium",
          "color": "Attention"
        },
        {
          "type": "FactSet",
          "facts": [
            {
              "title": "エラー発生時刻",
              "value": "@{formatDateTime(utcNow(), 'yyyy-MM-dd HH:mm', 'ja-JP')}"
            },
            {
              "title": "エラー件数",
              "value": "@{variables('errorCount')}件"
            },
            {
              "title": "処理済み利用者",
              "value": "@{variables('processedUsers')}名"
            },
            {
              "title": "実行ID",
              "value": "@{workflow()?['run']?['name']}"
            }
          ]
        }
      ],
      "actions": [
        {
          "type": "Action.OpenUrl",
          "title": "フロー履歴確認",
          "url": "https://make.powerautomate.com/flows/@{workflow()?['id']}/runs"
        }
      ]
    }
  }]
}
```

## デプロイ・運用

### 1. テスト実行

1. **手動実行**でフローをテスト
2. **少数ユーザー**でのデータ整合性確認
3. **本番データ**での動作確認

### 2. 監視設定

1. **Power Automate Admin Center** でフロー監視
2. **実行履歴**の定期確認
3. **パフォーマンス指標**の追跡

### 3. 保守・更新

1. **祝日データ**の年次更新
2. **Teams Webhook URL**の管理
3. **SharePoint権限**の維持

---

## 参考リンク

- [Power Automate SharePoint コネクタ](https://docs.microsoft.com/ja-jp/connectors/sharepointonline/)
- [Adaptive Cards デザイナー](https://adaptivecards.io/designer/)
- [Power Automate 式リファレンス](https://docs.microsoft.com/ja-jp/azure/logic-apps/workflow-definition-language-functions-reference)
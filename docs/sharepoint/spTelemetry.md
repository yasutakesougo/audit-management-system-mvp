# SharePoint Telemetry Event Catalog

SharePoint 層の動作を観測可能にするためのイベント定義。

## 1. ライフサイクルイベント (Lifecycle)

### `sp:bootstrap_start`
- **タイミング**: アプリ起動時の一括初期化開始時
- **Level**: `info`
- **Payload**: なし

### `sp:bootstrap_complete`
- **タイミング**: 一括初期化完了時
- **Level**: `info`
- **Payload**:
  - `durationMs`: 所要時間 (ms)
  - `details`: `{ healthy: number, unhealthy: number }`

### `sp:list_missing_required`
- **タイミング**: `required` 属性のリストが存在しない場合
- **Level**: `error`
- **Payload**:
  - `key`: リスト識別子
  - `listName`: 解決されたリスト名
  - `error`: エラー詳細

### `sp:list_missing_optional`
- **タイミング**: `optional` または有効な `experimental` リストが存在しない場合
- **Level**: `info` (期待通りの動作として扱う)
- **Payload**:
  - `key`: リスト識別子
  - `listName`: リスト名

## 2. スキーマ・同期イベント (Schema & Sync)

### `sp:guid_resolution`
- **タイミング**: リスト名から GUID またはパスへの解決が発生した時
- **Level**: `info`
- **Payload**:
  - `key`: リスト識別子
  - `details`: 解決後のベースパス

### `sp:schema_mismatch`
- **タイミング**: リストは存在するが、必須フィールド（essentialFields）が不足している時
- **Level**: `warn`
- **Payload**:
  - `key`: リスト識別子
  - `details`: `{ missingFields: string[] }`

## 3. プロビジョニングイベント (Provisioning)

### `sp:provision_success`
- **タイミング**: リストの新規作成またはフィールドの追加（Self-Healing）に成功した時
- **Level**: `info`
- **Payload**:
  - `listName`: 対象リスト
  - `details`: `{ listId?: string, fieldCount?: number }`

### `sp:provision_failed`
- **タイミング**: プロビジョニング操作が失敗した時
- **Level**: `error`
- **Payload**:
  - `listName`: 対象リスト
  - `error`: 通信エラーやパーミッションエラーの詳細

# Method A Implementation Summary (即時保存)

## 概要

通所記録システムに「方式A（操作ごとに即時保存）」を実装しました。ユーザーが通所・退所・欠席などの操作を行うたびに、SharePoint Online にデータが自動保存されます。

## 実装内容

### 1. SharePoint フィールドマッピング定義

**ファイル**: `src/sharepoint/fields.ts`

以下の2つのリストのフィールドマッピングを追加:

#### AttendanceUsers (通所対象ユーザーマスタ)
- `UserCode`: ユーザーコード
- `Title`: ユーザー名
- `IsTransportTarget`: 送迎対象フラグ
- `StandardMinutes`: 標準提供時間（分）
- `IsActive`: 有効フラグ

#### AttendanceDaily (通所記録日次データ)
- `Key`: ユニークキー（`UserCode|YYYY-MM-DD`形式）
- `UserCode`: ユーザーコード
- `RecordDate`: 記録日（YYYY-MM-DD）
- `Status`: ステータス（未/通所中/退所済/当日欠席）
- `CheckInAt`: 入所時刻
- `CheckOutAt`: 退所時刻
- `CntAttendIn`: 通所回数
- `CntAttendOut`: 退所回数
- `TransportTo`: 往路送迎フラグ
- `TransportFrom`: 帰路送迎フラグ
- `ProvidedMinutes`: 提供時間（分）
- `IsEarlyLeave`: 早退フラグ
- `UserConfirmedAt`: 利用者確認日時
- `AbsentMorningContacted`: 朝連絡済みフラグ
- `AbsentMorningMethod`: 朝連絡方法
- `EveningChecked`: 夕方確認済みフラグ
- `EveningNote`: 夕方メモ
- `IsAbsenceAddonClaimable`: 欠席加算請求可能フラグ

### 2. リポジトリ実装

#### attendanceUsersRepository.ts

**場所**: `src/features/attendance/infra/attendanceUsersRepository.ts`

**機能**:
- `getActiveUsers()`: 有効な通所ユーザーの一覧を取得
- SharePoint の `AttendanceUsers` リストからデータを読み込み
- `IsActive eq 1` でフィルタリング
- `UserCode` でソート

**使用例**:
```typescript
const userItems = await getActiveUsers(spClient);
```

#### attendanceDailyRepository.ts

**場所**: `src/features/attendance/infra/attendanceDailyRepository.ts`

**機能**:
- `getDailyByDate(recordDate)`: 指定日の記録を取得
- `upsertDailyByKey(item)`: Keyベースで更新または作成
  - Key で既存レコードを検索（top=1）
  - 存在する場合: PATCH（updateItemByTitle）でETag制御
  - 存在しない場合: POST（addListItemByTitle）で新規作成

**Upsert ロジック**:
```typescript
// 1) GET by Key (top 1)
const existing = await client.getListItemsByTitle(listTitle, select, filter, undefined, 1);

// 2) if found -> PATCH by Id with ETag
if (existing && existing.length > 0) {
  const { etag } = await client.getItemByIdWithEtag(listTitle, existingId, select);
  await client.updateItemByTitle(listTitle, existingId, payload, { ifMatch: etag ?? '*' });
  return;
}

// 3) else -> POST
await client.addListItemByTitle(listTitle, payload);
```

### 3. AttendanceRecordPage.tsx の更新

**場所**: `src/pages/AttendanceRecordPage.tsx`

#### 追加機能

1. **データロード（起動時）**
   ```typescript
   useEffect(() => {
     const loadData = async () => {
       // 1. AttendanceUsers を取得
       const userItems = await getActiveUsers(spClient);
       setUsers(userItems.map(mapUserItem));
       
       // 2. 今日の AttendanceDaily を取得
       const dailyItems = await getDailyByDate(spClient, today);
       
       // 3. 無い人は初期行を補完
       const initialVisits = buildInitialVisits(loadedUsers, today);
       // ...merge logic
     };
     loadData();
   }, [spClient, today]);
   ```

2. **即時保存関数**
   ```typescript
   const saveVisit = useCallback(async (userCode: string) => {
     if (!spClient) return; // Demo mode
     
     const visit = visits[userCode];
     const key = `${userCode}|${today}`;
     const item: AttendanceDailyItem = { /* map visit to item */ };
     
     await upsertDailyByKey(spClient, item);
   }, [spClient, visits, users, today]);
   ```

3. **各操作に保存処理を追加**
   - `handleCheckIn`: 通所ボタン押下後に `await saveVisit(user.userCode)`
   - `handleCheckOut`: 退所ボタン押下後に `await saveVisit(user.userCode)`
   - `handleAbsenceSave`: 欠席保存後に `await saveVisit(user.userCode)`
   - `handleTransportToggle`: 送迎トグル後に `await saveVisit(user.userCode)`
   - `handleReset`: リセット後に `await saveVisit(user.userCode)`
   - **利用者確認ボタン**: クリック時に `await saveVisit(user.userCode)`

4. **ローディング状態の追加**
   ```tsx
   {loading ? (
     <Stack spacing={2} alignItems="center" sx={{ py: 8 }}>
       <Typography variant="h6" color="text.secondary">
         データを読み込んでいます...
       </Typography>
     </Stack>
   ) : (
     // ... 既存のUI
   )}
   ```

## 動作モード

### Demo Mode（SharePoint 未接続時）
- `spClient` が null の場合
- ハードコードされた `initialUsers` を使用
- 保存処理はスキップ（ローカル状態のみ）
- 既存の「押したら即反映」UXは維持

### Production Mode（SharePoint 接続時）
- 起動時に AttendanceUsers と AttendanceDaily を取得
- 各操作後に自動的に SharePoint へ保存
- Key = `UserCode|YYYY-MM-DD` で一意性を保証
- ETag による楽観的並行性制御

## Key の設計

```
Key = "${UserCode}|${RecordDate}"
例: "I001|2026-02-07"
```

- ユーザーごと・日付ごとに1レコード
- Upsert 時の検索条件として使用
- SharePoint の Title フィールドとして保存可能

## エラーハンドリング

- データロード失敗時: トースト通知「データの読み込みに失敗しました」
- 保存失敗時: トースト通知「保存に失敗しました」
- コンソールにエラーログを出力（デバッグ用）

## パフォーマンス最適化

- `useMemo` で SharePoint client をメモ化
- 各操作は非同期（await）だが、UI は即座に更新
- 保存エラーが起きてもUI操作は継続可能

## 今後の拡張ポイント

1. **月次集計からの欠席請求回数取得**
   ```typescript
   absenceClaimedThisMonth: 0, // TODO: 月次集計から取得
   ```

2. **日付選択機能**
   - 現在は `today` 固定
   - クエリパラメータ `?date=YYYY-MM-DD` 対応の余地あり

3. **オフライン対応**
   - IndexedDB へのキャッシュ
   - ネットワーク復旧時の自動同期

4. **バルク保存**
   - 複数ユーザーの一括保存
   - SharePoint Batch API の活用

## テスト戦略

- 既存の E2E テストが引き続き動作（Demo Mode で実行）
- SharePoint 統合テストは別途追加を検討
- リポジトリ層は `createSpClient` をモックすることでユニットテスト可能

## セキュリティ

- MSAL 認証（useAuth）を使用
- SharePoint REST API の権限設定に依存
- ETag による楽観的並行性制御で競合を防止

## まとめ

「方式A（操作ごとに即時保存）」により、以下を実現：

✅ **現場運用に強い**: 各操作が即座に保存されるため、データロストのリスクが最小
✅ **既存UX維持**: 「押したら即反映」のユーザー体験は変わらず
✅ **デュアルモード**: Demo/Production で自動切り替え
✅ **最小差分**: 既存コードへの影響を最小限に抑えた実装
✅ **拡張性**: Key ベースの設計で今後の機能追加に対応しやすい

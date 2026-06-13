# キオスク・トイレ記録盤アーキテクチャ

> 作成日: 2026-06-13
> 対象: `/kiosk/toilet`、`ToiletDailyBoard`、`useToiletRecords`、`ToiletRecords` repository
> 目的: トイレ記録の日次盤が、現場端末 UI、日付指定、SharePoint 永続化、障害時フォールバックをどの境界で担っているかを固定する

---

## 1. Entry Point

`/kiosk/toilet` は `src/pages/kiosk/KioskToiletPage.tsx` から `ToiletDailyBoard` をそのまま描画する。

キオスク下部ナビゲーションでは `/kiosk/toilet` が専用画面として登録され、画面内の戻る導線は `appendKioskSearchParams('/kiosk', location.search)` を使ってキオスク系の検索条件を引き継ぐ。

日付は URL query の `date=YYYY-MM-DD` を優先する。形式が不正な場合は当日 (`toLocalDateISO(new Date())`) にフォールバックする。

---

## 2. Main UI Structure

`ToiletDailyBoard` は、共有タブレットでの当日確認を前提に、以下の領域で構成される。

| 領域 | 役割 |
|---|---|
| Header | 画面タイトル、対象日、未記録/記録済みサマリを表示する |
| User grid | トイレ誘導対象の利用者を 1 行ずつ表示し、記録状態と追加記録ボタンを出す |
| Daily history | 対象日の全記録を利用者別に表示し、各記録から訂正ダイアログを開く |
| Create dialog | 新規トイレ記録を登録する |
| Correction dialog | 既存記録の訂正可能項目だけを更新する |

利用者一覧は `useUsers({ selectMode: 'core' })` で取得し、`IsActive !== false` かつ `RequiresToiletGuidance === true` の利用者だけを日次盤の対象にする。

各利用者の最新状態は `records.find((record) => record.userId === resolveUserKey(user))` で判定する。`listByDate` は新しい `occurredAt` 順に返すため、同一利用者の先頭 record が日次盤上の最新表示になる。

---

## 3. Create Flow

新規登録は `openForm(user)` でダイアログを開き、以下の初期値を入れる。

| 項目 | 初期値 |
|---|---|
| 利用者 | 選択した利用者。表示のみ |
| 時間 | 対象日の年月日 + 現在時刻 |
| 種類 | `urination` |
| 量 | `normal` |
| メモ | 空文字 |

保存時は `useToiletRecords(selectedDateIso).create()` を呼び、`userId`、`occurredAt`、`toiletType`、`amount`、`memo`、`recorderName: 'kiosk'` を渡す。

保存成功後の一覧更新は hook 側の `refresh()` に任せる。画面側は成功時に新規登録ダイアログを閉じ、失敗時はダイアログ内に保存エラーを表示する。

---

## 4. Correction Flow

訂正導線は日次履歴の各記録にある「訂正」ボタンから開く。

訂正ダイアログの初期値は既存 record から取得する。

| 項目 | 扱い |
|---|---|
| 利用者 | 表示のみ。変更不可 |
| 記録日 | 表示のみ。変更不可 |
| 記録日時 | 表示のみ。変更不可 |
| 種類 | 訂正可能 |
| 量 | 訂正可能 |
| メモ | 訂正可能 |

保存時は `correct(record.id, { toiletType, amount, memo })` を呼ぶ。`userId`、`recordDate`、`occurredAt` は UI から送らず、repository contract でも更新対象にしない。

保存成功後は訂正ダイアログを閉じる。保存失敗時は訂正ダイアログ内にエラーを表示し、画面全体の実装範囲を広げない。

---

## 5. Hook Boundary

`useToiletRecords(dateIso)` は UI と repository の境界を担う。

主な責務は次の通り。

- `dateIso` に対する `repository.listByDate(dateIso)` の実行
- `records`、`isLoading`、`error` の状態管理
- `create(input)` 成功後の `refresh()`
- `correct(recordId, patch)` 成功後の `refresh()`
- 訂正失敗時の `error` state 反映
- `spFetch` と `getListFieldInternalNames` を ref 経由で安定参照し、repository インスタンスを不要に作り直さないこと

`refresh()` は request sequence を持ち、古い非同期応答が新しい表示状態を上書きしないようにしている。

---

## 6. Repository Selection

repository は `toiletRepositoryFactory` で選択される。

| 条件 | 選択される repository |
|---|---|
| demo 判定が有効 | `LocalStorageToiletRecordRepository` |
| `provider=local` または `provider=memory` | `LocalStorageToiletRecordRepository` |
| `VITE_DATA_PROVIDER=local` または `memory` | `LocalStorageToiletRecordRepository` |
| `spFetch` がない | `LocalStorageToiletRecordRepository` |
| 上記以外 | `SharePointToiletRecordRepository` |

デフォルトは SharePoint 永続化だが、demo/ローカル/メモリ指定ではブラウザ `localStorage` に安全に閉じる。

---

## 7. LocalStorage Repository

`LocalStorageToiletRecordRepository` は `kiosk.toiletRecords.v1` に `ToiletRecord[]` を保存する。

`create()` は domain id として `toilet-${Date.now()}-${random}` を生成し、`recordDate` は `occurredAt` からローカル日付で計算する。

`listByDate(dateIso)` は `isDeleted` ではない record だけを対象に、`occurredAt` のローカル日付が `dateIso` と一致するものを新しい順に返す。

`update(recordId, patch)` は既存 record を id で探し、`toiletType`、`amount`、`memo` だけを更新する。record id、利用者、記録日、記録日時、作成日時は維持する。

---

## 8. SharePoint Repository

`SharePointToiletRecordRepository` は `toilet_records` registry entry から実際のリスト名を解決する。既定のリスト名は `ToiletRecords` で、`VITE_SP_LIST_TOILET_RECORDS` による上書きにも対応する。

`create()` は domain id を SharePoint item の `Title` に保存する。`UserId`、`RecordDate`、`OccurredAt`、`ToiletType`、`Amount`、`Memo`、`RecorderName`、`Source`、`IsDeleted` を payload として送る。

`listByDate(dateIso)` は `RecordDate` の日付 range query を優先し、`IsDeleted` が false または null の item を取得する。primary query が 0 件の場合は、直近 item を広めに取得して domain 側で `recordDate === dateIso` と `!isDeleted` を再判定する fallback query を行う。

`update(recordId, patch)` は `Title eq recordId` で SharePoint item を lookup し、取得した SharePoint item id に対して `MERGE` を送る。送信 payload は `toiletType`、`amount`、`memo` の対応フィールドだけで、利用者・記録日時・記録日は送らない。

---

## 9. Dynamic Field Resolution

`ToiletRecords` は schema drift を吸収するため、`TOILET_RECORD_CANDIDATES` を使って物理列名を解決する。

主な候補は次の通り。

| Domain key | Candidate examples |
|---|---|
| `userId` | `UserId`, `UserID`, `User Id`, `User ID` |
| `recordDate` | `RecordDate`, `Record Date` |
| `occurredAt` | `OccurredAt`, `Occurred At` |
| `toiletType` | `ToiletType`, `Toilet Type` |
| `amount` | `Amount` |
| `memo` | `Memo` |
| `recorderName` | `RecorderName`, `Recorder Name` |
| `source` | `Source` |
| `isDeleted` | `IsDeleted`, `Is Deleted` |

field set が取得できた場合、payload は実在する物理列だけに絞られる。field set が取得できない場合は fail-open とし、既定候補名で送信する。

---

## 10. Error Handling

利用者取得エラーとトイレ記録取得エラーは UI 上で別に扱う。

| エラー | 表示 |
|---|---|
| `Users_Master` 取得失敗 | 利用者行を出さず、アクセス権限または認証状態の確認を促す |
| `ToiletRecords` 取得失敗 | 記録済み/未記録判定を止め、再読み込みボタンを表示する |
| 新規保存失敗 | 新規登録ダイアログ内に保存エラーを表示する |
| 訂正保存失敗 | 訂正ダイアログ内に訂正エラーを表示する |

記録取得エラー時は日次履歴も非表示にし、誤った未記録/記録済み判定を表示しない。

---

## 11. Current Contract

現在の `IToiletRecordRepository` contract は次の 3 操作に限定される。

```ts
listByDate(dateIso: string): Promise<ToiletRecord[]>;
create(input: ToiletRecordInput): Promise<ToiletRecord>;
update(recordId: string, patch: ToiletRecordCorrectionPatch): Promise<ToiletRecord>;
```

削除操作は kiosk UI から公開しない。訂正 patch は `toiletType`、`amount`、`memo` だけを許可する。

このドキュメントは現行構造の整理であり、runtime behavior、SharePoint list 定義、routing、environment 設定は変更しない。

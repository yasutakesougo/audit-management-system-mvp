# Attendance 機能設計メモ

## 1. ゴールと前提

- 通所実績（出席 / 欠席 / 送迎 / 乖離）を一元管理し、請求・看護・日次記録の土台にする。
- Schedules（予定）→ Attendance（実績）→ Daily Support Records（中身）という縦の流れを明確にする。
- Demo/SharePoint を切り替え可能にし、まずはフロント単体で検証できるようにする。

前提要素:

- データソース:
  - Demo モード: ローカル or モック（今後追加予定）
  - SharePoint モード: リスト `Daily_Attendance`（想定）
- 代表的な導線:
  - 開発: `npm run dev:attendance` → `/daily/attendance`
  - 本番想定: `VITE_FORCE_SHAREPOINT=1` / `VITE_SKIP_LOGIN=0`
- 環境定数: `VITE_ATTENDANCE_DISCREPANCY_THRESHOLD`, `VITE_ABSENCE_MONTHLY_LIMIT`, `VITE_FACILITY_CLOSE_TIME`（`src/config/serviceRecords.ts`）

---

## 2. ポート設計（案）

- `useAttendancePort`（想定）で Demo / SharePoint を吸収する構造を採用する。
- Demo: メモリ or localStorage ベースで `AttendanceVisit` を返す。
- SharePoint: `spClient` 経由で `Daily_Attendance` を CRUD し、マッピングを一箇所に集約する。
- ロギング例: `[attendance] using Demo port` / `[attendance] using SharePoint port`

---

## 3. データモデル

### 3.1 型（`src/features/attendance/attendance.logic.ts`）

- `AttendanceUser`: userCode / userName / isTransportTarget / absenceClaimedThisMonth / standardMinutes
- `AttendanceVisit` 主フィールド:
  - `userCode`, `recordDate`, `status` (`未` | `通所中` | `退所済` | `当日欠席`)
  - `cntAttendIn`, `cntAttendOut`
  - `transportTo`, `transportFrom`
  - `isEarlyLeave`
  - `absentMorningContacted`, `absentMorningMethod` (`電話` | `SMS` | `家族` | `その他` | ``)
  - `eveningChecked`, `eveningNote`
  - `isAbsenceAddonClaimable`
  - `providedMinutes`
  - `userConfirmedAt?`, `checkInAt?`, `checkOutAt?`

### 3.2 SharePoint リストとの対応（案）

- リスト名: `Daily_Attendance`（環境変数 `VITE_SP_LIST_ATTENDANCE` と合わせる）
- 内部名は `src/sharepoint/fields.ts` に揃えること（ハードコード禁止）。未定義の列は追加する。
- 主要列マッピング案（内部名ベース）:

| 内部名 (SP) | 型 | 用途 / 備考 |
| --- | --- | --- |
| `Title` | text | 利用者氏名 or 任意タイトル |
| `RecordDate` | date | 通所日（必須） |
| `UserIdId` | lookup | Users_Master への Lookup（主キー） |
| `AttendanceStatus` | choice/text | `未` / `通所中` / `退所済` / `当日欠席` |
| `AttendInCount` | number | 入所回数 (cntAttendIn) |
| `AttendOutCount` | number | 退所回数 (cntAttendOut) |
| `CheckInTime` | datetime | 入所時刻（任意） |
| `CheckOutTime` | datetime | 退所時刻（任意） |
| `ProvidedMinutes` | number | 実提供分数（diffMinutes 計算結果） |
| `TransportTo` | bool | 送迎（行き） |
| `TransportFrom` | bool | 送迎（帰り） |
| `IsEarlyLeave` | bool | 早退フラグ |
| `AbsentMorningContacted` | bool | 朝連絡の有無 |
| `AbsentMorningMethod` | choice/text | `電話` / `SMS` / `家族` / `その他` / `` |
| `EveningChecked` | bool | 夕確認の有無 |
| `EveningNote` | text | 夕確認メモ |
| `IsAbsenceAddonClaimable` | bool | 欠席加算算定可否 |
| `UserConfirmedAt` | datetime | サインオフ時刻（任意） |
| `Notes` | text | 備考 |
| `@odata.etag` / `Created` / `Modified` | 既定 | SP 既定列 |

---

## 4. Schedules との関係

- 予定 (`ScheduleEvent`) の dayKey と通所実績 (`AttendanceVisit.recordDate`) を突合する。
- 欠席は `buildAbsentVisit` で実績を明示化し、請求用の欠席加算判定を保持する。
- 乖離検出 (`getDiscrepancyCount`) の閾値は `VITE_ATTENDANCE_DISCREPANCY_THRESHOLD` を使用。

---

## 5. 環境・起動

- 開発ショートカット: `npm run dev:attendance` → `http://localhost:5176/daily/attendance`
- 本番相当の例:
  - `VITE_FORCE_SHAREPOINT=1`
  - `VITE_SKIP_LOGIN=0`
  - `VITE_SP_LIST_ATTENDANCE=Daily_Attendance`
  - `VITE_ATTENDANCE_DISCREPANCY_THRESHOLD=0.8`（例）
  - `VITE_ABSENCE_MONTHLY_LIMIT=3`（例）
  - `VITE_FACILITY_CLOSE_TIME=17:30`（例）

---

## 6. テスト方針

- ユニット: `tests/unit/attendance*.spec.*`, `src/features/attendance/__tests__/attendance*.spec.*`
- ミニ回帰: `npm run test:attendance:mini`
- E2E: `tests/e2e/attendance.basic.spec.ts`, `tests/e2e/attendance.record.spec.ts`（必要に応じて baseURL / env を揃える）

---

## 7. 今後の拡張メモ

- 送迎ログ（到着・出発時刻）の粒度を上げるか検討。
- Daily Support Records との紐付けキー（userId + date）を共通化。
- 国保連 CSV 生成への接続ポイントを設計（欠席加算・延長加算など）。

---

## 8. 国保連 CSV との対応（方針メモ）

通所実績の最終アウトプットは国保連請求 CSV。`Daily_Attendance` の各フィールドを請求項目にマッピングする想定を事前に共有しておく。

| 区分 | Daily_Attendance フィールド | 国保連 CSV 項目例 | 説明 |
| --- | --- | --- | --- |
| 利用者識別 | `UserIdId` (lookup) / `userCode` | 被保険者番号 / 利用者ID | userCode をキーにマスタ解決し、CSV の識別子を埋める |
| サービス提供年月日 | `RecordDate` | サービス提供年月日 | `Schedules` と同じ日付軸で突合 |
| サービス種別 | `serviceCode` / `serviceCategory` (今後追加) | サービスコード | 生活介護・短期入所など。列追加時は `fields.ts` と同期 |
| 単位数 | `ProvidedMinutes` / `providedUnits` (今後追加) | 提供時間数 / 単位数 | 乖離判定や加算込みの提供時間を反映 |
| 算定区分 | `AttendanceStatus` / `billingStatus` (今後追加) | 区分（通常/欠席/入院等） | 欠席加算・入院時などをここで区別 |
| 加算 | `addOnFlags` (今後追加) | 各種加算フラグ | 送迎・重度・初期加算などをビット/列で保持 |
| 備考・摘要 | `Notes` / `remark` | 摘要 | 手動メモやイレギュラーの根拠 |

※ 国保連の正確な項目名は導入先に合わせて微修正する。列追加時は `src/sharepoint/fields.ts` と同期し、ここも更新すること。

---

## 9. 出席ステータス enum 案（暫定）

請求・運用で意味がブレないよう `AttendanceVisit.status` を enum で固定する方針。

- `attended`（通常出席）
- `absent_with_notice`（事前連絡あり欠席・欠席加算対象）
- `absent_without_notice`（無断欠席・減算対象の可能性）
- `hospitalized`（入院中）
- `day_off_service`（事業所都合の休業）
- `trial`（体験利用）
- `short_stay_transfer`（短期入所連携で一時不在）
- `suspension`（利用一時停止）

運用ルールのメモ:

- 国保連 CSV 変換時は `status` → 「区分」「単位数」「加算/減算」への変換テーブルで対応。
- 日次 UI ではわかりやすいラベル（例: 「出席」「欠席（連絡あり）」）に翻訳して表示。
- enum を追加する際は、CSV マッピング表とセットで本ドキュメントを更新する。

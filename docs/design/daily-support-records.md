# Daily Support Records 設計メモ

## 1. ゴールと前提

- 通所当日の支援内容を時間帯・活動・本人の様子で記録し、監査・国保連・PDF への出口を持つ。
- Schedules（予定）→ Attendance（実績）→ Daily Support Records（中身）を一本の軸で管理する。
- Demo/SharePoint を切り替え可能にし、まずはフロント単体で検証できる。

前提:

- データソース: SharePoint リスト `SupportRecord_Daily`（`VITE_SP_LIST_DAILY` と同期）
- 代表ルート: `/daily/support`（router で TimeBased / TimeFlow ページをマウント済み）
- 開発導線: `npm run dev:daily` → `http://localhost:5177/daily/support`

---

## 2. ドメインモデル概要

- ベース型: `PersonDaily` / `AxisDaily` / `AnyDaily` (`src/domain/daily/types.ts`)
- 状態: `status` は `未作成` / `作成中` / `完了` を基本とし、`STATUS_SYNONYMS` で外部入力を正規化。
- ペイロード: `cr013_draftJson`（下書き）と `cr013_payload`（本データ）に JSON を保持。`safeStringify` で 60k 文字制限をガード。

---

## 3. SharePoint リスト `SupportRecord_Daily` 列マッピング

- 内部名は `src/domain/daily/spMap.ts` をソースオブトゥルースとし、ハードコード禁止。
- 主要列（内部名ベース）:

| 内部名 (SP) | 型 | 用途 / 備考 |
| --- | --- | --- |
| `Title` | text | 利用者名（fallback） |
| `cr013_personId` | text | 利用者ID（必須。Users_Master と突合） |
| `cr013_date` | date | 記録日（必須） |
| `cr013_status` | choice/text | `未作成` / `作成中` / `完了` 他シノニムを許容 |
| `cr013_reporterName` | text | 記録者表示名（無ければ Title を fallback） |
| `cr013_reporterId` | text | 記録者ID（任意） |
| `cr013_draftJson` | multiline text | 下書き JSON（サイズ制限あり） |
| `cr013_payload` | multiline text | 本データ JSON（サイズ制限あり） |
| `cr013_kind` | text | レコード種別（A/B）。A=時間帯ベース、B=チェックリスト系など |
| `cr013_group` | text | グループキー（例: 事業所コードやユニット） |
| `Modified` / `Created` / `Id` | 既定 | SP 既定列 |

### SupportRecord_Daily 列マッピング（cr013_* 詳細案）

| カテゴリ | SharePoint 内部名 | 型 | 用途・意味 |
| --- | --- | --- | --- |
| キー | `Id` | number | SP 標準 ID（主キー） |
| キー | `Title` | text | レコードタイトル（例: `I022-2025-07-02-05`）。`usercode + recorddate + rowno` を含むと衝突しにくい |
| キー | `cr013_usercode` | text | 利用者コード（Users_Master.UserCode と一致） |
| キー | `cr013_recorddate` | date | 記録日（Attendance / ScheduleEvents と同じ日付軸） |
| テンプレ | `cr013_rowno` | number | 1〜19 のテンプレ行番号（時間帯順） |
| テンプレ | `cr013_timeslot` | text | 時間帯ラベル（例: `9:30-10:00`）。ScheduleEvents と対応させる場合に使用 |
| テンプレ | `cr013_activity` | text | 活動内容テンプレ（TimeFlow 手順と整合） |
| テンプレ | `cr013_person_manual` | multiline | 本人のやること（参照専用） |
| テンプレ | `cr013_supporter_manual` | multiline | 支援者のやること（参照専用） |
| 記録 | `cr013_situation` | multiline | 当日の本人の様子（主要入力フィールド） |
| 記録 | `cr013_additionalinfo` | multiline | 補足（関わり方、気づき、翌日への引き継ぎ等） |
| 記録 | `cr013_specialnote` | multiline | 特記事項（事故/ヒヤリ/通院/行動障害など） |
| 記録 | `cr013_completed` | boolean | 行単位の完了フラグ（UI チェックボックス） |
| 記録 | `cr013_is_holiday` | boolean | 祝日/事業所休日フラグ（必要なら） |
| メタ | `Created` / `Author` | datetime / person | SP 既定（作成日時/作成者） |
| メタ | `Modified` / `Editor` | datetime / person | SP 既定（更新日時/更新者） |

---

## 4. Schedules / Attendance との関係

- Schedules: 予定の dayKey と `cr013_date` を突合し、予定がある利用者のみ記録対象にする運用を想定。
- Attendance: `AttendanceVisit` の有無で入力可否をガード（欠席日は新規作成を抑止する方針）。
- Reporter: `cr013_reporterName`/`Id` は MSAL のサインイン情報から埋める。

### 一貫性ルール（Schedules / Attendance / Daily）

1) 日付の一貫性

- `SupportRecord_Daily.cr013_recorddate` は Attendance の `attendanceDate` と一致させ、ScheduleEvents の日付（日単位）とも揃える。
- 異なる日付は別レコードとして扱い、混在させない。

1) 利用者コードの一貫性

- `cr013_usercode` は Users_Master.UserCode / Attendance.userCode / ScheduleEvents の対象利用者キーと一致させる。
- 「usercode + recorddate」で 1 日 1 人の軸が揃う前提を守る。

1) 行テンプレート（RowNo）の一意性

- `cr013_rowno` は 1〜19 の連番で、`usercode + recorddate + rowno` を 1 レコードに限定する。
- `cr013_timeslot` / `cr013_activity` は RowNo によって一意に決まる前提で管理し、重複を避ける。

1) Attendance 連動

- `status = absent_*` の日は Daily を新規作成しないか、展開済みなら `cr013_completed = false` のまま残してレポートで欠席扱いにする。
- `status = attended` の日は原則 19 行テンプレを揃え、自動展開フローがある場合は既存レコードの有無を確認してから Patch する。

1) Schedules 連動（将来拡張）

- ScheduleEvents の timeSlot と Daily の `cr013_timeslot` を 1:1 で対応させる場合、日付・利用者で突合し、時間帯更新時のずれを運用ルールで解消する。

1) エクスポート整合

- PDF/CSV は Attendance ありの日を基本対象とし、欠席日の Daily がある場合は `cr013_completed = false` をグレーアウト/非表示などで明示する。

---

## 5. 環境・起動

- 開発: `npm run dev:daily` → `http://localhost:5177/daily/support`
- 本番相当例:
  - `VITE_FORCE_SHAREPOINT=1`
  - `VITE_SKIP_LOGIN=0`
  - `VITE_SP_LIST_DAILY=SupportRecord_Daily`

---

## 6. テスト方針

- ミニ回帰: `npm run test:daily:mini`（`tests/unit/records.*.spec.ts`, `tests/unit/exportCsv.spec.ts`）
- 既存 UI テスト: `src/features/daily/__tests__/*.test.tsx`（必要に応じて追加）
- SP クライアント挙動: `tests/unit/spClient.*.spec.ts` で list/add エラーハンドリングを確認（SupportRecord_Daily も対象）

---

## 7. 国保連 / PDF への出口メモ

- 国保連 CSV では、`cr013_payload` 内の提供時間・活動コードを集計して単位数へ変換する想定。
- PDF/監査用は `cr013_payload` をレンダリングし、`cr013_reporterName` とタイムスタンプを明示する。
- 列追加時は `fields.ts` と本ドキュメントのマッピング表を同期すること。

---

## 8. 今後の拡張メモ

- A/B 以外の記録フォーム（例: 看護チェックリスト）を `cr013_kind` で拡張。
- Attendance の欠席ステータスと連動した「記録不要」ハンドリングを UI で提示。
- Activity テンプレートを Schedules のサービス種別や曜日パターンからプリセット生成する。

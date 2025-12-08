# Nurse モジュール設計メモ

> 対象: バイタル記録 / 投薬記録 / 緊急時対応メモ をタブレット中心で扱うモジュール  
> 目的: 現場の安全と監査対応を両立しつつ、看護職の負担を最小化する

## 1. ゴールと前提

- 生活介護における医療的ケア・服薬・バイタル記録を一元管理する。
- タブレット（横持ち）前提で **3タップ以内で主要操作** を完結させる UI。
- 「いつ / 誰に / 何を / どうした」を監査・事故検証に耐える粒度で残す。
- Users / Attendance / Daily と同様に **userCode を共通キー** とする。

## 2. 主要画面と責務（想定パス `/nurse` 起点）

- Nurse Dashboard: 本日バイタル・投薬リスト、未実施アラート、値逸脱警告。
- Vitals Page: SpO2 / 血圧 / HR / 体温 / 呼吸数入力、既往・留意事項参照。
- Medication Page: 定時薬・頓服薬の実施/スキップ、ダブルチェック者の記録。
- Emergency / Incident Notes: 急変時の初動記録（症状・対応・連絡先ログ）。

## 3. データモデル概要（例）

### Vitals

```ts
export type NurseVital = {
  id: string;
  userCode: string;
  recordedAt: string; // ISO
  bpSystolic?: number;
  bpDiastolic?: number;
  pulse?: number;
  spo2?: number;
  temperature?: number;
  respirationRate?: number;
  note?: string;
  recordedBy: string; // staff code or display name
};
```

### Medication

```ts
export type NurseMedicationRecord = {
  id: string;
  userCode: string;
  scheduledAt?: string;   // 予定時刻（任意）
  administeredAt: string; // 実施時刻
  drugName: string;
  dosage: string;
  route: 'oral' | 'iv' | 'sc' | 'inhalation' | 'other';
  status: 'given' | 'skipped' | 'held' | 'error';
  reason?: string;
  administeredBy: string;
  doubleCheckedBy?: string;
};
```

### Emergency / Incident

```ts
export type NurseIncidentNote = {
  id: string;
  userCode: string;
  occurredAt: string;
  summary: string;
  detail?: string;
  actionTaken?: string;
  contactDoctor?: string;
  contactFamily?: string;
  recordedBy: string;
};
```

> 実装上の型名・項目は `src/features/nurse` / `src/domain/nurse` に合わせて調整すること。

## 4. SharePoint リスト対応（叩き台）

実際のリスト名・列は `src/sharepoint/fields.ts` と運用設計をソースオブトゥルースにする。

| 用途 | リスト名（例） | 主キー | 主要列イメージ |
| --- | --- | --- | --- |
| バイタル | `Nurse_Vitals` | `Id` | `UserCode`, `RecordedAt`, `BP`, `HR`, `SpO2`, `Temperature`, `RecordedBy` |
| 投薬 | `Nurse_Medications` | `Id` | `UserCode`, `AdministeredAt`, `DrugName`, `Dosage`, `Route`, `Status`, `AdministeredBy`, `DoubleCheckedBy`, `Reason` |
| 緊急/事故 | `Nurse_Incidents` | `Id` | `UserCode`, `OccurredAt`, `Summary`, `Detail`, `ActionTaken`, `ContactDoctor`, `ContactFamily`, `RecordedBy` |

> 確定後は列マッピング表を追加し、ハードコードを避ける。

## 5. 関連モジュールとの関係

- Users: `userCode` を共有し、氏名・基礎情報を参照。
- Attendance: 当日通所中の利用者に絞ったビューを提供する。
- Daily Support Records: 体調メモや重度加算と連携し、支援記録に医療的背景を付与。

## 6. 環境・開発フロー

- 開発ショートカット: `npm run dev:nurse`（5179, `VITE_SKIP_LOGIN=1`, `VITE_FORCE_SHAREPOINT=0`）。
- mini テスト: `npm run test:nurse:mini`（`tests/unit/nurse*.spec.*`, `tests/unit/**/nurse*.spec.*`）。

## 7. テスト方針（概要）

- 単体: バイタルロジック（異常値判定、変換）、投薬ロジック（予定 vs 実績、ステータス遷移）、緊急メモ必須チェック、キュー/同期処理。
- E2E（将来）: Nurse Dashboard レンダリング、バイタル入力→保存→一覧反映、投薬スキップと理由入力、アラート表示。

## 8. 今後の拡張

- 30日分グラフ（BP/SpO2）。
- 投薬アラート（予定時刻超過の通知）。
- 事故・ヒヤリハットとの自動ひも付け。

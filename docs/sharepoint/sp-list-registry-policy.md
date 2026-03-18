# SharePoint リスト管理ポリシー — SSOT 運用ルール

> **対象読者**: 開発者・本番前整備担当者  
> **最終更新**: 2026-03-18  
> **関連ファイル**: `src/sharepoint/fields/listRegistry.ts`, `src/sharepoint/spListRegistry.ts`, `scripts/sp-preprod/lists.manifest.json`

---

## 1. 基本原則：3-tier SSOT

SP リスト名・フィールド内部名の **唯一の正** はコードの以下3層です。
この順序で管理し、manifest・スクリプト・Power Automate はここを参照します。

```
ListKeys (enum)
    ↓
LIST_CONFIG (title マッピング)
    ↓
FIELD_MAP / *_FIELDS (フィールド内部名)
    ↓
  manifest / provision スクリプト / Power Automate フロー
```

**manifest や provision スクリプトを正として扱わないこと。**  
manifest はコードから派生する成果物であり、コードが正です。

---

## 2. 変更記録（2026-03-18 本番前整備）

### 2-A. `Schedules` を正式登録

**問題**: `scheduleFields.ts` に実装があるにもかかわらず、`ListKeys` / `LIST_CONFIG` / `spListRegistry` に未登録だった。

**影響**: `spListRegistry` の `schedule_events` エントリが文字列リテラル `'Schedules'` を直接ハードコードしており、rename 時に LIST_CONFIG と乖離するリスクがあった。

**修正内容**:

```typescript
// src/sharepoint/fields/listRegistry.ts
export enum ListKeys {
  // ...
  Schedules = 'Schedules',  // ← 追加（登録漏れ修正）
}

export const LIST_CONFIG: Record<ListKeys, { title: string }> = {
  // ...
  [ListKeys.Schedules]: { title: 'Schedules' },  // ← 追加
};
```

```typescript
// src/sharepoint/spListRegistry.ts
{
  key: 'schedule_events',
  resolve: () => envOr('VITE_SP_LIST_SCHEDULES', fromConfig(ListKeys.Schedules)),  // ← fromConfig に変更
  // ...
}
```

---

### 2-B. `support_record_daily` の架空名 `SupportRecord_Daily` を除去

**問題**: `spListRegistry` の `support_record_daily` エントリが、`ListKeys` に存在しない `'SupportRecord_Daily'` をフォールバックとしてハードコードしていた。

```typescript
// ❌ 修正前（架空名）
resolve: () => envOr('VITE_SP_LIST_DAILY', 'SupportRecord_Daily'),

// ✅ 修正後（ListKeys の実名を参照）
resolve: () => envOr('VITE_SP_LIST_PROCEDURE_RECORD', fromConfig(ListKeys.ProcedureRecordDaily)),
```

**背景**: この `SupportRecord_Daily` はツールキット生成時の架空名で、実際のシステムでは `SupportProcedureRecord_Daily`（ISP三層モデルの第3層）が対応リストです。

**日次系の2リストの役割分担**:

| リスト名 | ListKey | 用途 |
|---|---|---|
| `DailyActivityRecords` | `DailyActivityRecords` | タイムスライス単位の活動観察記録（observation/behavior/intensity） |
| `SupportProcedureRecord_Daily` | `ProcedureRecordDaily` | 支援手順書兼記録（ISP三層モデル第3層・PlanningSheet連携） |

---

## 3. 本番前 manifest 管理ルール

### 含めるリスト（必須条件）

manifest に含めるリストは **以下を全て満たすもの** に限定します。

- [ ] `ListKeys` に登録済み
- [ ] `LIST_CONFIG` に title マッピングあり
- [ ] 対応する `FIELD_MAP` または `*_FIELDS` が `src/sharepoint/fields/` に存在
- [ ] `spListRegistry` の `SP_LIST_REGISTRY` に `key` エントリあり

### 除外するリスト

以下のいずれかに該当する場合は **manifest から除外し `_excluded` セクションに記録** します。

- `ListKeys` 未登録
- Repository（Adapter / Repository クラス）が未実装
- `FIELD_MAP` 未定義
- 運用ルール未確定

### 除外リストの記録例

```json
"_excluded": {
  "_reason": "コードに ListKeys / FIELD_MAP / Repository 実装が存在しないため、今回の本番前対象から除外",
  "lists": ["Inquiries", "CoffeeOrderHistory", "MonthlyCoffeeBilling"]
}
```

> **除外は削除ではありません。** 将来実装する際に「意図して除外した」判断が残るよう必ず記録してください。

---

## 4. 新規リスト追加の手順

SP に新しいリストを追加する際は、**必ずコードを先に更新** してから manifest に追加します。

```
1. src/sharepoint/fields/<domain>Fields.ts に FIELD_MAP を定義
2. src/sharepoint/fields/listRegistry.ts の ListKeys enum に追加
3. src/sharepoint/fields/listRegistry.ts の LIST_CONFIG に追加
4. src/sharepoint/fields/index.ts からバレル re-export
5. src/sharepoint/spListRegistry.ts の SP_LIST_REGISTRY に SpListEntry 追加
6. scripts/sp-preprod/lists.manifest.json に追加
7. audit → dry run → provision
```

> ステップ 6 がステップ 1-5 より先になってはいけません。

---

## 5. よくある事故パターン

### パターン A: 文字列リテラルの直打ち

```typescript
// ❌ 危険 — rename 時に LIST_CONFIG と乖離する
resolve: () => 'SupportRecord_Daily'

// ✅ 安全 — SSOT を参照
resolve: () => fromConfig(ListKeys.ProcedureRecordDaily)
```

### パターン B: manifest をコードより先に更新する

未実装のリストを manifest に追加して provision すると、
「SP には存在するが、アプリのどこからも参照されない」リストが生まれます。
これは後の監査で判断が難しくなる負債です。

### パターン C: ListKeys 未登録のまま実装する

`scheduleFields.ts` のように FIELD_MAP だけあって `ListKeys` に未登録の状態は、
`LIST_CONFIG` 型チェック（`Record<ListKeys, ...>`）の恩恵を受けられません。
新規実装時は必ず `ListKeys` → `LIST_CONFIG` → FIELD_MAP の順で揃えてください。

---

## 6. 関連ドキュメント

- [support-plan-three-layer-lists.md](./support-plan-three-layer-lists.md) — ISP三層モデル（ISP_Master / SupportPlanningSheet_Master / SupportProcedureRecord_Daily）
- [iceberg-pdca-list-schema.md](./iceberg-pdca-list-schema.md) — 氷山モデル列スキーマ
- `scripts/sp-preprod/lists.manifest.json` — 本番前監査 manifest（現物ベース）

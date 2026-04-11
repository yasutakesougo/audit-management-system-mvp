# SP ヘルス診断 管理者向け Runbook

**対象ページ**: `/admin/status`（管理者専用）  
**診断実装**: `src/features/diagnostics/health/checks.ts`  
**最終更新**: 2026-04-11

---

## WARN / FAIL 契約

### 判定基準

| 状態 | 条件 | アプリ継続可否 | 管理者アクション |
|------|------|--------------|----------------|
| **PASS** | 全期待列が物理名と一致 / 権限確認済み | ✅ 正常 | 不要 |
| **WARN (drift)** | 列名にサフィックスが自動付与（例: `FullName0`） | ✅ candidates で吸収済み | 任意: 重複列の削除を検討 |
| **WARN (optional)** | オプション列が欠落 | ✅ 代替解決ロジック適用 | 任意: Provision 再実行 |
| **WARN (delete)** | Delete 権限なし | ✅ 読み書きは正常 | 運用方針を確認 |
| **FAIL (essential)** | 必須列が存在しない | ❌ リスト読み書き不能 | **Provision 再実行**（下記手順） |
| **FAIL (read)** | Read 権限なし | ❌ データ取得不能 | **権限を付与**（下記手順） |
| **FAIL (create/update)** | Create/Update 権限なし | ❌ 書き込み不能 | **権限を付与**（下記手順） |
| **FAIL (list missing)** | リスト自体が存在しない | ❌ 全機能停止 | **Provision を実行**（下記手順） |

### FAIL と WARN の違い

- **FAIL = 管理者対応が必要**。アプリは当該機能を使用できない状態です。
- **WARN = アプリは動作継続中**。対応は推奨だが緊急ではありません。

WARN は「システムが drift を吸収している証拠」であり、正常な運用状態の一部です。

---

## FAIL 発生時の対応手順

### ケース 1: 必須列が不足している (`schema.fields.*` が FAIL)

```
nextAction に表示される列名を確認 → Provision を再実行
```

**手順:**
1. `/admin/status` の FAIL カードで「不足している列名」を確認する
2. SharePoint 管理センターで対象リストを開き、列が存在するか確認する
3. 存在しない場合: アプリの Provision 機能を実行する（`/admin/provision` または開発者に依頼）
4. 再度 `/admin/status` を開き、PASS に変わったことを確認する

**補足**: SharePoint の列数上限（8KB 行サイズ / インデックス20件）に達している場合、
Provision は警告を出しつつ部分成功します。その場合は不要な列の削除が必要です。

---

### ケース 2: Read/Create/Update 権限がない (`permissions.*` が FAIL)

```
nextAction に表示されるリスト名を確認 → SharePoint で権限を付与
```

**手順:**
1. FAIL カードの `nextAction` に表示されているリスト名を確認する
2. SharePoint 管理センター > サイト > コンテンツ > 対象リスト に移動する
3. 「アクセス許可の管理」を開き、アプリの実行ユーザー（またはグループ）に適切な権限を付与する
   - Read FAIL → 閲覧以上の権限を付与
   - Create FAIL → 投稿以上の権限を付与
   - Update FAIL → 投稿以上の権限を付与
4. 再度 `/admin/status` を開き、PASS に変わったことを確認する

### 現在発生中の FAIL 項目と対応方法

現在 `/admin/status` で検出されている致命的エラー（FAIL）の棚卸し結果です。管理者はこれらを解消してください。

| カテゴリ | 対象リスト | 具体的なエラー内容 | 対応アクション (nextActions) | 難易度 |
|---------|----------|-----------------|---------------------------|-------|
| **Create** | `利用者マスタ` | 作成（Create）権限不足 | **「投稿」以上の権限を付与**してください。 | 低 |
| **Read** | `監査チェックルール` | 閲覧（Read）権限不足 | **「閲覧」以上の権限を付与**してください。 | 低 |
| **Schema** | `利用者支給量プロファイル` | `RecipientCertNumber` の欠落 | **共通 Provision 機能を実行**するか、当該列を追加してください。 | 中 |

---

### ケース 3: リストが存在しない (`lists.exists.*` が FAIL)

```
Provision を実行してリストを作成する
```

**手順:**
1. FAIL カードでリスト名を確認する
2. Provision 機能を実行する（開発者または IT 担当者に依頼）
3. Provision 後、再度 `/admin/status` で PASS を確認する

---

## WARN 発生時の推奨アクション

### WARN (drift) — 列名サフィックス

```
例: "FullName -> FullName0" のようなドリフトが検出された
```

**背景**: SharePoint は列名が重複する場合、自動的にサフィックス（0, 1 ...）を付与します。
アプリは `candidates` による代替解決で動作を継続しています。

**推奨対応（緊急ではない）:**
1. 対象リストで数字サフィックス付き列（`FullName0` など）を確認する
2. 旧列（サフィックスなし）が不要であれば削除を検討する
3. 削除後、`/admin/status` で PASS に変わったことを確認する

> ⚠️ 列削除はデータ損失リスクがあります。削除前に列に値が入っていないことを確認してください。

### WARN (optional missing) — オプション列の欠落

アプリの基本機能には影響しません。必要に応じて Provision を再実行してオプション列を追加できます。

### WARN / 500 (DriftEventsLog threshold) — 監視ログ読み取りの退避動作

```
DriftEventsLog の期間フィルタ付き読み取りが list view threshold で失敗した
```

**現在のアプリ動作:**
1. まず通常クエリで取得を試みます
   - `DetectedAt desc`
   - `since / resolved / listName` フィルタ付き
2. これが SharePoint の `list view threshold` で 500 失敗した場合、アプリは自動的に退避クエリへ切り替えます
   - `Id desc`
   - フィルタなしで直近の一部件数を取得
3. 取得後、アプリ側で `since / resolved / listName` を再適用します

**重要な意味合い:**
- これは **根本解決ではなく可用性確保のための退避動作** です
- `/admin/status` や Drift observability は継続利用できる場合があります
- ただし SharePoint 側の件数増加やインデックス未整備は解消されません

**管理者・運用者が理解しておくこと:**
- 画面が表示できても、`DriftEventsLog` の健全性が回復したわけではありません
- 退避クエリは `Id desc` ベースのため、取得件数上限を超える古いイベントは観測対象外になります
- 観測窓が不足すると、古い drift 事象や低頻度イベントを取りこぼす可能性があります

**推奨対応:**
1. `DriftEventsLog` の `DetectedAt` または運用で使用する日時列にインデックスが作成されているか確認する
2. リスト件数が増えすぎている場合は、古いログのアーカイブまたはパージを検討する
3. threshold 500 が継続する場合は、取得件数上限で必要観測期間を満たせているか開発者と確認する

---

## 診断の読み方

### カテゴリ別チェック項目

| カテゴリ | チェック内容 |
|---------|------------|
| `config` | 環境変数の設定・テンプレ値の残存 |
| `auth` | MSAL サインイン状態 |
| `connectivity` | SharePoint サイトへの到達確認 |
| `lists` | 各リストの存在確認 |
| `schema` | 必須列・オプション列の物理名照合 |
| `permissions` | Read / Create / Update / Delete 権限テスト |

### 診断結果の集計

`toAdminSummary` により以下の形式でサマリーが生成されます:

```
PASS: XX件 / WARN: XX件 / FAIL: XX件

【管理者対応手順】
1. [リスト名] — Create 権限がありません。SharePoint で権限を付与してください。
2. [リスト名] — 必須列が不足しています。Provision を再実行してください。
```

FAIL が 0 件であれば、すべての機能が正常に動作しています。

---

## 横展開パターン（新リストを drift 耐性化する場合）

drift 候補が未設定のリストは、drift 発生時に FAIL 誤報が出る可能性があります。
新しいリストに drift 耐性を追加する手順:

```
1. src/sharepoint/fields/<domain>Fields.ts
   export const <DOMAIN>_CANDIDATES: Record<string, string[]> = {
     conceptualKey: ['primaryName', 'alternateName0', 'legacyName'],
     ...
   };
   export const <DOMAIN>_ESSENTIALS: string[] = ['primaryKey1', 'primaryKey2'];

2. src/pages/HealthPage.tsx の DRIFT_CANDIDATES_BY_KEY に追加:
   <list_key>: (() => {
     const map: Record<string, string[]> = {};
     for (const cands of Object.values(<DOMAIN>_CANDIDATES)) {
       map[cands[0]] = [...cands];
     }
     return map;
   })(),

3. src/sharepoint/fields/__tests__/<domain>Fields.drift.spec.ts を作成:
   - 正規名ヒット → PASS
   - サフィックスドリフトヒット → WARN (resolved)
   - essential 欠落 → FAIL
   - optional 欠落 → WARN (missing optional)

4. spListRegistry.ts の essentialFields を *_ESSENTIALS と一致させる
```

### 未対応リスト（横展開候補 — 優先順）

**高優先（required + W操作）** — drift 発生時に FAIL 誤報が出る可能性あり

| キー | displayName | essentialFields |
|------|-------------|-----------------|
| `user_benefit_profile` | 利用者支給量プロファイル | UserID, RecipientCertNumber |
| `daily_activity_records` | 日次活動記録 | UserCode, RecordDate, TimeSlot, Observation |
| `daily_attendance` | 日次出欠 | UserID, Date, Status |
| `schedule_events` | スケジュール | Title, EventDate, EndDate |
| `meeting_minutes` | 議事録 | MeetingDate, Category |
| `handoff` | 引き継ぎ | Message, UserCode, Category |
| `support_plans` | 個別支援計画 | DraftId, UserCode, FormDataJson |
| `isp_master` | 個別支援計画（ISP） | UserCode, PlanStartDate, Status |

**低優先（optional または R のみ）** — drift リスクが低い

| キー | displayName | 理由 |
|------|-------------|------|
| `org_master` | 組織マスタ | required + R のみ。drift しても読み取りは candidates なしで対応可 |
| `compliance_check_rules` | 監査チェックルール | optional + R。権限 FAIL 対応を先に行う |
| `billing_orders` | 請求オーダー | optional + R のみ |
| `nurse_observations` | 看護観察 | optional + R+W。利用頻度確認後 |
| `meeting_sessions` / `meeting_steps` | 会議セッション/ステップ | optional |
| `support_templates` | 支援手順テンプレート | required + R のみ |

---

## 関連ドキュメント

- [HANDOFF.md](../../HANDOFF.md) — フェーズ完了と残件のサマリー
- [ADR 005](../adr/ADR_005_SharePoint_Self_Healing_Stabilization.md) — Self-Healing 設計判断の記録
- [provision/README.md](../../provision/README.md) — Provision 手順
- [src/features/diagnostics/health/checks.ts](../../src/features/diagnostics/health/checks.ts) — 判定ロジックの実装

# PDCA Cycle Record — 正式定義書

> 2026-03-16 策定

## 1. 目的

`PdcaCycleRecord` は、Ops Dashboard の **PDCA 完走率** を計算するための
入力レコードです。

1 レコード = 1 利用者 × 1 モニタリングサイクル（通常 90 日）

本文書は以下を定義します:

- 各フィールドの意味と採用規則
- データソースごとの導出規則
- 運用上の注意点

## 2. PdcaCycleRecord — 正式定義

```typescript
interface PdcaCycleRecord {
  /** ユニーク ID: '{userId}-cycle-{round}' */
  cycleId: string;
  /** 対象利用者 ID */
  userId: string;
  /** サイクル開始日 */
  startedAt: string;
  /** モニタリング期限 */
  dueAt: string;
  /** 提案が採用された日時 */
  proposalAcceptedAt?: string | null;
  /** モニタリング予定日 */
  reviewScheduledAt?: string | null;
  /** モニタリング実施完了日 */
  reviewCompletedAt?: string | null;
  /** 支援計画が正式更新された日時 */
  planUpdatedAt?: string | null;
}
```

## 3. フィールド別 採用規則

### `startedAt` — サイクル開始日

| 候補 | 採用 | 理由 |
|------|------|------|
| **モニタリングスケジュール起点** | ✅ 採用 | 制度上のサイクルに一致する |
| ISP 作成日 | ❌ | ISP 作成は複数回ありえるため不安定 |
| 提案採用日 | ❌ | 提案が来ない利用者のサイクルが始まらない |

**導出元:** `appliedFrom`（支援開始日）+ `(round - 1) × cycleDays`

**根拠:** 障害者総合支援法施行規則 第26条の2:
「少なくとも3か月に1回以上、モニタリングを行う」

### `dueAt` — モニタリング期限

`startedAt + cycleDays` で算出。

デフォルト `cycleDays = 90`。

### `proposalAcceptedAt` — 提案採用日

**データソース:** `SuggestionAction` の `accept` 記録の `timestamp`

採用規則:
- 1 サイクル期間内に複数の accept がある場合、**最初の accept** を使う
- accept がない場合は `null`

### `reviewScheduledAt` — モニタリング予定日

**データソース:** `computeMonitoringSchedule()` の `nextDueDate`

採用規則:
- 各サイクルの `dueDate` をそのまま使用

### `reviewCompletedAt` — モニタリング実施完了日

**データソース:** `lastMonitoredAt` または `reviewedAt`

採用規則:
- `reviewedAt` があればそちらを優先
- `lastMonitoredAt` のみの場合はそれを使う
- どちらもなければ `null`

### `planUpdatedAt` — 支援計画 正式更新日

**これが最も重要なフィールドです。**

| 候補 | 採用 | 理由 |
|------|------|------|
| **正式反映時刻** | ✅ 採用 | 下書きを完了扱いにすると未確定が回ったと見える |
| 下書き保存時刻 | ❌ | PDCA「完走」の定義からずれる |
| 単純な SP 更新日列 | ❌ | 軽微修正でも動くため汚れやすい |

**導出元の優先順位:**

1. ISP の `confirmedAt`（明示的な確定列） ← 理想
2. SharePoint バージョン履歴のうち「正式版」マーク付き ← 次善
3. `Modified` 列（最終手段）

**当面の実装方針:**
Phase 1 では Planning Sheet の保存タイミング（`savedAt`）を使用。
Phase 2 で SharePoint の確定列を追加し切り替える。

## 4. データソース別 導出規則

### localStorage（Phase 1）

```
SuggestionAction[]         → proposalAcceptedAt
  key: daily-record-*
  filter: action === 'accept'
  take: first per cycle period

calculateMonitoringSchedule()  → startedAt, dueAt, reviewScheduledAt
  input: supportStartDate, cycleDays

planningSheet.savedAt      → planUpdatedAt (暫定)
  key: planning-sheet-*
```

### SharePoint（Phase 2+）

```
ISP List Item              → planUpdatedAt (confirmedAt 列)
SP Version History         → planUpdatedAt (version-based)
Monitoring Log             → reviewCompletedAt
```

### Firestore（将来）

```
telemetry / adoption-log   → proposalAcceptedAt (精度向上)
```

## 5. サイクル ID の命名規則

```
{userId}-cycle-{round}
```

例:
- `user-A-cycle-1`: user-A の第 1 サイクル（支援開始〜90 日目）
- `user-A-cycle-2`: user-A の第 2 サイクル（91 日目〜180 日目）

## 6. 完走判定

サイクルは以下の **両方** が満たされた時に `completed` と判定:

1. `reviewCompletedAt` が非 null
2. `planUpdatedAt` が非 null

片方だけでは `completed` にならない。

| reviewCompletedAt | planUpdatedAt | 判定 |
|-------------------|---------------|------|
| あり | あり | ✅ completed |
| あり | なし | in_progress / overdue |
| なし | あり | in_progress / overdue |
| なし | なし | in_progress / overdue |

## 7. 将来の拡張

- `draftSavedAt`: 下書き保存日（planUpdatedAt とは別管理）
- `source`: レコードの由来（`'schedule'` / `'planning-sheet'` / `'derived'`）
- `staffId`: 担当職員 ID
- `notes`: 備考

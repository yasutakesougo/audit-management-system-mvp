# ibdStore 責務棚卸し — Phase 2

> 作成日: 2026-04-13
> 参照: ADR-005, feedback_isp_ibd_design_boundary.md

## 目的

`ibdStore`（`src/features/ibd/core/ibdStore.ts`）が担っている責務を一覧化し、
各責務の配置先（Shadow Model に残す / domain に移植 / 既存に吸収）を判定する。

---

## 責務一覧と配置判定

### 1. SPS CRUD（addSPS / updateSPS / removeSPS / confirmSPS / reviseSPS）

| 項目 | 内容 |
|---|---|
| 現在の場所 | `ibdStore` — Zustand setState で in-memory 管理 |
| 永続化 | なし（メモリのみ） |
| 判定 | **domain/repository に移植** |
| 移植先 | `PlanningSheetRepository` port（`domain/isp/`） |
| 理由 | SPS は SSOT。CRUD は永続化を伴う正本操作であり Shadow Model の責務ではない |
| 優先順 | 3（ロードマップ Phase 3） |

### 2. 90日アラート（getExpiringSPSAlerts / daysUntilSPSReview / getSPSAlertLevel）

| 項目 | 内容 |
|---|---|
| 現在の場所 | `ibdStore` + `ibdTypes`（純関数） |
| domain 側の既存 | `auditChecks.getReviewOverdueRisk()` — 期限超過のみ判定（`diffDays < 0`） |
| 判定 | **既存 regulatory/audit に吸収** |
| 吸収先 | `domain/regulatory/auditChecks.ts` の `getReviewOverdueRisk` を拡張し、warning 閾値（14日前〜）も対応 |
| 理由 | 見直し期限管理は監査判定ロジック。domain 側にすでに同種の関数がある。二重実装の整理 |
| 優先順 | **1（最優先）** |

### 3. 観察カウンター（SupervisionCounter / incrementSupportCount / resetSupportCount）

| 項目 | 内容 |
|---|---|
| 現在の場所 | `ibdStore` — Zustand state + 操作関数 |
| 永続化 | なし（メモリのみ） |
| 判定 | **新 domain port/repository に移植** |
| 移植先 | `domain/ibd/supervisionTracking.ts`（新設） + repository port |
| 理由 | 「2回に1回以上の観察義務」は制度要件。算定判定に関わるため domain に属する |
| 優先順 | 4 |

### 4. 観察ログ CRUD（addSupervisionLog / getSupervisionLogsForUser）

| 項目 | 内容 |
|---|---|
| 現在の場所 | `ibdStore` |
| 判定 | **観察カウンターと同時に domain に移植** |
| 移植先 | `domain/ibd/supervisionTracking.ts` + repository port |
| 理由 | 観察カウンターと密結合。制度上の観察義務追跡の一部 |
| 優先順 | 4（観察カウンターと同一 PR） |

### 5. ABC記録 CRUD（addABCRecord / getABCRecordsForUser / getAllABCRecords）

| 項目 | 内容 |
|---|---|
| 現在の場所 | `ibdStore` |
| domain 側の既存 | `domain/behavior/abc.ts` — ABCRecord 型は SSOT として存在済み |
| 判定 | **domain/behavior + repository に移植** |
| 移植先 | `domain/behavior/` に repository port 追加 |
| 理由 | 型は domain に SSOT 化済み。CRUD 操作もそこに寄せる |
| 優先順 | 5 |

### 6. SPS確定権限（canConfirmSPS）

| 項目 | 内容 |
|---|---|
| 現在の場所 | `ibdStore`（純関数、ストア非依存） |
| domain 側の既存 | `staffQualificationProfile.ts` — `hasPracticalTraining` フラグ管理済み |
| 判定 | **既存 staffQualificationProfile に吸収** |
| 吸収先 | `domain/regulatory/staffQualificationProfile.ts` に `canConfirmSPS()` を移動 |
| 理由 | 確定権限は資格判定ロジック。すでに同モジュールに研修修了フラグがある |
| 優先順 | **2** |

### 7. 観察義務アラート（getSupervisionAlertLevel / getSupervisionAlertMessage）

| 項目 | 内容 |
|---|---|
| 現在の場所 | `ibdStore`（純関数、ストア非依存） |
| 判定 | **観察カウンターと同時に domain に移植** |
| 移植先 | `domain/ibd/supervisionTracking.ts` |
| 理由 | 制度要件（2回に1回）の判定ロジック |
| 優先順 | 4（観察カウンターと同一 PR） |

### 8. SPS クエリ（getAllSPS / getSPSForUser / getLatestSPS）

| 項目 | 内容 |
|---|---|
| 現在の場所 | `ibdStore` |
| 判定 | **SPS CRUD と同時に repository に移植** |
| 優先順 | 3（CRUD と同一 PR） |

### 9. SPS 改訂履歴クエリ（getSPSHistory / getSPSHistoryForUser）

| 項目 | 内容 |
|---|---|
| 現在の場所 | `ibdStore` |
| 判定 | **SPS CRUD と同時に repository に移植** |
| 優先順 | 3（CRUD と同一 PR） |

---

## Shadow Model に残すもの

以下は UI 思考補助の責務であり、`ibdStore` / `ibdTypes` に残す。

| 責務 | ファイル | 理由 |
|---|---|---|
| `IcebergModel` 型・分析ロジック | `ibdTypes.ts` | 氷山モデルは UI 上の思考補助ツール |
| `SupportScene` / 場面別支援定義 | `ibdTypes.ts` | UI 表示・ナビゲーション用の構造化データ |
| カラーカード体系（`SupportCategory`） | `ibdTypes.ts` | UI 表示用の分類・色定義 |
| `PDCA_RECOMMENDATION_LABELS` 等の定数 | `ibdTypes.ts` | UI ラベル |
| `ABCSummary` / `calculateABCSummary` | `ibdTypes.ts` | UI 上の集計可視化。domain の ABCRecord を入力として使う |
| `ALTERNATIVE_BEHAVIOR_RECOMMENDATIONS` | `ibdTypes.ts` | UI 上の推奨表示プリセット |
| `icebergStore` | `icebergStore.ts` | 氷山分析の UI ステート管理 |

---

## Phase 3 移植順序（確定）

| 順番 | 責務 | 移植先 | PR 粒度 |
|---|---|---|---|
| 1 | 90日アラート | `auditChecks.getReviewOverdueRisk` 拡張 | 1 PR |
| 2 | SPS確定権限 | `staffQualificationProfile` | 1 PR |
| 3 | SPS CRUD + クエリ + 改訂履歴 | `PlanningSheetRepository` port | 1 PR |
| 4 | 観察カウンター + 観察ログ + 観察アラート | `domain/ibd/supervisionTracking` | 1 PR |
| 5 | ABC記録 CRUD | `domain/behavior/` + repository port | 1 PR |

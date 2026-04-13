# Behavior Repository 接点棚卸し（Phase 3-5 後）

> 作成日: 2026-04-13  
> 目的: 日次側 `behaviorRepository` 系導線と、Phase 3-5 で移植した ABC 証跡導線の接点を整理し、即時統合せずに次段判断材料を固定する

---

## 1. 現在の導線（3系統）

| 系統 | ドメイン型 | Port / 契約 | 主実装 | 主な呼出元 | 備考 |
|---|---|---|---|---|---|
| A: Daily 行動記録 | `domain/behavior.ABCRecord` | `features/daily/domain/BehaviorRepository` | `InMemoryBehaviorRepository` / `SharePointBehaviorRepository` | `useTimeBasedSupportPage` の `handleRecordSubmit` | 非同期 API (`Promise`)。日次画面の主導線 |
| B: IBD ABC証跡（Phase 3-5） | `domain/behavior.ABCRecord` | `domain/behavior/port.ts` `BehaviorObservationRepository` | `localBehaviorObservationRepository` | `ibdStore.addABCRecord/getABCRecordsForUser` | 同期 API。IBD 補助導線からの証跡保持 |
| C: ABC専用ページ証跡 | `domain/abc.AbcRecord` | `domain/abc/abcRecord.ts` `AbcRecordRepository` | `localAbcRecordRepository` | `/abc-record`、一部 planning/ibd 分析 UI | 別ドメイン型（`occurredAt` など）で独立運用 |

---

## 2. 主要接点（読取/書込の交点）

### 2.1 日次画面（`/daily/support`）

- 書込: A 系統（`behaviorRepo.add`）
  - `src/features/daily/hooks/useTimeBasedSupportPage.ts`
  - `src/features/daily/hooks/orchestrators/useTimeBasedSupportPage.ts`
- 読取（IBDサマリ表示・戦略初期値）: B 系統（`ibdStore.getABCRecordsForUser`）
  - 同ファイル内 `todayAbcCount` 計算、`useDefaultStrategies`

判定:
- 同一画面内で A 書込 / B 読取の分離があり、将来の表示不整合ポイントになり得る

### 2.2 モニタリング下書き生成

- `useMeetingEvidenceDraft` は B 系統（`ibdStore.getABCRecordsForUser`）を参照
- 日次本流の A 系統との直結はない

判定:
- 会議下書きに参照される ABC ソースと日次画面の保存ソースが常に一致する保証は未定義

### 2.3 ABC専用ページ / 証跡参照UI

- `/abc-record` や planning/ibd の一部証跡 UI は C 系統（`localAbcRecordRepository`）を参照
- B 系統とは型も保存キーも別

判定:
- ABC 証跡は A/B/C の複線状態。統合前に「用途別の正本」を定義する必要がある

---

## 3. 契約差分（統合前に固定すべき論点）

| 観点 | A / B（`domain/behavior.ABCRecord`） | C（`domain/abc.AbcRecord`） |
|---|---|---|
| 時刻項目 | `recordedAt` | `occurredAt` + `createdAt` |
| 強度 | `1..5` | `'low' | 'medium' | 'high'` |
| 文脈 | `antecedentTags`, `estimatedFunction`, `planSlotKey` 等 | `setting`, `riskFlag`, `sourceContext` 等 |
| API形態 | A: async, B: sync | async |
| 主用途 | 日次入力・IBD補助 | 証跡管理/閲覧中心 |

---

## 4. 直近方針（推奨: 統合前の整理フェーズ）

1. 用途別に「どこを正本とするか」を宣言する  
`daily入力`, `ibdサマリ`, `monitoring引用`, `abc専用台帳` ごとに正本を 1 つに固定。

2. 画面単位で書込先/読取先の一致を確認する  
同一ユースケースで A 書込 / B 読取のような分離がある箇所を優先して洗い出す。

3. 型統合は保留し、まず契約マッピング表を作る  
`ABCRecord` ↔ `AbcRecord` は当面 adapter で吸収し、直接統合は次段判断に回す。

4. 1PR 1導線で接続を寄せる  
例: `/daily/support` の today count 参照先統一、`useMeetingEvidenceDraft` の参照元統一、などを個別に進める。

---

## 5. 正本命名（当面）

- **B（`BehaviorObservationRepository`）を正本導線として扱う**
- **A（Daily `BehaviorRepository`）は移行中の書込導線として扱う**
- A からの保存時は B に同期し、読取系（件数表示・会議下書き）は B を基準にそろえる

---

## 6. A→B 同期失敗ポリシー（最小）

- A 保存成功・B 同期失敗でも、**submit 全体は成功扱い**にする
- B 同期失敗は warning として `localStorage` に記録する
  - key: `daily-support.abc-sync-failures.v1`
  - 格納情報: `id`, `userId`, `recordedAt`, `occurredAt`, `error`
- UI メッセージは「保存成功 + 同期警告」を表示し、運用フロー（CHECK遷移）は止めない

---

## 7. 読取導線の統合状況 (2026-04-13)

読取導線の Path-B（`BehaviorObservationRepository` / `ibdStore`）への統合が全面完了。

- [x] **`useUserAlerts`**: B正本化完了。
- [x] **`strategy usage`**: 取得元を B に移行完了。
- [x] **`useDefaultStrategies`**: 取得元を B に移行完了。
- [x] **`action-engine`**: `useAllCorrectiveActions` の取得元を B に移行完了。
- [x] **`Analysis Dashboard`**: `behaviorStore` の取得元を B に移行完了。
- [x] **`Daily Support` (History)**: `behaviorStore` の取得元を B に移行完了。

---

## 8. 今回の結論

- Phase 3-5 で移植した B 系統（`BehaviorObservationRepository`）は、**ABC 証跡を Shadow から切り離す第一段として妥当**。
- ただし現時点は A/B/C の複線構造であり、次段は「統合実装」より先に **接点の正本定義と読書込整合の固定** を行う。

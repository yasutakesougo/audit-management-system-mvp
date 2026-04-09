# ADR-019: Signal Lifecycle & Acknowledgement

## Status
Accepted

## Context

ADR-017 (Role-Based Visibility) と ADR-018 (Signal Ownership) により、シグナルは「誰に見えるか」「誰の責任か」を持つようになった。

しかし、現状には次のギャップがある：

### ギャップ①: Dismiss ≠ Acknowledge

現在の `useExceptionPreferences` (localStorage) が提供するのは以下の2操作のみ：

| 操作 | 意味 | 永続化 |
|------|------|--------|
| `dismiss` | "見たくない" (主観的・個人的) | localStorage（per-user, per-device） |
| `snooze` | "後で見る" (個人的な先送り) | localStorage（per-user, per-device） |

チームに必要なのは：

| 操作 | 意味 | 永続化 |
|------|------|--------|
| `acknowledge` | "私が対応中" (客観的・共有状態) | 共有ストレージ（全ユーザーに見える） |

### ギャップ②: Resolved は自動か手動か

シグナルの「解消」には2種類ある：

- **自動解消**: 根本原因が解決されると derived signal が消える（例：日次記録を入力 → missing-record が消える）
- **手動解消**: 根本データは変わらないが対応済みとしてマークしたい（例：計画外事情で記録を免除する判断）

現状は自動解消のみ対応。手動解消の仕組みがない。

### ギャップ③: 「誰も対応していない問題」が見えない

- スタッフ全員が `missing-record` を見る
- 誰かが「自分がやる」と言えない
- 結果：全員が「誰かがやるだろう」と思って放置される（傍観者効果の残存）

---

## Decision

### 1. Signal Lifecycle Model

シグナルの状態遷移を次のように定義する：

```
[open] → [acknowledged] → (自動解消 or 手動resolved)
  ↓
[snoozed]  ← 既存の snooze 操作（変更なし）
[dismissed] ← 既存の dismiss 操作（変更なし）
```

| status | 意味 | 誰が変更できるか |
|--------|------|----------------|
| `open` | 未対応。誰でも見える | システムが自動セット |
| `acknowledged` | 誰かが対応中 | ownerRole を持つユーザー |
| `resolved` | 手動で解消マーク | manager 以上 |
| `snoozed` | 個人的先送り（既存） | 自分のみ |
| `dismissed` | 個人的非表示（既存） | 自分のみ |

**重要な原則**: `acknowledged` と `resolved` は**共有状態**。`snoozed` と `dismissed` は**個人状態**（既存 localStorage で継続）。

### 2. 型定義の拡張

#### SignalAcknowledgement（新規）

```typescript
export type SignalAcknowledgement = {
  stableId: string;           // シグナルの安定ID
  status: 'acknowledged' | 'resolved';
  actorUserId: string;        // 操作したユーザーのID
  actorDisplayName: string;   // 表示用名前
  createdAt: string;          // ISO 8601
  resolvedAt?: string;        // status が 'resolved' の場合
  note?: string;              // 任意のメモ（例：「家族対応済みのため免除」）
};
```

#### TodayExceptionAction の拡張

```typescript
export type TodayExceptionAction = {
  // ... 既存フィールド (変更なし)
  ownerRole?: 'admin' | 'manager' | 'staff';

  // ADR-019 追加
  acknowledgement?: SignalAcknowledgement; // acknowledged/resolved の場合にセット
};
```

### 3. 永続化戦略（フェーズ分割）

#### Phase 1: LocalStorage（MVP、即実装可能）

`useExceptionPreferences` の `dismissed` を拡張し、acknowledgement メタデータを保持する。

```typescript
// isokatsu.exception-preferences.v2
type PersistedPayload = {
  version: 2;
  state: {
    dismissed: Record<string, boolean>;
    snoozed: Record<string, string>;
    acknowledged: Record<string, SignalAcknowledgement>; // 追加
  };
};
```

**制約**: per-user, per-device。スタッフAがacknowledgeしてもスタッフBには見えない。

**許容判断**: 現フェーズでは「自分が対応中」という個人的なコミットメントとして十分。MVP の運用規模（小規模施設）では許容範囲内。

#### Phase 2: SharePoint 共有リスト（将来実装）

新規 SP リスト `Signal_Acknowledgements` を作成：

| 列名 | 型 | 説明 |
|------|-----|------|
| `Title` | 単一行テキスト | stableId |
| `Status` | 選択肢 | acknowledged / resolved |
| `ActorUserId` | 単一行テキスト | SP ユーザーID |
| `ActorDisplayName` | 単一行テキスト | 表示名 |
| `CreatedAt` | 日付/時刻 | 操作日時 |
| `Note` | 複数行テキスト | 任意メモ |

フック: `useSignalAcknowledgements` が SP リストを読み書き。`useTodayExceptions` がこれを結合して `acknowledgement` フィールドをセット。

### 4. UI の変更（最小限）

#### TodayExceptionCard の拡張

- `acknowledged` シグナル: バッジ「対応中: {actorDisplayName}」を表示（他のスタッフへの可視性）
- `acknowledge` ボタン: ownerRole と currentUser.role が一致する場合のみ表示
- Phase 1 では localStorage なので自分のデバイスでのみ反映

#### Today Action Center でのフィルタリング

```typescript
// acknowledged なシグナルは queue の末尾に移動（完全非表示ではない）
const orderedItems = [
  ...items.filter(i => !i.acknowledgement),        // 未対応: 上位
  ...items.filter(i => i.acknowledgement?.status === 'acknowledged'), // 対応中: 下位
];
```

### 5. このリリースのスコープ外

以下は ADR-019 の範囲外とし、後続 ADR で扱う：

- **SLA / エスカレーション**: 「N時間 acknowledged のまま → manager に昇格」
- **assigneeId（特定ユーザー割り当て）**: シフト管理との統合が必要
- **Resolved シグナルの監査ログ**: 施設の記録義務に応じて検討

---

## Consequences

### Positive

- 「誰が対応中か」が見えるようになり、傍観者効果の残存を解消
- 手動 resolved により「記録免除」などの例外ケースを正式にシステムへ取り込める
- localStorage Phase 1 → SP Phase 2 への移行パスが明確

### Negative / トレードオフ

- Phase 1 (localStorage) では共有状態にならない。スタッフ間の「対応中見え」はデバイス依存
- `dismissed` と `acknowledged` の概念的な違いをスタッフが理解する必要がある（UX の説明が必要）
- SP Phase 2 への移行時、localStorage の acknowledgement データは移行対象外（リセットされる）

### 既存コードへの影響

- `useExceptionPreferences`: `acknowledged` フィールド追加、バージョン v1 → v2
- `buildTodayExceptions`: `acknowledgement` フィールドのパスルーのみ（純粋関数のシグネチャ変更なし）
- `TodayExceptionCard`: `acknowledge` ボタン追加（既存カード UI は変更なし）

---

## Migration Path

```
現在: dismiss/snooze (localStorage v1)
         ↓ ADR-019 Phase 1
      + acknowledge/resolve (localStorage v2)
         ↓ ADR-019 Phase 2  
      acknowledge/resolve → SP共有リスト
      dismiss/snooze → localStorage継続（個人設定として）
```

---

## References

- [ADR-016: Proactive Setup Guidance Signals](ADR-016-proactive-setup-guidance-signals.md)
- [ADR-017: Signal Governance, Visibility & Suppression](ADR-017-signal-governance-visibility-suppression.md)
- [ADR-018: Signal Ownership & Operational Accountability](ADR-018-signal-ownership-accountability.md)
- `src/features/exceptions/hooks/useExceptionPreferences.ts` — 現状の localStorage 実装
- `src/features/exceptions/domain/buildTodayExceptions.ts` — TodayExceptionAction 型定義

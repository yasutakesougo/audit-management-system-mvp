# ADR-022: L3 支援手順兼記録の正本導線をキオスクモードに固定する

## Status

Accepted

## Context

本システムの ISP 三層モデルでは、L3 は「支援手順書兼日々の実施記録」を扱う層である。これまで通常業務向けの `/daily/support` と、現場端末向けの `/kiosk/*` が並存していたため、どちらを日々の支援手順兼記録の正本導線として扱うかを明文化する必要があった。

現場運用では、共有タブレット等のキオスク端末から、利用者を選び、当日の支援手順を確認し、実施状況と観察をその場で記録する導線が最も重要である。一方、`/daily/support` は管理者・通常業務向けのウィザード導線であり、クエリパラメータ `wizard` / `user` / `userId` による状態復元を前提としている。

L3 の正本導線を曖昧にすると、古い URL や誤ったクエリパラメータによる暗黙遷移、端末間での記録済み判定の不整合、ローカルステートと SharePoint 永続記録の混線が発生しうる。

## Decision

L3「支援手順兼記録」の正本導線はキオスクモードとする。

正本ルートは以下とする。

```txt
/kiosk
  -> /kiosk/users
  -> /kiosk/users/:userId/procedures
  -> /kiosk/users/:userId/procedures/:slotKey
```

`/daily/support` は廃止しない。管理者・通常業務向けの支援記録ウィザードとして維持する。ただし、現場端末での日々の支援手順確認、観察入力、実施記録、記録済み判定の正本は `/kiosk/*` とする。

## Invariants

### 1. Kiosk は path parameter を主制御とする

キオスクでは、`wizard` / `user` / `userId` クエリは画面状態の主制御に使わない。

- 利用者は `:userId` で決定する。
- 手順スロットは `:slotKey` で決定する。
- 記録対象日は `date=YYYY-MM-DD` で決定する。

そのため、以下のような URL は自動ジャンプしてはならない。

```txt
/kiosk/users?wizard=plan&user=I005&userId=I005
```

この URL は常に利用者選択画面として扱う。

### 2. Kiosk の date は厳密に YYYY-MM-DD のみ許可する

`date` クエリは `YYYY-MM-DD` 形式のみ有効とし、不正値・空値・存在しない日付は当日にフォールバックする。

有効例:

```txt
/kiosk/users/1/procedures?date=2026-05-07
/kiosk/users/1/procedures/0?date=2026-05-07
```

### 3. Kiosk の search params は画面遷移で維持する

キオスクでは、`date`、`provider=memory`、`kiosk=1` などの search params を画面遷移で維持する。戻る操作、手順一覧への遷移、保存後の一覧復帰で search params を落としてはならない。

### 4. SharePoint モードでは永続記録を記録済み判定の正とする

本番 SharePoint モードでは、SharePoint repository から取得した records を記録済み判定の正とする。local store のみの record は、端末を変えると消えるため、本番の「記録済み」判定の正にしない。

記録済み判定は以下の normalized match を基準とする。

```txt
normalizeScheduleItemId(procedure.rowNo || procedure.id || slotKey)
  ===
normalizeScheduleItemId(record.scheduleItemId)
```

`rowNo` はキオスク支援手順の canonical slot identity として優先する。`rowNo` がない場合のみ `procedure.id`、最後に `slotKey` を fallback として使用する。

## Consequences

### Positive

- 現場端末向け L3 導線が `/kiosk/*` に固定され、運用説明が簡潔になる。
- 古いクエリ付き URL による暗黙ジャンプを防げる。
- 過去日入力時の `date` 伝搬が明確になる。
- SharePoint 永続記録を正とするため、端末間で「記録済み」表示が安定する。
- `/daily/support` と `/kiosk/*` の責務分離が明確になる。

### Trade-offs

- `/kiosk/users?userId=...` のような URL からの直接ジャンプは行わない。
- キオスク導線では、必ず利用者選択または path parameter 付き URL から手順一覧へ入る必要がある。
- `/daily/support` 側のウィザード状態とキオスク導線は意図的に同期しない。

## Guardrails

この ADR を守るため、以下の E2E 回帰テストを維持する。

1. `/kiosk/users?wizard=plan&user=I005&userId=I005` が自動ジャンプせず、利用者選択画面に留まること。
2. `/kiosk/users/:userId/procedures?date=YYYY-MM-DD` が指定日の支援手順一覧を表示すること。
3. `/kiosk/users/:userId/procedures/:slotKey?date=YYYY-MM-DD` から保存して一覧へ戻っても `date` が維持されること。

## Related

- ADR-005: ISP Three-Layer separation
- Kiosk procedure list and detail screens
- Support Date Governance: L2 owns monitoring origin, L3 consumes and warns

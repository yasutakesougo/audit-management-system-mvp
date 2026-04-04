# ADR-014: SharePoint SSOT Drift Contract (Users / Daily / ActivityDiary / MonitoringMeeting)

## Status
Accepted

## Date
2026-04-04

## Context
SharePoint テナント差分（列名 drift・suffix 付与・`_x0020_` 変換・legacy alias）により、
同一業務でもドメインごとに read/write/diagnostics の解決ルールが分断され、障害時の挙動が不一致になっていた。

特に以下が問題だった:
- 候補定義が repository 側に散在し、SSOT が崩れる
- read と write で参照する物理名がずれる
- diagnostics と実装の期待列が一致しない
- unresolved を暗黙に落とす実装が混入しやすい

Users / Daily で確立した drift hardening を、
ActivityDiary と MonitoringMeeting まで同一契約で横展開したため、
ここで「共通契約」を ADR として固定する。

## Decision
SharePoint drift 対応は、以下の **4層同一契約** を必須とする。

### 1. Fields SSOT
- ドメイン専用 `*_CANDIDATES` を唯一の候補定義とする。
- `*_ESSENTIALS`（必須）と optional を分離する。
- repository 独自候補定義は禁止。

### 2. Schema Resolver
- `resolveInternalNamesDetailed` を利用する。
- essentials 判定を行う。
- list 解決は catalog 優先、失敗時は direct probe fallback。
- 未解決キーは `resolved[key] ?? candidates[key][0]` で best-effort fallback を保持する。
- drift / optional missing は warn ログを残す。

### 3. Repository Read/Write
- read / write 双方で `mapping[key] ?? primary` を使う。
- payload は解決済み mapping を必ず経由する。
- 静的物理名ハードコードを禁止する。
- fail-open を維持し、diagnostics 失敗で業務保存を止めない。

### 4. Diagnostics + Tests
- Health 側は同じ SSOT candidates/essentials を参照する。
- essentials missing は FAIL、optional missing は WARN を基本とする。
- ただし repository が継続可能な場合は過剰 FAIL にしない。
- drift spec + resolver spec を最低ラインとし、以下を必須検証する:
  - alias
  - suffix (`Field0`)
  - `_x0020_`
  - missing/unresolved（silent drop しない）
  - essentials 判定
  - catalog 経由 / direct probe fallback
  - best-effort fallback

## Consequences

### Positive
- read/write/diagnostics の drift 契約が一致し、障害の再現性が上がる。
- 横展開時の設計レビュー観点が固定される。
- 未解決を黙って落とさないため、欠損の早期検知が可能。

### Trade-offs
- unresolved optional を primary fallback で送るため、
  物理列が完全欠落した環境では write 時に 400 が発生し得る。
- これは silent drop 回避を優先した設計上のトレードオフとする。

## Scope
本 ADR の契約を適用済みドメイン:
- Users
- Daily
- ActivityDiary
- MonitoringMeeting

## Rollout Checklist for New Domain
新規ドメイン横展開時は、以下を PR Definition of Done とする。

1. `fields`: `*_CANDIDATES` / `*_ESSENTIALS` を追加（SSOT 化）
2. `resolver`: detailed resolve + essentials + fallback + warn
3. `repository`: mapping-first（read/write とも）
4. `diagnostics`: candidates/essentials 参照を統一
5. `tests`: drift spec + resolver spec 追加
6. `verification`: `vitest`（関連）+ `npm run -s typecheck` 緑化


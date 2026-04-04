# SharePoint SSOT Drift PR Template (v1.1)

> Source of truth: [ADR-014](../adr/ADR-014-sharepoint-ssot-drift-contract.md)

## Purpose
SharePoint schema drift 対応 PR を、毎回同じ品質・同じ説明粒度で提出するための最小テンプレート。

## Version
- Current: `v1.1` (2026-04-04)
- Delta from v1: first live rollout feedback block (`Template Feedback (v1)`) を標準項目に追加

## Applied Domains
- Users
- Daily
- ActivityDiary
- MonitoringMeeting

## When To Use
- 新規ドメインに SSOT drift パターンを横展開するとき
- 既存ドメインで fields/resolver/repository/diagnostics の契約不一致を是正するとき

## Definition of Done (ADR-014準拠)
1. `fields`: `*_CANDIDATES` / `*_ESSENTIALS` を SSOT として定義
2. `resolver`: `resolveInternalNamesDetailed` + essentials 判定 + catalog→direct probe fallback
3. `repository`: read/write とも `mapping[key] ?? primary` に統一
4. `diagnostics`: Health 側が同一 candidates/essentials を参照
5. `tests`: drift spec + resolver spec（alias/suffix/_x0020_/missing/essentials）
6. `verification`: 関連 `vitest` + `npm run -s typecheck` が通る

## PR Body Template (Copy & Paste)
```md
## Summary
Apply the ADR-014 SharePoint SSOT drift contract to <DOMAIN>, unifying schema resolution across fields, repository read/write, and diagnostics.

## Why
<Current pain / drift failure mode in this domain>

## Scope
- Domain: <DOMAIN>
- Layers: fields / resolver / repository / diagnostics / tests
- Out of scope: <if any>

## Changes
### 1. Fields (SSOT)
- Added/updated `<DOMAIN>_CANDIDATES`
- Added/updated `<DOMAIN>_ESSENTIALS` (and optional split if needed)
- Added aliases for suffix (`Field0`), `_x0020_`, legacy names

### 2. Schema Resolver
- Added/updated `<Domain>SchemaResolver`
- Implemented `resolveInternalNamesDetailed`
- Implemented essentials check
- Implemented catalog resolution + direct probe fallback
- Implemented best-effort fallback (`resolved[key] ?? primary`)
- Added drift/mismatch warn logging

### 3. Repository (Read/Write)
- Unified to mapping-first (`mapping[key] ?? primary`)
- Removed static physical internal-name dependencies
- Ensured payload uses resolved mapping

### 4. Diagnostics
- Wired Health diagnostics to `<DOMAIN>_CANDIDATES` / `<DOMAIN>_ESSENTIALS`
- essentials missing => FAIL, optional missing => WARN
- kept fail-open behavior

### 5. Tests
- Added/updated drift spec:
  - alias
  - suffix
  - `_x0020_`
  - missing/unresolved (no silent drop)
  - essentials boundary
- Added/updated resolver spec:
  - catalog path
  - direct probe fallback
  - essential missing
  - best-effort fallback

## Verification
- `npx vitest run <related-specs>`
- `npm run -s typecheck`
- Monitoring/Health起因の新規 typecheck エラーなし

## Residual Risks
- Optional fields unresolved + no physical column can still cause write-time 400 (intentional trade-off to avoid silent drop).

## PR Title
`fix(<domain>): unify SharePoint drift resolution across read/write/diagnostics`

## Template Feedback (v1)
1. 書きづらかった箇所:
2. レビュアーが迷った箇所:   <!-- 必須 -->
3. 削れる/統合できる箇所:
```

## Recommended PR Split
- PR-1: drift hardening (機能価値あり)
- PR-2: global typecheck cleanup (横断的整理)

## Command Snippets
```bash
# related tests
npx vitest run src/sharepoint/fields/__tests__/<domain>.drift.spec.ts \
  src/features/<domain>/.../<Domain>SchemaResolver.spec.ts

# full typecheck
npm run -s typecheck
```

## Post-Review Update Rule
- テンプレ修正は「指摘3点に対する最小差分」のみ行う（肥大化防止）
- 特に `2. レビュアーが迷った箇所` を優先して反映する
- 修正後はバージョンを `v1.x` で更新し、変更理由を1行で残す

# Residual Console Call Classification

> **Date**: 2026-03-09
> **Scope**: All `console.*` calls remaining in `src/` after P0 structured logging migration

## Classification Rules

| Category | Meaning | Action |
|----------|---------|--------|
| **KEEP** | Intentional — infra bootstrap, logging-about-logging, Worker context | No change |
| **DEV_ONLY** | Debug/development aid — should be guarded with `import.meta.env.DEV` | Wrap or remove |
| **MIGRATE_LATER** | Operational error/warn that should eventually use `auditLog` | Future P3 |

---

## KEEP — Intentional (Do Not Touch)

| File | Level | Reason |
|------|-------|--------|
| `lib/audit.ts` ×4 | `error` | Logging failures in the audit log itself (logging-about-logging) |
| `lib/persistentLogger.ts` | `warn` | Storage write failure in the persistent logger |
| `lib/env.ts` ×5 | `warn`, `error`, `debug` | Env validation warnings, scope derivation fallbacks |
| `lib/env.schema.ts` | `warn` | Test environment validation warning |
| `worker.ts` ×3 | `error` | Cloudflare Workers context — no `auditLog` available |
| `env.ts` (getRuntimeEnv) | `debug` | Guarded env debug output |

---

## DEV_ONLY — Already Guarded ✅

All DEV_ONLY calls are wrapped with `import.meta.env.DEV`, a runtime `debugEnabled` flag, or equivalent.
No production console output from these files.

### Pages — Development debugging (all guarded)

| File | Line | Level | Content | Guard |
|------|------|-------|---------|-------|
| `Home.tsx` | 69, 71, 73, 80 | `log` | Component render, demo mode, users debug | `import.meta.env.DEV` |
| `IntegratedResourceCalendarPage.tsx` | 76, 82, 94, 126, 128, 189, 198, 288 | `log` | `[IRC]` mount, env, SpClient, data load | `import.meta.env.DEV` |
| `SupportRecordPage.tsx` | 105, 117 | `log` | 本日分の記録を一括生成, 記録更新 | `import.meta.env.DEV` |
| `MonthlyRecordPage.tsx` | 119, 125, 145, 151 | `log` | 再集計開始/完了, PDF生成開始/完了 | `import.meta.env.DEV` |
| `IcebergPdcaPage.tsx` | 9 | `log` | `[iceberg-pdca/pages] mounted` | `debugEnabled` runtime flag |
| `DebugZodErrorPage.tsx` | 27 | `log` | "Simulating Zod Error..." | `import.meta.env.DEV` |
| `UserFormDemo.tsx` | 86 | `log` | "User saved:" | `import.meta.env.DEV` |

### Debug tooling

| File | Line | Level | Content | Recommendation |
|------|------|-------|---------|----------------|
| `debug/SharePointListDebug.tsx` | 44, 50 | `log`, `error` | Compliance items, list error | KEEP as-is — debug tool |

> [!NOTE]
> `debug/` files are only reachable via `/admin/debug/*` routes (dev-only), never from production main flows.

### Metrics

| File | Line | Level | Content | Recommendation |
|------|------|-------|---------|----------------|
| `metrics.ts` | 49 | `log` | `[web-vitals]` metric output | DEV guard — should not fire in production |

---

## ~~MIGRATE_LATER~~ — P3 Migration Complete ✅

> All 7 items migrated to `auditLog` on 2026-03-09.

| File | Line | Level | Event Key | Namespace |
|------|------|-------|-----------|-----------|
| `admin/DataIntegrityPage.tsx` | 75 | `warn` | `fetch_list_failed` | `data-integrity` |
| `admin/DataIntegrityPage.tsx` | 125 | `error` | `fetch_scan_data_failed` | `data-integrity` |
| `admin/DataIntegrityPage.tsx` | 139 | `warn` | `clipboard_api_unavailable` | `data-integrity` |
| `admin/ModeSwitchPage.tsx` | 74 | `warn` | `local_storage_update_failed` | `mode-switch` |
| `IBDDemoPage.tsx` | 514 | `error` | `pdf_generation_failed` | `ibd-demo` |
| `IcebergAnalysisPage.tsx` | 207 | `error` | `save_failed` | `iceberg-analysis` |
| `hooks/useSupportRecordSubmit.ts` | 145 | `debug` | `error_already_in_store` | `support-record-submit` |

---

## Summary

| Category | Count | Status |
|----------|-------|--------|
| KEEP | ~14 | ✅ No change needed |
| DEV_ONLY | ~22 | ✅ All guarded with `import.meta.env.DEV` |
| MIGRATE_LATER | 0 | ✅ P3 migration complete (2026-03-09) |
| **Total** | ~36 | |

> [!TIP]
> All DEV_ONLY console output is now silenced in production builds.
> All operational error/warn calls have been migrated to `auditLog`.

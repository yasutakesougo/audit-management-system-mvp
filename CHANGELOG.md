<!-- markdownlint-disable MD024 -->
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2026-02-04] Phase 3.7-A Complete

### Added
- **Auth Diagnostics Infrastructure**
  - AuthDiagnosticsCollector (Singleton, 100-event ring buffer)
  - useSchedules integration (Auth Guard events)
  - MsalProvider integration (login events)
  - DevTools API for dev-mode inspection
  - Runbook links for troubleshooting
  - E2E smoke test coverage (3 test cases)

### Quality
- TypeScript: 100% compliance
- ESLint: 0 warnings
- E2E: All tests passing
- Manual: DevTools API verified

### Added

- _TBD_

### Changed

- SP client: wired retry telemetry into debug logger and tightened abort semantics to skip redundant retries.
- feat(spClient): retry hooks + batch/paging.

### Fixed

- _TBD_

## [0.9.1] - 2025-10-11

### Added

- Scaffolded release flow: npm alias for reusable release helper.

### Changed

- Prepared changelog section for the next patch release using Keep a Changelog format.

### Fixed

- (none)

## [0.9.0] - 2025-10-11

### Added

- Configurable week start via `VITE_SCHEDULES_WEEK_START` (default = 1 = Monday).
- Timezone fallback chain `VITE_SCHEDULES_TZ` → `Intl.DateTimeFormat()` → `Asia/Tokyo` implemented in `resolveSchedulesTz()` with validation and console warnings.
- Comprehensive schedule unit coverage now enforced in CI preflight (`npx vitest run tests/unit/schedule --reporter=basic`).
- Documentation update: clarified “YYYY-MM-DD → wall-clock → UTC” normalization strategy and the “no `setHours()`” rule.
- Boundary/DST regression tests: new `dateutils.boundary.extra.spec.ts` covers month/year edges in JST, env-driven week starts, and the LA DST crossover.

### Changed

- Rebuilt date/time helpers around string-based, TZ-safe workflow using `fromZonedTime`; all callers now inherit the runtime timezone/weekday defaults from `getAppConfig()`.
- Hardened `getAppConfig()` parsing and clamping logic for numeric env values.
- Expanded module exports so external consumers can access `startOfDayUtc`, `endOfDayUtc`, `startOfWeekUtc`, `endOfWeekUtc` with explicit TZ and weekday parameters.

### Fixed

- Local/UTC boundary mismatches in `startOfDayUtc`, `endOfDayUtc`, and week helpers (tests now green across JST and DST regions).

### Notes

- Safe for minor version bump → 0.8.x → 0.9.0 (backward-compatible public API, new config options).
- No migration required: existing callers pick up defaults automatically.

<!-- markdownlint-enable MD024 -->

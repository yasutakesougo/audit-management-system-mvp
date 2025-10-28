Prefetch & HUD Guardrails

Mocked SharePoint client for HUD specs and exported enableHudForTests to seed HUD state deterministically.
Refactored AppShell and NavLink prefetch tests to share renderWithAppProviders, stabilizing StrictMode behavior and keyboard/viewport intent coverage.
Added hydration guard specs (router context invariant, HUD bootstrap) and refreshed AppShell snapshot for new HUD/prefetch markup.

Build Pipeline Hardening

Added Vite aliases pointing node:fs and crypto to a browser-safe shim, removing browser build warnings.
Converted Audit/Checklist/Records routes to React.lazy + Suspense. Prefetch registry and router now import matching modules, clearing duplicate dynamic/static chunk warnings.

CI Fast-Lane Integration

New .github/workflows/fast-lane.yml runs typecheck → lint → test:store → test:hydration → test:e2e:prefetch (Chromium) → build:ci.
Uploads Playwright artifacts on failure and enforces bundle guards automatically.

Artifacts & Follow-ups

Branch port/flags contains commits d8f32f7 (HUD stabilization) and b7a5ed5 (Vite warning fixes).
Remaining non-blocking warning: none.
Phase III will continue with Shake/Telemetry follow-ups.

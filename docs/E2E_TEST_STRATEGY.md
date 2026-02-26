# E2E Test Strategy: /schedules

This document outlines the strategy for ensuring high reliability of the Schedules feature through End-to-End (E2E) testing, specifically focusing on network resilience and conflict handling.

## 1. Adapter Strategy

To reliably test network-related logic (like offline snackbars and retry flows), we force the use of the **SharePoint Adapter** in E2E environments, even when `VITE_SKIP_SHAREPOINT=1` is set for other modules.

- **Flag**: `isE2E` (derived from `VITE_E2E=1`)
- **Location**: `src/features/schedules/data/context.ts`
- **Benefit**: The SharePoint adapter uses the standard `fetch` API. This allows Playwright to intercept and fail requests using `page.route` or `page.setOfflineMode(true)`, triggering the application's real error-handling paths.

## 2. E2E Bypass Mode

When running in E2E mode without a real SharePoint environment (e.g., local development or standard CI), we use a "Bypass Mode" in the repository.

- **Mechanism**: If `baseUrl` is empty (detected in `SharePointScheduleRepository.ts`), mutations like `create`, `update`, and `remove` return successfully with mock data instead of attempting a real network request.
- **Verification**: This ensures we can test the UI's reaction to *simulated* failures (like network timeouts) while still allowing the rest of the flow to proceed when "online" simulation is active.

## 3. UI Resilience Guards

Certain UI behaviors are modified during E2E tests to ensure deterministic verification.

### Persistent Snackbars
- **Logic**: In E2E mode, the network error Snackbar sets `autoHideDuration={undefined}`.
- **Why**: This prevents the snackbar from disappearing before Playwright can assert its existence.

### Input Guarding
- **Logic**: The `onClose` handler for error snackbars ignores `clickaway` and `timeout` events in E2E mode.
- **Why**: Ensures that random events during a test run don't prematurely clear the global `lastError` state, which is critical for verification.

## 4. Conflict Testing (412 handling)

We use Playwright's `route.fulfill` to simulate optimistic concurrency conflicts.

- **Scenario**: When a save operation occurs, we intercept the request and return an HTTP `412 Precondition Failed`.
- **UI Expectation**: The app must display the **Conflict Resolution Dialog**, allowing the user to "Reload and Retry".

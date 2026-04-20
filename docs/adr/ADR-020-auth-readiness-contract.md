# ADR-020: Auth Readiness Contract

## Status
Accepted

## Context
The application performs numerous IO operations (SharePoint list provisioning, Graph API role resolution, diagnostic signal ingestion) at startup. Previously, these operations were triggered as soon as components were mounted, often before the authentication process (MSAL) was complete. This led to:
1.  **Burst of Unauthorized Requests**: 50+ SharePoint API calls returning 401/AuthRequiredError immediately.
2.  **Rate Limit False Positives**: The internal `useAuth` loop guard (throttling) was triggered because of the volume of requests, even though they were legitimate attempts that just happened before login.
3.  **Noisy Console Logs**: Console flooded with "Skipped: no account" errors during every page load before login.

## Decision
We define an "Auth Readiness Contract" to standardize when IO operations are allowed to begin.

### 1. The `isAuthReady` Flag
A unified flag `isAuthReady` is exposed via `useAuth().isAuthReady`.
It is defined as:
```ts
isAuthReady = isAuthenticated && inProgress === 'none' && !!activeAccount;
```
This ensures that:
- The user is logged in.
- MSAL is not in the middle of a redirect or popup flow.
- A valid account object is active and accessible.

### 2. Mandatory Gating
All global initialization and background IO (Effect-based IO) MUST be gated by this flag.
```ts
useEffect(() => {
  if (!isAuthReady) return;
  // ... perform IO
}, [isAuthReady]);
```

### 3. Classification of "Auth Skip"
- **Auth Skip** (requests made while `!isAuthReady`): Classified as a **Normal Wait State**. 
  - Logged as `[auth-skip]` in debug mode.
  - Reported as a `watch` (priority 0) signal in `SpHealthSignalStore`.
  - **Does NOT** count towards the internal rate limiting / infinite loop guard.
- **Auth Failure** (requests that fail AFTER `isAuthReady` is true): Classified as an **Error**.
  - Logged as a warning/error.
  - Reported as `warning` or `critical` signal.
  - Counts towards the rate limit if repeated.

## Consequences
- **Stable Startup**: The application remains quiet and stable until login is finalized.
- **Burst Prevention**: Concurrent requests for tokens are pooled and handled only once auth is ready.
- **Meaningful Observability**: Diagnostics now reflect whether a lack of data is due to a system error or simply waiting for authentication.
- **Improved Performance**: Reduced redundant `acquireToken` calls during the boot sequence.

# Environment Variables Reference

This document lists and categorizes all supported environment variables for the Audit Management System.
Each variable is defined in `src/lib/env.schema.ts` and consumed throughout the codebase. Only variables
present in that schema are included here.

## How to read this table

- **Variable** – the exact name of the environment variable.
- **Purpose** – what the variable controls or configures.
- **Required** – whether the variable must be provided. Variables marked **Yes** are mandatory and the application will refuse to start or throw at runtime if missing.
- **Default** – default value applied when the variable is omitted. A dash means no default (required or context-dependent).
- **References** – key modules or functions where the variable is used.
- **Notes** – warnings, caveats, or important usage notes.

## 1. Authentication & MSAL

| Variable | Purpose | Required | Default | References | Notes |
| --- | --- | --- | --- | --- | --- |
| `VITE_MSAL_CLIENT_ID` | The application (client) ID registered in Azure AD for MSAL authentication. | **Yes** | – | `env.schema.ts`, `env.ts` | Without this the app cannot obtain tokens from Azure AD. |
| `VITE_MSAL_TENANT_ID` | The Azure Active Directory tenant ID used with MSAL. | **Yes** | – | `env.schema.ts`, `env.ts` | Must correspond to the tenant where the app registration resides. |
| `VITE_MSAL_AUTHORITY` | Authority URL for MSAL, typically `https://login.microsoftonline.com/<tenantId>`. | No | derived from `VITE_MSAL_TENANT_ID` | `env.ts` | Override only for B2C or national clouds. |
| `VITE_MSAL_SCOPES` | Additional scopes to request when acquiring access tokens. | No | `""` (empty) | `env.schema.ts` | Provide a space‑separated list of Microsoft Graph or custom scopes. |
| `VITE_MSAL_LOGIN_SCOPES` | Scopes included during the user login flow. | No | `""` (empty) | `env.schema.ts` | Keep the default unless extra claims are needed. |
| `VITE_MSAL_TOKEN_REFRESH_MIN` | Minimum number of seconds before proactively refreshing access tokens. | No | `300` | `env.schema.ts` | Note: despite the name, the schema default is **300** (parsed as integer). |
| `VITE_MSAL_LOGIN_FLOW` | Login interaction type: `redirect` or `popup`. | No | `"popup"` | `env.schema.ts` | Schema default is `popup`. |
| `VITE_MSAL_REDIRECT_URI` | The redirect URI configured in Azure AD for MSAL. | No | Current origin | `env.ts` | Should match one of the redirect URIs on the app registration. |
| `VITE_LOGIN_SCOPES` | Scopes passed to the login helper. | No | `""` (empty) | `env.schema.ts` | Internal alias. |
| `VITE_AAD_CLIENT_ID` | Alias for Azure AD client ID used by some services. | No | – | `env.schema.ts` | Legacy; keep in sync with `VITE_MSAL_CLIENT_ID`. |
| `VITE_AAD_TENANT_ID` | Alias for Azure AD tenant ID. | No | – | `env.schema.ts` | Legacy. |
| `VITE_AZURE_CLIENT_ID` | Client ID used by Azure SDKs (Graph etc.). | No | – | `env.schema.ts` | |
| `VITE_AZURE_TENANT_ID` | Tenant ID used by Azure SDKs. | No | – | `env.schema.ts` | |
| `VITE_SP_SCOPE_DEFAULT` | OAuth scope to access SharePoint. | No | – (derived at runtime) | `env.schema.ts` | Usually derived from `VITE_SP_RESOURCE` and tenant. |

## 2. SharePoint & Site Configuration

| Variable | Purpose | Required | Default | References | Notes |
| --- | --- | --- | --- | --- | --- |
| `VITE_SP_RESOURCE` | Azure AD application ID or resource URI representing SharePoint. | **Yes** | – | `env.schema.ts` | `z.string().url()` — must be a valid URL. |
| `VITE_SP_SITE_RELATIVE` | Relative path to the SharePoint site (e.g. `/sites/AuditApp`). | **Yes** | – | `env.schema.ts` | `z.string().startsWith('/')` — must start with `/`. |
| `VITE_SP_SITE_URL` | Full URL to the SharePoint site (legacy support). | No | – | `env.schema.ts` | Used as fallback when `VITE_SP_SITE_RELATIVE` is not set. |
| `VITE_SP_TENANT` | SharePoint tenant hostname (e.g. `contoso.sharepoint.com`). | No | – | `env.schema.ts` | Only needed when constructing API calls manually. |
| `VITE_SP_SITE` | Site path used by some legacy functions. | No | – | `env.schema.ts` | |
| `VITE_SP_LIST_SCHEDULES` | Title of the SharePoint list for schedules. | No | – | `env.schema.ts` | |
| `VITE_SP_LIST_USERS` | Title of the SharePoint list for users. | No | – | `env.schema.ts` | |
| `VITE_SP_LIST_DAILY` | Title of the SharePoint list for daily records. | No | – | `env.schema.ts` | |
| `VITE_SP_LIST_STAFF` | Title of the SharePoint list for staff. | No | – | `env.schema.ts` | |
| `VITE_SP_LIST_ACTIVITY_DIARY` | Title of the activity diary list. | No | `"ActivityDiary"` | `env.schema.ts` | |
| `VITE_SP_LIST_STAFF_ATTENDANCE` | Title of the staff attendance list. | No | `"StaffAttendance"` | `env.schema.ts` | |
| `VITE_SP_LIST_STAFF_GUID` | Staff list GUID override. | No | – | `env.schema.ts` | |
| `VITE_SP_LIST_PLAN_GOAL` | Title of the plan goals list. | No | `"PlanGoals"` | `env.schema.ts` | |
| `VITE_SP_LIST_NURSE_OBSERVATION` | Title of the nurse observations list. | No | `"NurseObservations"` | `env.schema.ts` | |
| `VITE_SP_LIST_MEETING_SESSIONS` | Title of the meeting sessions list. | No | `"MeetingSessions"` | `env.schema.ts` | |
| `VITE_SP_LIST_MEETING_STEPS` | Title of the meeting steps list. | No | `"MeetingSteps"` | `env.schema.ts` | |
| `VITE_SP_HANDOFF_LIST_TITLE` | Title of the handoff records list. | No | `"Handoff"` | `env.schema.ts` | |
| `VITE_SP_HANDOFF_LIST_ID` | List GUID for the handoff list. | No | – | `env.schema.ts` | |
| `VITE_SCHEDULES_LIST_TITLE` | Title of the list used by the schedules module. | No | `"Schedules"` | `env.schema.ts` | |
| `VITE_SP_RETRY_MAX` | Maximum number of retries when SharePoint calls fail. | No | `4` | `env.schema.ts` | Applies exponential backoff between attempts. |
| `VITE_SP_RETRY_BASE_MS` | Base delay in milliseconds for SharePoint retry logic. | No | `400` | `env.schema.ts` | |
| `VITE_SP_RETRY_MAX_DELAY_MS` | Maximum delay between SharePoint retry attempts in milliseconds. | No | `5000` | `env.schema.ts` | |
| `VITE_FORCE_SHAREPOINT` | Force usage of SharePoint instead of demo/mock. | No | `false` | `env.schema.ts` | |
| `VITE_ALLOW_SHAREPOINT_OUTSIDE_SPFX` | Allow SharePoint calls outside of the SharePoint Framework (SPFx). | No | `false` | `env.schema.ts` | |
| `VITE_SKIP_SHAREPOINT` | Skip all SharePoint integration. | No | `false` | `env.schema.ts` | Used in local dev or unit tests. |
| `VITE_SKIP_LOGIN` | Disable login completely (anonymous mode). | No | `false` | `env.schema.ts` | Use only in development or automated tests. |

### SharePoint List Name Resolution (spListRegistry)

List names used in API calls are resolved by [`spListRegistry.ts`](../src/sharepoint/spListRegistry.ts) via a deterministic fallback chain:

```
1. Environment variable (VITE_SP_LIST_*)  →  2. LIST_CONFIG constant  →  3. Hardcoded default
```

| Resolver | Used When | Example |
|----------|-----------|---------|
| `envOr(envKey, fallback)` | List name is env-configurable | `envOr('VITE_SP_LIST_USERS', fromConfig(ListKeys.UsersMaster))` → `'Users_Master'` |
| `fromConfig(key)` | List name is fixed in `LIST_CONFIG` | `fromConfig(ListKeys.SupportTemplates)` |

> [!NOTE]
> In most deployments, environment variables are **not set** and `LIST_CONFIG` / hardcoded defaults apply.
> Override via `VITE_SP_LIST_*` only when the SharePoint site uses non-standard list titles.

## 3. Feature Flags

| Variable | Purpose | Required | Default | References | Notes |
| --- | --- | --- | --- | --- | --- |
| `VITE_FEATURE_SCHEDULES` | Master switch for the schedules feature. | No | `false` | `featureFlags.ts` | When off, schedules UI is hidden entirely. |
| `VITE_FEATURE_SCHEDULES_GRAPH` | Prefer Microsoft Graph for schedules data. | No | `false` | `env.schema.ts` | Requires proper Graph permissions. |
| `VITE_FEATURE_SCHEDULES_SP` | Prefer SharePoint lists for schedules data. | No | `false` | `env.schema.ts` | |
| `VITE_FEATURE_SCHEDULES_WEEK_V2` | Enable the new weekly view implementation. | No | `false` | `featureFlags.ts` | |
| `VITE_FEATURE_TODAY_OPS` | Enable the Today Ops continuous input mode. | No | `false` | `featureFlags.ts` | Route-gating flag for `/today`. |
| `VITE_FEATURE_USERS_CRUD` | Allow administrators to create, edit and delete users. | No | `false` | `env.schema.ts` | |
| `VITE_FEATURE_STAFF_ATTENDANCE` | Enable staff attendance tracking UI. | No | `false` | `featureFlags.ts` | |
| `VITE_FEATURE_ICEBERG_PDCA` | Expose the PDCA dashboard (audit improvement). | No | `false` | `featureFlags.ts` | Route-gating flag. |
| `VITE_FEATURE_COMPLIANCE_FORM` | Enable compliance and certification forms. | No | `false` | `featureFlags.ts` | |
| `VITE_FEATURE_HYDRATION_HUD` | Show hydration HUD for staff. | No | `false` | `env.schema.ts` | |
| `VITE_FEATURE_APPSHELL_VSCODE` | Use the experimental VS Code‑based app shell. | No | `false` | `env.schema.ts` | |
| `VITE_MEETING_PERSISTENCE_ENABLED` | Persist meeting logs to storage. | No | `false` | `env.schema.ts` | |
| `VITE_NURSE_SYNC_SP` | Enable synchronisation of nurse observations from SharePoint. | No | `false` | `env.schema.ts` | |
| `VITE_HANDOFF_STORAGE` | Storage backend for handoff data. | No | `"local"` | `env.schema.ts` | Schema default is `local`. |
| `VITE_STAFF_ATTENDANCE_STORAGE` | Storage backend for staff attendance records. | No | `"local"` | `env.schema.ts` | Schema default is `local`. |
| `VITE_DEMO_MODE` | Run the application in demonstration mode using fixture data. | No | `false` | `env.schema.ts` | Overrides authentication and data writes. |
| `VITE_FORCE_DEMO` | Force demonstration mode even when other env vars enable real data. | No | `false` | `env.schema.ts` | |

## 4. Schedules & Graph Tuning

| Variable | Purpose | Required | Default | References | Notes |
| --- | --- | --- | --- | --- | --- |
| `VITE_SCHEDULES_TZ` | IANA time zone used when displaying schedules. | No | `""` (falls back to `Asia/Tokyo` at runtime) | `env.schema.ts` | Changing this will affect date boundaries and offset calculations. |
| `VITE_SCHEDULES_WEEK_START` | First day of the week (0–6, where 0 = Sunday). | No | `1` (Monday) | `env.schema.ts` | |
| `VITE_SCHEDULES_CACHE_TTL` | Time‑to‑live for the schedules cache in seconds. | No | `60` | `env.schema.ts` | |
| `VITE_SCHEDULES_SAVE_MODE` | Where to store schedule edits. | No | `"real"` | `env.schema.ts` | Enum: `real` \| `mock`. |
| `VITE_GRAPH_RETRY_MAX` | Maximum number of retries for Graph API calls. | No | `2` | `env.schema.ts` | |
| `VITE_GRAPH_RETRY_BASE_MS` | Base delay in ms for Graph API retries. | No | `300` | `env.schema.ts` | |
| `VITE_GRAPH_RETRY_CAP_MS` | Maximum cap for Graph retry delays (ms). | No | `2000` | `env.schema.ts` | |

## 5. Debugging & Development Flags

| Variable | Purpose | Required | Default | References | Notes |
| --- | --- | --- | --- | --- | --- |
| `VITE_E2E` | Enable end‑to‑end test mode. | No | `false` | `env.schema.ts` | Enables MSAL mocks and disables real network calls. |
| `VITE_E2E_MSAL_MOCK` | Mock MSAL responses during E2E tests. | No | `false` | `env.schema.ts` | |
| `VITE_MSAL_MOCK` | Globally mock MSAL (auth) for development. | No | `false` | `env.schema.ts` | |
| `VITE_AUDIT_DEBUG` | Print verbose logs for audit tracking. | No | `false` | `env.schema.ts` | |
| `VITE_AUDIT_BATCH_SIZE` | Batch size when processing audit events. | No | `20` | `env.schema.ts` | |
| `VITE_AUDIT_RETRY_MAX` | Maximum audit write retries. | No | `3` | `env.schema.ts` | |
| `VITE_AUDIT_RETRY_BASE` | Base delay for audit retries (ms). | No | `500` | `env.schema.ts` | |
| `VITE_DEV` | Enable developer mode features. | No | `false` | `env.schema.ts` | |
| `VITE_DEBUG_ENV` | Print parsed environment configuration on startup. | No | `false` | `env.schema.ts` | |
| `VITE_E2E_ENFORCE_AUDIENCE` | Enforce strict audience validation during E2E. | No | `false` | `env.schema.ts` | |
| `VITE_HANDOFF_DEBUG` | Debug logging for the handoff feature. | No | `false` | `env.schema.ts` | |
| `VITE_ENABLE_MEETING_LOG` | Enable logging of meeting events. | No | `false` | `env.schema.ts` | |
| `VITE_MEETING_LOG_MASK_USER` | Mask user identifiers in meeting logs. | No | `false` | `env.schema.ts` | Schema default is `false`. |
| `VITE_SCHEDULES_DEBUG` | Debug logging for the schedules feature. | No | `false` | `env.schema.ts` | |
| `VITE_STAFF_ATTENDANCE_WRITE` | Allow writing staff attendance data. | No | `false` | `env.schema.ts` | |
| `VITE_WRITE_ENABLED` | Globally allow write operations. | No | `true` | `env.schema.ts` | Forbid writes by setting to `false`. |
| `VITE_ALLOW_WRITE_FALLBACK` | Fall back to an alternative storage provider if writes fail. | No | `false` | `env.schema.ts` | |

## 6. Identifiers & Metadata

| Variable | Purpose | Required | Default | References | Notes |
| --- | --- | --- | --- | --- | --- |
| `VITE_AAD_ADMIN_GROUP_ID` | Object ID of the Azure AD group that grants admin privileges. | Yes when RBAC is enforced | – | `env.schema.ts`, `useUserAuthz.ts` | Members of this group can manage the system. |
| `VITE_AAD_RECEPTION_GROUP_ID` | Object ID of the Azure AD group that grants reception/staff privileges. | Yes when RBAC is enforced | – | `env.schema.ts`, `useUserAuthz.ts` | |
| `VITE_ADMIN_GROUP_ID` | Legacy alias for admin group ID. | No | – | `env.schema.ts` | |
| `VITE_RECEPTION_GROUP_ID` | Legacy alias for reception group ID. | No | – | `env.schema.ts` | |
| `VITE_APP_ENV` | Application environment name (e.g. `development`, `staging`, `production`). | No | `"development"` | `env.schema.ts` | |
| `VITE_APP_VERSION` | The semantic version of the deployed app. | No | `"0.1.0"` | `env.schema.ts` | |

## 7. Service Record & Facility Parameters

| Variable | Purpose | Required | Default | References | Notes |
| --- | --- | --- | --- | --- | --- |
| `VITE_ATTENDANCE_DISCREPANCY_THRESHOLD` | Discrepancy threshold (as a float). | No | `0.75` | `env.schema.ts` | Must be positive; used by `serviceRecords.ts`. |
| `VITE_ABSENCE_MONTHLY_LIMIT` | Maximum number of absences allowed per month. | No | `4` | `env.schema.ts` | Must be an integer. |
| `VITE_FACILITY_CLOSE_TIME` | Time of day the facility officially closes, formatted `HH:mm`. | No | `"18:00"` | `env.schema.ts` | Validated against `HH:MM` 24h format. |
| `VITE_FACILITY_NAME` | 事業所名。AI 요約プロンプト等に埋め込まれる。 | No | `""` | `src/lib/env.ts` | 未設定の場合は空文字のままで動作する。 |

## 8. Firebase & Firestore

| Variable | Purpose | Required | Default | References | Notes |
| --- | --- | --- | --- | --- | --- |
| `VITE_FIREBASE_API_KEY` | Firebase API key. | When using Firebase | – | `env.schema.ts` | Never commit real keys to source control. |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain (e.g. `<project>.firebaseapp.com`). | When using Firebase | – | `env.schema.ts` | |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project identifier. | When using Firebase | – | `env.schema.ts` | |
| `VITE_FIREBASE_APP_ID` | Firebase application ID. | When using Firebase | – | `env.schema.ts` | |
| `VITE_FIREBASE_AUTH_MODE` | Authentication mode (e.g. `msal`, `custom`). | No | – | `env.schema.ts` | Use `custom` when exchanging tokens via backend. |
| `VITE_FIREBASE_TOKEN_EXCHANGE_URL` | API endpoint to exchange an MSAL token for a Firebase custom token. | No | – | `env.schema.ts` | Required only when auth mode is `custom`. |
| `VITE_FIREBASE_AUTH_ALLOW_ANON_FALLBACK` | Permit falling back to anonymous Firebase authentication. | No | `false` | `env.schema.ts` | |
| `VITE_FIRESTORE_USE_EMULATOR` | Use the local Firestore emulator. | No | `false` | `env.schema.ts` | Do not enable in production. |
| `VITE_FIRESTORE_EMULATOR_HOST` | Hostname of the Firestore emulator. | No | `"127.0.0.1"` | `env.schema.ts` | Effective only when emulator is enabled. |
| `VITE_FIRESTORE_EMULATOR_PORT` | Port number of the Firestore emulator. | No | `8080` | `env.schema.ts` | |

## 9. External Links

| Variable | Purpose | Required | Default | References | Notes |
| --- | --- | --- | --- | --- | --- |
| `VITE_TOKUSEI_FORMS_URL` | URL for Tokusei forms or other external questionnaires. | No | – | `env.schema.ts` | Optional URL validated by Zod. |

---

### Frequently Asked Questions

1. **Why are there so many feature flags?**
   Feature flags allow teams to enable or disable parts of the application independently. Set only those flags for features you intend to use; unset flags default to `false`.

2. **What happens if I omit a required variable?**
   Variables marked **Yes** in the **Required** column will trigger a runtime error during application startup or when the feature is invoked.

3. **Where do I set these variables?**
   Typically in a `.env.local` file at the root of the project. Use the `.env.example` as a starting point and consult this reference for descriptions and default values.

> [!IMPORTANT]
> All default values in this document are sourced from `src/lib/env.schema.ts` (verified 2026-03-08).
> If you find a discrepancy, the schema file is the authoritative source.

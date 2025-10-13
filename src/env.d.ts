/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MSAL_CLIENT_ID: string;
  readonly VITE_MSAL_TENANT_ID: string;
  readonly VITE_SP_RESOURCE: string;
  readonly VITE_SP_SITE_RELATIVE: string;

  readonly VITE_ALLOW_WRITE_FALLBACK?: string;
  readonly VITE_AUDIT_BATCH_SIZE?: string;
  readonly VITE_AUDIT_DEBUG?: string;
  readonly VITE_AUDIT_RETRY_BASE?: string;
  readonly VITE_AUDIT_RETRY_MAX?: string;
  readonly VITE_DEMO_MODE?: string;
  readonly VITE_E2E_MSAL_MOCK?: string;
  readonly VITE_FEATURE_COMPLIANCE_FORM?: string;
  readonly VITE_FEATURE_SCHEDULES_GRAPH?: string;
  readonly VITE_FEATURE_SCHEDULES?: string;
  readonly VITE_FEATURE_SCHEDULES_CREATE?: string;
  readonly VITE_FEATURE_SCHEDULE_STAFF_TEXT_COLUMNS?: string;
  readonly VITE_FEATURE_USERS_CRUD?: string;
  readonly VITE_GRAPH_RETRY_BASE_MS?: string;
  readonly VITE_GRAPH_RETRY_CAP_MS?: string;
  readonly VITE_GRAPH_RETRY_MAX?: string;
  readonly VITE_GRAPH_SCOPES?: string;
  readonly VITE_LOGIN_SCOPES?: string;
  readonly VITE_MSAL_AUTHORITY?: string;
  readonly VITE_MSAL_LOGIN_SCOPES?: string;
  readonly VITE_MSAL_REDIRECT_URI?: string;
  readonly VITE_MSAL_SCOPES?: string;
  readonly VITE_MSAL_TOKEN_REFRESH_MIN?: string;
  readonly VITE_RUNTIME_ENV_PATH?: string;
  readonly VITE_SCHEDULES_CACHE_TTL?: string;
  readonly VITE_SCHEDULES_TZ?: string;
  readonly VITE_SCHEDULES_WEEK_START?: string;
  readonly VITE_SKIP_LOGIN?: string;
  readonly VITE_SKIP_ENSURE_SCHEDULE?: string;
  readonly VITE_SP_LIST_ACTIVITY_DIARY?: string;
  readonly VITE_SP_LIST_DAILY?: string;
  readonly VITE_SP_LIST_SCHEDULES?: string;
  readonly VITE_SP_LIST_STAFF?: string;
  readonly VITE_SP_LIST_STAFF_GUID?: string;
  readonly VITE_SP_LIST_USERS?: string;
  readonly VITE_SP_LIST_PLAN_GOAL?: string;
  readonly VITE_SP_RETRY_BASE_MS?: string;
  readonly VITE_SP_RETRY_MAX?: string;
  readonly VITE_SP_RETRY_MAX_DELAY_MS?: string;
  readonly VITE_SP_SCOPE_DEFAULT?: string;
  readonly VITE_WRITE_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

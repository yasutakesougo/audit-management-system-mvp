/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MSAL_CLIENT_ID: string;
  readonly VITE_MSAL_TENANT_ID: string;
  readonly VITE_SP_RESOURCE: string;
  readonly VITE_SP_SITE_RELATIVE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

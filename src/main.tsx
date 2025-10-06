// src/main.tsx まるごと置き換え

import React from "react";
import ReactDOM from "react-dom/client";

type EnvRecord = Record<string, string | undefined>;

// --- dev用デバッグフィールドを window に生やす型定義 ---
declare global {
  interface Window {
    __ENV__?: EnvRecord;
    __FLAGS__?: unknown;
  }
}

const buildEnvFromImportMeta = (): EnvRecord => ({
  MODE: import.meta.env.MODE,
  BASE_URL: import.meta.env.BASE_URL,
  VITE_MSAL_CLIENT_ID: import.meta.env.VITE_MSAL_CLIENT_ID,
  VITE_MSAL_TENANT_ID: import.meta.env.VITE_MSAL_TENANT_ID,
  VITE_MSAL_REDIRECT_URI: import.meta.env.VITE_MSAL_REDIRECT_URI,
  VITE_MSAL_AUTHORITY: import.meta.env.VITE_MSAL_AUTHORITY,
  VITE_SP_BASE_URL: import.meta.env.VITE_SP_BASE_URL,
  VITE_SP_SITE_RELATIVE: import.meta.env.VITE_SP_SITE_RELATIVE,
  VITE_FEATURE_SCHEDULES: import.meta.env.VITE_FEATURE_SCHEDULES,
  VITE_SP_RESOURCE: import.meta.env.VITE_SP_RESOURCE,
  VITE_LOGIN_SCOPES: import.meta.env.VITE_LOGIN_SCOPES,
  VITE_MSAL_SCOPES: import.meta.env.VITE_MSAL_SCOPES,
  VITE_RUNTIME_ENV_PATH: import.meta.env.VITE_RUNTIME_ENV_PATH,
});

const getRuntimeEnvPath = (runtimeEnv: EnvRecord): string => {
  if (typeof window === "undefined") return "";
  const fromWindow = window.__ENV__?.RUNTIME_ENV_PATH ?? window.__ENV__?.VITE_RUNTIME_ENV_PATH;
  const fromRuntime = runtimeEnv.RUNTIME_ENV_PATH ?? runtimeEnv.VITE_RUNTIME_ENV_PATH;
  return fromWindow || fromRuntime || import.meta.env.VITE_RUNTIME_ENV_PATH || "/env.runtime.json";
};

const loadRuntimeEnvFile = async (runtimeEnv: EnvRecord): Promise<EnvRecord> => {
  if (typeof window === "undefined") return {};
  const path = getRuntimeEnvPath(runtimeEnv);
  if (!path) return {};

  try {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn(`[env] runtime config fetch failed: ${response.status} ${response.statusText}`);
      }
      return {};
    }

    const data = (await response.json()) as EnvRecord;
    return data ?? {};
  } catch (error) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn("[env] runtime config fetch error", error);
    }
    return {};
  }
};

const RUNTIME_PATH_KEYS = new Set(["RUNTIME_ENV_PATH", "VITE_RUNTIME_ENV_PATH"]);

const ensureRuntimeEnv = async (): Promise<EnvRecord> => {
  if (typeof window === "undefined") return {};

  const existing = window.__ENV__ ?? {};
  const fromImportMeta = buildEnvFromImportMeta();
  const hasRuntimeOverrides = Object.keys(existing).some((key) => !RUNTIME_PATH_KEYS.has(key));
  const runtimeOverrides = hasRuntimeOverrides
    ? existing
    : { ...existing, ...(await loadRuntimeEnvFile({ ...fromImportMeta, ...existing })) };

  const merged = { ...fromImportMeta, ...runtimeOverrides } satisfies EnvRecord;
  window.__ENV__ = merged;

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.info("[env]", merged);
  }

  return merged;
};

// 以降の重い import は動的にまとめて実行
(async () => {
  await ensureRuntimeEnv();

  const [{ ConfigErrorBoundary }, { auditLog }, { FeatureFlagsProvider, getFeatureFlags }] = await Promise.all([
    import("./app/ConfigErrorBoundary"),
    import("./lib/debugLogger"),
    import("./config/featureFlags"),
  ]);

  // metrics は副作用のみ
  await import("./metrics");

  // App は最後に
  const { default: App } = await import("./App");

  const flags = getFeatureFlags();
  auditLog.info("flags", flags);
  if (typeof window !== "undefined" && import.meta.env.MODE !== "production") {
    window.__FLAGS__ = flags;
    // eslint-disable-next-line no-console
    console.info("[flags]", flags);
  }

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <ConfigErrorBoundary>
        <FeatureFlagsProvider>
          <App />
        </FeatureFlagsProvider>
      </ConfigErrorBoundary>
    </React.StrictMode>
  );
})().catch((e) => {
  // 起動時の例外も気づけるように
  // eslint-disable-next-line no-console
  console.error("[bootstrap error]", e);
});
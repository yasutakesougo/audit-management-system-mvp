// src/main.tsx まるごと置き換え

import React from "react";
import ReactDOM from "react-dom/client";
import { getRuntimeEnv, isDev } from "./env";

type EnvRecord = Record<string, string | undefined>;

// --- dev用デバッグフィールドを window に生やす型定義 ---
declare global {
  interface Window {
    __ENV__?: EnvRecord;
    __FLAGS__?: unknown;
  }
}

const getRuntimeEnvPath = (runtimeEnv: EnvRecord): string => {
  if (typeof window === "undefined") return "";
  const fromWindow = window.__ENV__?.RUNTIME_ENV_PATH ?? window.__ENV__?.VITE_RUNTIME_ENV_PATH;
  const fromRuntime = runtimeEnv.RUNTIME_ENV_PATH ?? runtimeEnv.VITE_RUNTIME_ENV_PATH;
  return fromWindow || fromRuntime || "/env.runtime.json";
};

const loadRuntimeEnvFile = async (runtimeEnv: EnvRecord): Promise<EnvRecord> => {
  if (typeof window === "undefined") return {};
  const path = getRuntimeEnvPath(runtimeEnv);
  if (!path) return {};

  try {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) {
      if (isDev) {
        // eslint-disable-next-line no-console
        console.warn(`[env] runtime config fetch failed: ${response.status} ${response.statusText}`);
      }
      return {};
    }

    const data = (await response.json()) as EnvRecord;
    return data ?? {};
  } catch (error) {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.warn("[env] runtime config fetch error", error);
    }
    return {};
  }
};

const RUNTIME_PATH_KEYS = new Set(["RUNTIME_ENV_PATH", "VITE_RUNTIME_ENV_PATH"]);

const ensureRuntimeEnv = async (): Promise<EnvRecord> => {
  const baseEnv = getRuntimeEnv();

  if (typeof window === "undefined") {
    return baseEnv;
  }

  const existing = window.__ENV__ ?? {};
  const hasRuntimeOverrides = Object.keys(existing).some((key) => !RUNTIME_PATH_KEYS.has(key));
  const runtimeOverrides = hasRuntimeOverrides
    ? { ...existing }
    : await loadRuntimeEnvFile({ ...baseEnv, ...existing });

  const merged = { ...baseEnv, ...runtimeOverrides } satisfies EnvRecord;
  window.__ENV__ = merged;

  if (isDev) {
    // eslint-disable-next-line no-console
    console.info("[env]", merged);
  }

  return merged;
};

// 以降の重い import は動的にまとめて実行
(async () => {
  const envSnapshot = await ensureRuntimeEnv();

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
  if (typeof window !== "undefined" && (envSnapshot.MODE ?? "").toLowerCase() !== "production") {
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
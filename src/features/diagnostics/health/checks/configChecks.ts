import { HealthCheckResult, HealthContext } from "../types";
import { getRuntimeEnv } from "@/env";
import { pass, fail, warn, pickEnvKeys, hasPlaceholder, isEnabled } from "./utils";

export async function runConfigChecks(
  ctx: HealthContext,
  results: HealthCheckResult[]
): Promise<boolean> {
  // --- A) Config ---
  {
    const required = ["VITE_SP_RESOURCE", "VITE_MSAL_CLIENT_ID", "VITE_MSAL_TENANT_ID"];
    const missing = required.filter((k) => !ctx.env[k]);
    if (missing.length === 0) {
      results.push(
        pass({
          key: "config.requiredEnv",
          label: "必須環境変数",
          category: "config",
          summary: "必須の環境変数は揃っています。",
          evidence: pickEnvKeys(ctx.env, required),
          detail: `Required keys checked: ${required.join(", ")}`,
        })
      );
    } else {
      results.push(
        fail({
          key: "config.requiredEnv",
          label: "必須環境変数",
          category: "config",
          summary: `必須の環境変数が不足しています: ${missing.join(", ")}`,
          evidence: { missing },
          detail: "環境変数（.env / runtime env）を設定してください。",
          nextActions: [
            {
              kind: "doc",
              label: "環境設定テンプレ",
              value: "env/templates/.env.production.flags",
            },
          ],
        })
      );
    }
  }

  {
    const placeholderHits = Object.entries(ctx.env).filter(
      ([k, v]) =>
        typeof v === "string" &&
        hasPlaceholder(v) &&
        /tenant|site|url/i.test(k)
    );
    if (placeholderHits.length === 0) {
      results.push(
        pass({
          key: "config.placeholder",
          label: "テンプレ値残存チェック",
          category: "config",
          summary:
            "テンプレ値（<yourtenant> 等）の残存は見つかりませんでした。",
        })
      );
    } else {
      results.push(
        fail({
          key: "config.placeholder",
          label: "テンプレ値残存チェック",
          category: "config",
          summary:
            "テンプレ値が残っています。環境変数を本番値に置き換えてください。",
          evidence: { hits: placeholderHits },
          detail: "初期導入で最も多い事故パターンです。",
        })
      );
    }
  }

  {
    const runtimeEnvObj = typeof window !== "undefined"
      ? (() => { const env = getRuntimeEnv(); return Object.keys(env).length > 0 ? env : null; })()
      : null;
    if (runtimeEnvObj) {
      results.push(
        pass({
          key: "config.runtimeEnv",
          label: "ランタイム環境変数",
          category: "config",
          summary: "ランタイム環境変数が読み込まれています。",
          evidence: {
            keys: Object.keys(runtimeEnvObj).slice(0, 5),
          },
        })
      );
    } else {
      results.push(
        warn({
          key: "config.runtimeEnv",
          label: "ランタイム環境変数",
          category: "config",
          summary:
            "ランタイム環境変数が見つかりません（ビルド時 env のみで稼働中の可能性）。",
          detail: "将来の環境切替を考える場合は runtime env を推奨します。",
        })
      );
    }
  }

  {
    const e2eMockValue = String(ctx.env["VITE_E2E_MSAL_MOCK"] ?? "");
    const e2eMock = e2eMockValue === "true" || e2eMockValue === "1";
    if (ctx.isProductionLike && e2eMock) {
      results.push(
        fail({
          key: "config.e2eMockInProd",
          label: "本番でのE2Eモック混入",
          category: "config",
          summary:
            "本番相当環境で E2E モックが有効になっています。無効化してください。",
          evidence: { VITE_E2E_MSAL_MOCK: ctx.env["VITE_E2E_MSAL_MOCK"] },
        })
      );
    } else {
      results.push(
        pass({
          key: "config.e2eMockInProd",
          label: "本番でのE2Eモック混入",
          category: "config",
          summary: "E2E モックの状態は問題ありません。",
          evidence: {
            VITE_E2E_MSAL_MOCK: ctx.env["VITE_E2E_MSAL_MOCK"] ?? "(unset)",
          },
        })
      );
    }
  }

  // Mock / skip mode guard:
  {
    const skipSharePoint = isEnabled(ctx.env["VITE_SKIP_SHAREPOINT"]);
    const skipLogin = isEnabled(ctx.env["VITE_SKIP_LOGIN"]);
    const demoMode = isEnabled(ctx.env["VITE_DEMO_MODE"]) || isEnabled(ctx.env["VITE_DEMO"]);
    const e2eMode = isEnabled(ctx.env["VITE_E2E"]) || isEnabled(ctx.env["VITE_E2E_MSAL_MOCK"]);
    const dummyClientId = String(ctx.env["VITE_MSAL_CLIENT_ID"] ?? "").trim() === "00000000-0000-0000-0000-000000000000";
    const dummyTenantId = String(ctx.env["VITE_MSAL_TENANT_ID"] ?? "").trim().toLowerCase() === "dummy";

    const flags = {
      VITE_SKIP_SHAREPOINT: skipSharePoint,
      VITE_SKIP_LOGIN: skipLogin,
      VITE_DEMO_MODE: demoMode,
      VITE_E2E: e2eMode,
      VITE_E2E_MSAL_MOCK: isEnabled(ctx.env["VITE_E2E_MSAL_MOCK"]),
      dummyClientId,
      dummyTenantId,
    };

    if (skipSharePoint || skipLogin || demoMode || e2eMode || dummyClientId || dummyTenantId) {
      results.push(
        fail({
          key: "config.mockOrBypassMode",
          label: "診断モード不一致（Mock/Bypass）",
          category: "config",
          summary:
            "SharePoint 実環境診断を実行できないモードです（Mock/Bypass が有効、またはダミー認証情報）。",
          detail:
            "VITE_SKIP_SHAREPOINT=0, VITE_SKIP_LOGIN=0, VITE_DEMO_MODE=0, VITE_E2E_MSAL_MOCK=0 に設定し、実テナントの Client/Tenant ID を設定して再実行してください。",
          evidence: flags,
          nextActions: [
            {
              kind: "copy",
              label: "再診断前の必須設定",
              value:
                "VITE_SKIP_SHAREPOINT=0 / VITE_SKIP_LOGIN=0 / VITE_DEMO_MODE=0 / VITE_E2E_MSAL_MOCK=0 / VITE_MSAL_CLIENT_ID=<real-guid> / VITE_MSAL_TENANT_ID=<tenant-guid>",
            },
          ],
        })
      );
      return false; // Stop further checks
    }
  }

  return true;
}

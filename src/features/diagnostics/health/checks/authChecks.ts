import { HealthCheckResult, HealthContext } from "../types";
import { SpAdapter } from "../spAdapter";
import { pass, fail, warn, safe, isMockOrBypassMode } from "./utils";

export type AuthConnectivityCheckSummary = {
  currentUserStatus: "pass" | "warn" | "fail";
  currentUserDetail?: string;
  webStatus: "pass" | "warn" | "fail";
  webDetail?: string;
};

export async function runAuthAndConnectivityChecks(
  ctx: HealthContext,
  sp: SpAdapter,
  results: HealthCheckResult[]
): Promise<AuthConnectivityCheckSummary> {
  const isMockOrBypass = isMockOrBypassMode(ctx.env);
  let currentUserStatus: "pass" | "warn" | "fail" = "fail";
  let currentUserDetail: string | undefined;
  let webStatus: "pass" | "warn" | "fail" = "fail";
  let webDetail: string | undefined;

  // --- B) Auth / Connectivity ---
  const currentUser = isMockOrBypass
    ? { ok: true as const, v: { title: "Mock Test User", email: "mock@example.com" } }
    : await safe(() => sp.getCurrentUser());
  if (!currentUser.ok) {
    if (currentUser.isThrottled) {
      results.push(
        warn({
          key: "auth.currentUser",
          label: "認証（currentUser）",
          category: "auth",
          summary:
            "SharePoint 側の一時的なスロットリングを検知しました。",
          detail: `SharePoint throttling detected. This is treated as an external transient condition. Retry after the tenant recovers. (Error: ${currentUser.err})`,
          nextActions: [
            {
              kind: "doc",
              label: "時間をおいて再実行する（スロットリングは一時エラー）",
              value: "Health 診断を 5〜10 分後に再実行してください。",
            },
          ],
        })
      );
      currentUserStatus = "warn";
      currentUserDetail = currentUser.err;
    } else {
      results.push(
        fail({
          key: "auth.currentUser",
          label: "認証（currentUser）",
          category: "auth",
          summary:
            "サインイン状態の確認に失敗しました（SharePoint API）。",
          detail: currentUser.err,
          nextActions: [
            {
              kind: "doc",
              label: "権限/同意の確認手順",
              value:
                "docs/security/msal.md, README.md > Azure AD / MSAL configuration",
            },
          ],
        })
      );
      currentUserStatus = "fail";
      currentUserDetail = currentUser.err;
    }
  } else {
    results.push(
      pass({
        key: "auth.currentUser",
        label: "認証（currentUser）",
        category: "auth",
        summary: `サインインを確認しました：${currentUser.v.title ?? "(unknown)"}`,
        evidence: currentUser.v,
      })
    );
    currentUserStatus = "pass";
  }

  const webTitle = isMockOrBypass
    ? { ok: true as const, v: "Mock SharePoint Site" }
    : await safe(() => sp.getWebTitle());
  if (!webTitle.ok) {
    if (webTitle.isThrottled) {
      results.push(
        warn({
          key: "connectivity.web",
          label: "サイト到達（web title）",
          category: "connectivity",
          summary: "SharePoint 側の一時的なスロットリングを検知しました。",
          detail: `SharePoint throttling detected. This is treated as an external transient condition. Retry after the tenant recovers. (Error: ${webTitle.err})`,
          evidence: { siteUrl: ctx.siteUrl },
        })
      );
      webStatus = "warn";
      webDetail = webTitle.err;
    } else {
      results.push(
        fail({
          key: "connectivity.web",
          label: "サイト到達（web title）",
          category: "connectivity",
          summary: "SharePoint サイトに到達できません。",
          detail: webTitle.err,
          evidence: { siteUrl: ctx.siteUrl },
        })
      );
      webStatus = "fail";
      webDetail = webTitle.err;
    }
  } else {
    results.push(
      pass({
        key: "connectivity.web",
        label: "サイト到達（web title）",
        category: "connectivity",
        summary: `サイトに到達しました：${webTitle.v}`,
        evidence: { siteUrl: ctx.siteUrl, webTitle: webTitle.v },
      })
    );
    webStatus = "pass";
  }

  return {
    currentUserStatus,
    currentUserDetail,
    webStatus,
    webDetail,
  };
}

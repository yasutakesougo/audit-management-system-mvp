import { HealthCheckResult, HealthContext } from "../types";
import { SpAdapter } from "../spAdapter";
import { pass, fail, safe } from "./utils";

export type AuthConnectivityCheckSummary = {
  currentUserStatus: "pass" | "fail";
  currentUserDetail?: string;
  webStatus: "pass" | "fail";
  webDetail?: string;
};

export async function runAuthAndConnectivityChecks(
  ctx: HealthContext,
  sp: SpAdapter,
  results: HealthCheckResult[]
): Promise<AuthConnectivityCheckSummary> {
  const isSkipSharePoint = ctx.env["VITE_SKIP_SHAREPOINT"] === "1";
  let currentUserStatus: "pass" | "fail" = "fail";
  let currentUserDetail: string | undefined;
  let webStatus: "pass" | "fail" = "fail";
  let webDetail: string | undefined;

  // --- B) Auth / Connectivity ---
  const currentUser = isSkipSharePoint
    ? { ok: true as const, v: { title: "Mock Test User", email: "mock@example.com" } }
    : await safe(() => sp.getCurrentUser());
  if (!currentUser.ok) {
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

  const webTitle = isSkipSharePoint
    ? { ok: true as const, v: "Mock SharePoint Site" }
    : await safe(() => sp.getWebTitle());
  if (!webTitle.ok) {
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

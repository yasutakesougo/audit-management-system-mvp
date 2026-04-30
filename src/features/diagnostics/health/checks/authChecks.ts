import { HealthCheckResult, HealthContext } from "../types";
import { SpAdapter } from "../spAdapter";
import { pass, fail, safe } from "./utils";

export async function runAuthAndConnectivityChecks(
  ctx: HealthContext,
  sp: SpAdapter,
  results: HealthCheckResult[]
): Promise<void> {
  // --- B) Auth / Connectivity ---
  const currentUser = await safe(() => sp.getCurrentUser());
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
  }

  const webTitle = await safe(() => sp.getWebTitle());
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
  }
}

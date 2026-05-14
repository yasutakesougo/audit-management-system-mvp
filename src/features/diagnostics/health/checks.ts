import { HealthCheckResult, HealthContext } from "./types";
import { SpAdapter } from "./spAdapter";
import { runConfigChecks } from "./checks/configChecks";
import { runAuthAndConnectivityChecks } from "./checks/authChecks";
import { runAllListChecks } from "./checks/listChecks";
import { warn } from "./checks/utils";

export type HealthCheckAuthGate = {
  hasActiveAccount: boolean;
  tokenReady: boolean;
  tokenPending: boolean;
};

/**
 * 統合 Health 診断実行。
 * 各カテゴリ別のチェックモジュールを順次呼び出し、結果を収集する。
 */
export async function runHealthChecks(
  ctx: HealthContext,
  sp: SpAdapter,
  authGate?: HealthCheckAuthGate
): Promise<HealthCheckResult[]> {
  const results: HealthCheckResult[] = [];

  // A) Config 系チェック（依存関係のベースとなるため最初に実行）
  const configOk = await runConfigChecks(ctx, results);
  
  // モック/バイパスモードなどで診断不可能な場合は、ここで打ち切る
  if (!configOk) {
    return results;
  }

  if (authGate && (!authGate.hasActiveAccount || !authGate.tokenReady || authGate.tokenPending)) {
    results.push(
      warn({
        key: "auth.tokenReadiness",
        label: "認証トークン準備状態",
        category: "auth",
        summary: "診断を保留しました。認証トークンの準備が完了していません。",
        detail: "AUTH_TOKEN_NOT_READY",
        evidence: {
          hasActiveAccount: authGate.hasActiveAccount,
          tokenReady: authGate.tokenReady,
          tokenPending: authGate.tokenPending,
        },
      })
    );
    results.push(
      warn({
        key: "lists.authGate",
        label: "リスト/スキーマ診断の実行可否",
        category: "lists",
        summary: "認証準備待ちのため、リスト/スキーマ/権限チェックをスキップしました。",
        detail: "SKIPPED_AUTH_REQUIRED",
        evidence: {
          skippedCategories: ["lists", "schema", "permissions"],
        },
      })
    );
    return results;
  }

  // B) 認証・接続性チェック
  const authSummary = await runAuthAndConnectivityChecks(ctx, sp, results);
  if (
    authSummary.currentUserStatus === "fail" &&
    typeof authSummary.currentUserDetail === "string" &&
    authSummary.currentUserDetail.includes("AUTH_REQUIRED")
  ) {
    results.push(
      warn({
        key: "lists.authGate",
        label: "リスト/スキーマ診断の実行可否",
        category: "lists",
        summary: "AUTH_REQUIRED 検出のため、リスト/スキーマ/権限チェックをスキップしました。",
        detail: "SKIPPED_AUTH_REQUIRED",
        evidence: {
          skippedCategories: ["lists", "schema", "permissions"],
          blocker: "auth.currentUser",
        },
      })
    );
    return results;
  }

  // D/E) リスト・スキーマ・権限チェック（全てのリストに対してループ実行）
  await runAllListChecks(ctx, sp, results);

  return results;
}

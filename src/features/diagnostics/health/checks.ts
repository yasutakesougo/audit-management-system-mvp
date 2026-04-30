import { HealthCheckResult, HealthContext } from "./types";
import { SpAdapter } from "./spAdapter";
import { runConfigChecks } from "./checks/configChecks";
import { runAuthAndConnectivityChecks } from "./checks/authChecks";
import { runAllListChecks } from "./checks/listChecks";

/**
 * 統合 Health 診断実行。
 * 各カテゴリ別のチェックモジュールを順次呼び出し、結果を収集する。
 */
export async function runHealthChecks(
  ctx: HealthContext,
  sp: SpAdapter
): Promise<HealthCheckResult[]> {
  const results: HealthCheckResult[] = [];

  // A) Config 系チェック（依存関係のベースとなるため最初に実行）
  const configOk = await runConfigChecks(ctx, results);
  
  // モック/バイパスモードなどで診断不可能な場合は、ここで打ち切る
  if (!configOk) {
    return results;
  }

  // B) 認証・接続性チェック
  await runAuthAndConnectivityChecks(ctx, sp, results);

  // D/E) リスト・スキーマ・権限チェック（全てのリストに対してループ実行）
  await runAllListChecks(ctx, sp, results);

  return results;
}

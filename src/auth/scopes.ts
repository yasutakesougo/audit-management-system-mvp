import {
    getConfiguredMsalScopes,
    getMsalLoginScopes,
    getSharePointDefaultScope,
    type EnvRecord,
} from '../lib/env';

/**
 * MSAL の要求スコープを構築するユーティリティ。
 * 優先順位:
 *   1. 環境変数由来（カンマ/空白区切りを許容）
 *   2. 何も無ければ `VITE_SP_SCOPE_DEFAULT` を要求
 * 補足:
 *   - SharePoint リソースが解決できない場合は例外を送出
 *   - 戻り値は重複除去で安定化
 */
export const buildMsalScopes = (
  envOverride?: EnvRecord
): string[] => {
  // 1) 明示スコープ（VITE_MSAL_SCOPES 等）があればそれを使う
  const fromEnv = getConfiguredMsalScopes(envOverride);

  if (fromEnv.length > 0) {
    return normalizeScopes(fromEnv);
  }

  const loginScopes = getMsalLoginScopes(envOverride);
  const spDefault = getSharePointDefaultScope(envOverride);
  const all = [...loginScopes];
  if (spDefault) all.push(spDefault);
  return normalizeScopes(all);
};

function normalizeScopes(scopes: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const raw of scopes) {
    const trimmed = raw?.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

import {
  HealthCheckResult,
  HealthContext,
  HealthStatus,
  ListSpec,
} from "./types";
import { SpAdapter } from "./spAdapter";

const statusRank: Record<HealthStatus, number> = { pass: 0, warn: 1, fail: 2 };
const _worst = (a: HealthStatus, b: HealthStatus): HealthStatus =>
  statusRank[a] >= statusRank[b] ? a : b;

function pass(
  base: Omit<HealthCheckResult, "status" | "nextActions"> & {
    nextActions?: HealthCheckResult["nextActions"];
  }
): HealthCheckResult {
  return { ...base, status: "pass", nextActions: base.nextActions ?? [] };
}
function warn(
  base: Omit<HealthCheckResult, "status" | "nextActions"> & {
    nextActions?: HealthCheckResult["nextActions"];
  }
): HealthCheckResult {
  return { ...base, status: "warn", nextActions: base.nextActions ?? [] };
}
function fail(
  base: Omit<HealthCheckResult, "status" | "nextActions"> & {
    nextActions?: HealthCheckResult["nextActions"];
  }
): HealthCheckResult {
  return { ...base, status: "fail", nextActions: base.nextActions ?? [] };
}

function stringifyErr(e: unknown) {
  if (e instanceof Error) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

function hasPlaceholder(v: unknown) {
  const s = String(v ?? "");
  return (
    s.includes("<yourtenant>") ||
    s.includes("<yoursite>") ||
    s.includes("yourtenant") ||
    s.includes("yoursite")
  );
}

function pickEnvKeys(env: Record<string, unknown>, keys: string[]) {
  const out: Record<string, unknown> = {};
  for (const k of keys) out[k] = env[k];
  return out;
}

async function safe<T>(
  fn: () => Promise<T>
): Promise<{ ok: true; v: T } | { ok: false; err: string }> {
  try {
    return { ok: true, v: await fn() };
  } catch (e) {
    return { ok: false, err: stringifyErr(e) };
  }
}

export async function runHealthChecks(
  ctx: HealthContext,
  sp: SpAdapter
): Promise<HealthCheckResult[]> {
  const results: HealthCheckResult[] = [];

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
    const runtimeEnv = typeof window !== "undefined"
      ? (window as unknown as Record<string, unknown>).__ENV__ ?? null
      : null;
    if (runtimeEnv) {
      results.push(
        pass({
          key: "config.runtimeEnv",
          label: "ランタイム環境変数",
          category: "config",
          summary: "ランタイム環境変数が読み込まれています。",
          evidence: {
            keys:
              typeof runtimeEnv === "object" && runtimeEnv !== null
                ? Object.keys(runtimeEnv as Record<string, unknown>).slice(0, 5)
                : [],
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
    const e2eMock = Boolean(ctx.env["VITE_E2E_MSAL_MOCK"] ?? false);
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

  // --- D/E) Lists, Schema, Permissions (CRUD) ---
  for (const spec of ctx.listSpecs) {
    await runListChecks(results, sp, spec);
  }

  return results;
}

async function runListChecks(
  results: HealthCheckResult[],
  sp: SpAdapter,
  spec: ListSpec
) {
  // List existence
  const listInfo = await safe(() => sp.getListByTitle(spec.displayName));
  if (!listInfo.ok) {
    results.push(
      fail({
        key: `lists.exists.${spec.key}`,
        label: `リスト存在：${spec.displayName}`,
        category: "lists",
        summary: `リストが見つかりません（${spec.displayName}）。`,
        detail: listInfo.err,
        evidence: { listKey: spec.key, listTitle: spec.displayName },
        nextActions: [
          {
            kind: "doc",
            label: "provision 手順",
            value: "provision/README.md",
          },
        ],
      })
    );
    return;
  } else {
    results.push(
      pass({
        key: `lists.exists.${spec.key}`,
        label: `リスト存在：${spec.displayName}`,
        category: "lists",
        summary: "リストが見つかりました。",
        evidence: listInfo.v,
      })
    );
  }

  // Schema fields
  const fields = await safe(() => sp.getFields(spec.displayName));
  if (!fields.ok) {
    results.push(
      fail({
        key: `schema.fields.${spec.key}`,
        label: `スキーマ：${spec.displayName}`,
        category: "schema",
        summary: "列（フィールド）情報の取得に失敗しました。",
        detail: fields.err,
        evidence: { listTitle: spec.displayName },
      })
    );
  } else {
    const present = new Set(fields.v.map((f) => f.internalName));
    const missing = spec.requiredFields.filter(
      (f) => !present.has(f.internalName)
    );
    if (missing.length === 0) {
      results.push(
        pass({
          key: `schema.fields.${spec.key}`,
          label: `スキーマ：${spec.displayName}`,
          category: "schema",
          summary: "必須列は揃っています。",
          evidence: {
            required: spec.requiredFields,
            totalFields: fields.v.length,
          },
        })
      );
    } else {
      results.push(
        fail({
          key: `schema.fields.${spec.key}`,
          label: `スキーマ：${spec.displayName}`,
          category: "schema",
          summary: `必須列が不足しています：${missing
            .map((m) => m.internalName)
            .join(", ")}`,
          detail:
            "列の追加・型違いが疑われます（手動編集や旧スキーマ）。",
          evidence: { missing, totalFields: fields.v.length },
          nextActions: [
            {
              kind: "doc",
              label: "スキーマ更新（provision apply）",
              value: "provision/README.md",
            },
          ],
        })
      );
    }
  }

  // Permissions: Read
  const read = await safe(() => sp.getItemsTop1(spec.displayName));
  if (!read.ok) {
    results.push(
      fail({
        key: `permissions.read.${spec.key}`,
        label: `権限：Read（${spec.displayName}）`,
        category: "permissions",
        summary: "閲覧（Read）に失敗しました。",
        detail: read.err,
        evidence: { listTitle: spec.displayName },
      })
    );
  } else {
    results.push(
      pass({
        key: `permissions.read.${spec.key}`,
        label: `権限：Read（${spec.displayName}）`,
        category: "permissions",
        summary: "閲覧（Read）を確認しました。",
        evidence: { sampleCount: read.v.length },
      })
    );
  }

  // Permissions: Create/Update/Delete (safe test item)
  // 事故防止：healthcheck 用の識別フラグを body に混ぜる
  const stamp = new Date().toISOString();
  const createBody = { ...spec.createItem };
  if (typeof createBody["Title"] === "string") {
    createBody["Title"] = `[healthcheck] ${createBody["Title"]} ${stamp}`;
  } else {
    createBody["Title"] = `[healthcheck] ${stamp}`;
  }

  const created = await safe(() =>
    sp.createItem(spec.displayName, createBody)
  );
  if (!created.ok) {
    results.push(
      fail({
        key: `permissions.create.${spec.key}`,
        label: `権限：Create（${spec.displayName}）`,
        category: "permissions",
        summary: "作成（Create）に失敗しました。",
        detail: created.err,
        evidence: { listTitle: spec.displayName },
      })
    );
    return;
  } else {
    results.push(
      pass({
        key: `permissions.create.${spec.key}`,
        label: `権限：Create（${spec.displayName}）`,
        category: "permissions",
        summary: "作成（Create）を確認しました。",
        evidence: { id: created.v.id },
      })
    );
  }

  const updated = await safe(() =>
    sp.updateItem(spec.displayName, created.v.id, spec.updateItem)
  );
  if (!updated.ok) {
    results.push(
      fail({
        key: `permissions.update.${spec.key}`,
        label: `権限：Update（${spec.displayName}）`,
        category: "permissions",
        summary: "更新（Update）に失敗しました。",
        detail: updated.err,
        evidence: { id: created.v.id },
      })
    );
  } else {
    results.push(
      pass({
        key: `permissions.update.${spec.key}`,
        label: `権限：Update（${spec.displayName}）`,
        category: "permissions",
        summary: "更新（Update）を確認しました。",
        evidence: { id: created.v.id },
      })
    );
  }

  const deleted = await safe(() =>
    sp.deleteItem(spec.displayName, created.v.id)
  );
  if (!deleted.ok) {
    // ⚠️ Delete は運用上 NGの組織もあり得るため WARN とする（FAIL ではなく）
    results.push(
      warn({
        key: `permissions.delete.${spec.key}`,
        label: `権限：Delete（${spec.displayName}）`,
        category: "permissions",
        summary:
          "削除（Delete）に失敗しました（運用上これが許容される場合もあります）。",
        detail: deleted.err,
        evidence: { id: created.v.id },
        nextActions: [
          {
            kind: "copy",
            label: "管理者に確認: 削除権限の可否",
            value:
              "Delete 権限が運用方針で不要な場合もあります。管理者に確認ください。",
          },
        ],
      })
    );
  } else {
    results.push(
      pass({
        key: `permissions.delete.${spec.key}`,
        label: `権限：Delete（${spec.displayName}）`,
        category: "permissions",
        summary: "削除（Delete）を確認しました。",
        evidence: { id: created.v.id },
      })
    );
  }
}

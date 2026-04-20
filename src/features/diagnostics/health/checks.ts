import {
  HealthCheckResult,
  HealthContext,
  HealthStatus,
  ListSpec,
  SpFieldSpec,
} from "./types";
import { resolveInternalNamesDetailed, ResolutionResult } from '@/lib/sp/helpers';
import { SpAdapter } from "./spAdapter";
import { getRuntimeEnv } from "@/env";
import { emitDriftRecord, type DriftResolutionType, type DriftType } from '@/features/diagnostics/drift/domain/driftLogic';
import { decideGovernanceAction } from '@/features/diagnostics/governance/governanceEngine';

// statusRank is retained for potential future worst-of aggregation.
const _statusRank: Record<HealthStatus, number> = { pass: 0, warn: 1, fail: 2 };
void _statusRank; // suppress unused warning — kept for schema reference

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
  for (const spec of ctx.listSpecs()) {
    await runListChecks(results, sp, spec, ctx);
  }

  return results;
}

async function runListChecks(
  results: HealthCheckResult[],
  sp: SpAdapter,
  spec: ListSpec,
  ctx: HealthContext
) {
  let fieldStatus: ResolutionResult<string>['fieldStatus'] = {};

  // List existence
  const listInfo = await safe(() => sp.getListByTitle(spec.resolvedTitle));
  if (!listInfo.ok) {
    if (spec.isOptional) {
      results.push(
        warn({
          key: `lists.exists.${spec.key}`,
          label: `リスト存在：${spec.displayName}`,
          category: "lists",
          summary: `任意リストが見つかりません（${spec.resolvedTitle}）。任意機能のため警告扱いとします。`,
          detail: listInfo.err,
          evidence: { listKey: spec.key, listTitle: spec.resolvedTitle, label: spec.displayName },
          nextActions: [
            {
              kind: "doc",
              label: "【カテゴリ: スキーマ（任意）】任意機能を利用する場合はリストを作成する",
              value: "provision/README.md",
            },
          ],
        })
      );
    } else {
      results.push(
        fail({
          key: `lists.exists.${spec.key}`,
          label: `リスト存在：${spec.displayName}`,
          category: "lists",
          summary: `リストが見つかりません（${spec.resolvedTitle}）。`,
          detail: listInfo.err,
          evidence: { listKey: spec.key, listTitle: spec.resolvedTitle, label: spec.displayName },
          nextActions: [
            {
              kind: "doc",
              label: "【カテゴリ: リスト不存在】Provision 手順を確認し、リストを作成する",
              value: "provision/README.md",
            },
          ],
        })
      );
    }
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
  const fields = await safe(() => sp.getFields(spec.resolvedTitle));
  if (!fields.ok) {
    results.push(
      fail({
        key: `schema.fields.${spec.key}`,
        label: `スキーマ：${spec.displayName}`,
        category: "schema",
        summary: "列（フィールド）情報の取得に失敗しました。",
        detail: fields.err,
        evidence: { listTitle: spec.resolvedTitle },
      })
    );
  } else {
    // 1. Resolve fields with drift detection
    // f.candidates があればそれを使い、なければ internalName 単独で解決
    const candidates = Object.fromEntries(
      spec.requiredFields.map(f => [f.internalName, (f as SpFieldSpec).candidates ?? [f.internalName]])
    );
    const available = new Set(fields.v.map(f => f.internalName));
    const resolution = resolveInternalNamesDetailed(available, candidates, {
      onDrift: (fieldName, resolutionType, driftType) => {
        // 診断ツール実行時も、ドリフトを正規のイベントとして記録する
        emitDriftRecord(spec.resolvedTitle, fieldName, resolutionType as DriftResolutionType, driftType as DriftType);
      }
    });
    fieldStatus = resolution.fieldStatus;
    const { missing } = resolution;

    // 2. Classify missing by essentiality
    const missingEssential = spec.requiredFields.filter(
      (f) => f.isEssential && missing.includes(f.internalName)
    );
    const missingOptional = spec.requiredFields.filter(
      (f) => !f.isEssential && missing.includes(f.internalName)
    );

    // 3. Detect Drift
    const drifted = spec.requiredFields.filter(
      (f) => fieldStatus[f.internalName]?.isDrifted
    );

    // 4. Report Results
    if (missingEssential.length > 0) {
      results.push(
        fail({
          key: `schema.fields.${spec.key}`,
          label: `スキーマ構成違反：${spec.displayName}`,
          category: "schema",
          summary: `致命的エラー：アプリ稼働に必須な列が存在しません。システムは正常に稼働できません。`,
          detail: `以下の必須列が見つかりません: ${missingEssential.map(f => f.internalName).join(", ")}\nインフラ管理者に連絡し、列を追加してください。`,
          evidence: {
            listTitle: spec.resolvedTitle,
            missing: missingEssential.map(f => f.internalName),
          },
          nextActions: [
            {
              kind: "copy",
              label: "インフラ管理者に連絡",
              value: `リスト「${spec.resolvedTitle}」に必須列が不足しており、システムが異常終了します。不足列: ${missingEssential.map(f => f.internalName).join(", ")}`
            }
          ]
        })
      );
    } else if (drifted.length > 0) {
      // Execute governance decision logic
      const primaryDrift = drifted[0];
      const driftType = fieldStatus[primaryDrift.internalName].driftType as DriftType;
      const isEssential = Boolean(primaryDrift.isEssential);
      
      const decision = decideGovernanceAction(driftType, ctx.autonomyLevel, isEssential);

      results.push(
        warn({
          key: `schema.fields.${spec.key}`,
          label: `スキーマ（内部名乖離）：${spec.displayName}`,
          category: "schema",
          summary: `${drifted.length}個の列で内部名の乖離（Drift）を検出しました。`,
          detail: `SharePoint上の内部名にサフィックスが付与されていますが、アプリ側で自動吸収しています。\n乖離項目: ${drifted.map(f => `${f.internalName} → ${fieldStatus[f.internalName].resolvedName}`).join(", ")}`,
          evidence: {
            listTitle: spec.resolvedTitle,
            drifted: drifted.map(f => ({
              expected: f.internalName,
              actual: fieldStatus[f.internalName].resolvedName,
              driftType: fieldStatus[f.internalName].driftType
            }))
          },
          governance: decision,
          nextActions: [
            {
              kind: "copy",
              label: "乖離列の確認依頼",
              value: `リスト「${spec.resolvedTitle}」の「${drifted[0].internalName}」が「${fieldStatus[drifted[0].internalName].resolvedName}」として解決されています。`,
            },
          ],
        })
      );
    } else if (missingOptional.length > 0) {
      results.push(
        warn({
          key: `schema.fields.${spec.key}`,
          label: `スキーマ（一部）：${spec.displayName}`,
          category: "schema",
          summary: `一部のオプション列名が物理名と一致しません（${missingOptional.map(f => f.internalName).join(", ")}）。`,
          detail: "case の差異や自動付与サフィックスの可能性があります。業務データ取得には代替解決ロジックが適用されます。",
          evidence: { listTitle: spec.resolvedTitle, missing: missingOptional.map(f => f.internalName) },
          nextActions: [
            {
              kind: "doc",
              label: "【カテゴリ: スキーマ（任意）】Provision を再実行してオプション列を追加する",
              value: "provision/README.md",
            },
          ],
        })
      );
    } else {
      results.push(
        pass({
          key: `schema.fields.${spec.key}`,
          label: `スキーマ：${spec.displayName}`,
          category: "schema",
          summary: "すべての期待列が物理名と一致しています。",
          evidence: { listTitle: spec.resolvedTitle },
        })
      );
    }
  }

  // Permissions: Read
  const read = await safe(() => sp.getItemsTop1(spec.resolvedTitle));
  if (!read.ok) {
    results.push(
      fail({
        key: `permissions.read.${spec.key}`,
        label: `権限：Read（${spec.displayName}）`,
        category: "permissions",
        summary: "閲覧（Read）権限がありません。【要管理者対応】",
        detail: read.err,
        evidence: { listTitle: spec.resolvedTitle },
        nextActions: [
          {
            kind: "copy",
            label: "【カテゴリ: Read】管理者に閲覧権限を付与するよう依頼する",
            value: `リスト「${spec.resolvedTitle}」に対する「閲覧」以上の権限を SharePoint 管理者が付与してください。`,
          },
        ],
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
  if (spec.isReadOnly) {
    results.push(
      pass({
        key: `permissions.write.skipped.${spec.key}`,
        label: `権限：Write（${spec.displayName}）`,
        category: "permissions",
        summary: "このリストは、アプリ側設定で「読み取り専用」として定義されています（書き込みテストをスキップ）。",
      })
    );
    return;
  }

  // 事故防止：healthcheck 用の識別フラグを body に混ぜる
  const stamp = new Date().toISOString();
  
  // 物理名へのマッピングを行い、Create テストを実行
  const mapToPhysical = (obj: Record<string, unknown>) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      const resolved = fieldStatus[k]?.resolvedName || k;
      out[resolved] = v;
    }
    return out;
  };

  const createBody = mapToPhysical(spec.createItem);
  const physicalTitle = fieldStatus["Title"]?.resolvedName || "Title";
  
  if (typeof createBody[physicalTitle] === "string") {
    createBody[physicalTitle] = `[healthcheck] ${createBody[physicalTitle]} ${stamp}`;
  } else {
    createBody[physicalTitle] = `[healthcheck] ${stamp}`;
  }

  const created = await safe(() =>
    sp.createItem(spec.resolvedTitle, createBody)
  );
  if (!created.ok) {
    results.push(
      fail({
        key: `permissions.create.${spec.key}`,
        label: `権限：Create（${spec.displayName}）`,
        category: "permissions",
        summary: "作成（Create）権限がありません。【要管理者対応】",
        detail: created.err,
        evidence: { listTitle: spec.resolvedTitle, payload: createBody },
        nextActions: [
          {
            kind: "copy",
            label: "【カテゴリ: Create】管理者に作成権限を付与するよう依頼する",
            value: `リスト「${spec.resolvedTitle}」に対する「投稿」以上の権限を SharePoint 管理者が付与してください。`,
          },
        ],
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

  // Allow some time for SharePoint to sync the new item
  await new Promise((r) => setTimeout(r, 500));

  const updateBody = mapToPhysical(spec.updateItem);
  const updated = await safe(() =>
    sp.updateItem(spec.resolvedTitle, created.v.id, updateBody)
  );
  if (!updated.ok) {
    results.push(
      fail({
        key: `permissions.update.${spec.key}`,
        label: `権限：Update（${spec.displayName}）`,
        category: "permissions",
        summary: "更新（Update）権限がありません。【要管理者対応】",
        detail: updated.err,
        evidence: { id: created.v.id, listTitle: spec.resolvedTitle },
        nextActions: [
          {
            kind: "copy",
            label: "【カテゴリ: Update】管理者に更新権限を付与するよう依頼する",
            value: `リスト「${spec.resolvedTitle}」に対する「投稿」以上の権限を SharePoint 管理者が付与してください。`,
          },
        ],
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
    sp.deleteItem(spec.resolvedTitle, created.v.id)
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
        evidence: { id: created.v.id, listTitle: spec.resolvedTitle },
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

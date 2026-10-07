import { HealthCheckResult, HealthContext, ListSpec, SpFieldSpec } from "../types";
import { SpAdapter } from "../spAdapter";
import { resolveInternalNamesDetailed, ResolutionResult } from '@/lib/sp/helpers';
import type { DriftType } from '@/features/diagnostics/drift/domain/driftLogic';
import { decideGovernanceAction } from '@/features/diagnostics/governance/governanceEngine';
import { pass, fail, warn, safe, summarizeHttpStatus, isTransientPermissionStatus } from "./utils";

/**
 * 実行時に欠落していても致命的エラー（FAIL）とせず、警告（WARN）で済ませる列の判定。
 */
export const isRuntimeToleratedMissingEssential = (internalName: string): boolean =>
  internalName === 'Title';

export async function runAllListChecks(
  ctx: HealthContext,
  sp: SpAdapter,
  results: HealthCheckResult[]
): Promise<void> {
  // --- D/E) Lists, Schema, Permissions (Read only) ---
  for (const spec of ctx.listSpecs()) {
    await runListChecks(results, sp, spec, ctx);
  }
}

async function runListChecks(
  results: HealthCheckResult[],
  sp: SpAdapter,
  spec: ListSpec,
  ctx: HealthContext
) {
  let fieldStatus: ResolutionResult<string>['fieldStatus'] = {};

  const isTrue = (val: unknown): boolean => {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'number') return val !== 0;
    if (typeof val === 'string') {
      const s = val.trim().toLowerCase();
      return s === '1' || s === 'true' || s === 'yes' || s === 'y' || s === 'on' || s === 'enabled';
    }
    return false;
  };

  const isSkipSharePoint =
    isTrue(ctx.env["VITE_SKIP_SHAREPOINT"]) ||
    isTrue(ctx.env["VITE_SKIP_LOGIN"]) ||
    isTrue(ctx.env["VITE_DEMO_MODE"]) ||
    isTrue(ctx.env["VITE_FORCE_DEMO"]);

  // List existence
  const listInfo = isSkipSharePoint
    ? { ok: true as const, v: { id: `mock-${spec.key}`, title: spec.resolvedTitle } }
    : await safe(() => sp.getListByTitle(spec.resolvedTitle));
  if (!listInfo.ok) {
    if (listInfo.isThrottled) {
      results.push(
        warn({
          key: `lists.exists.${spec.key}`,
          label: `リスト存在：${spec.displayName}`,
          category: "lists",
          summary: `SharePoint 側の一時的なスロットリングを検知しました。`,
          detail: `SharePoint throttling detected. This is treated as an external transient condition, not an application schema failure. Retry after the tenant recovers. (Error: ${listInfo.err})`,
          evidence: { listKey: spec.key, listTitle: spec.resolvedTitle, label: spec.displayName },
          nextActions: [
            {
              kind: "doc",
              label: "時間をおいて再実行する（429/5xx またはスロットリングは一時エラー）",
              value: "Health 診断を 5〜10 分後に再実行してください。",
            },
          ],
        })
      );
    } else if (spec.isOptional) {
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
  const fields = isSkipSharePoint
    ? {
        ok: true as const,
        v: spec.requiredFields.map(f => {
          let physicalName = f.internalName;

          // 🧪 Active Drift Simulation for planning_sheet_master under Stub Mode
          if (spec.key === 'planning_sheet_master') {
            if (f.internalName === 'UserCode') {
              physicalName = 'userCode'; // casing drift
            } else if (f.internalName === 'UserId') {
              physicalName = 'userId'; // casing drift
            } else if (f.internalName === 'ISPLookupId') {
              physicalName = 'PlanningSheetId'; // rename mapping drift
            }
          }

          return {
            internalName: physicalName,
            staticName: physicalName,
            typeAsString: 'Text'
          };
        })
      }
    : await safe(() => sp.getFields(spec.resolvedTitle));
  if (!fields.ok) {
    if (fields.isThrottled) {
      results.push(
        warn({
          key: `schema.fields.${spec.key}`,
          label: `スキーマ：${spec.displayName}`,
          category: "schema",
          summary: `SharePoint 側の一時的なスロットリングを検知しました。`,
          detail: `SharePoint throttling detected. This is treated as an external transient condition, not an application schema failure. Retry after the tenant recovers. (Error: ${fields.err})`,
          evidence: { listTitle: spec.resolvedTitle },
          nextActions: [
            {
              kind: "doc",
              label: "時間をおいて再実行する（429/5xx またはスロットリングは一時エラー）",
              value: "Health 診断を 5〜10 分後に再実行してください。",
            },
          ],
        })
      );
    } else {
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
    }
  } else {
    // 1. Resolve fields with drift detection
    const candidates = Object.fromEntries(
      spec.requiredFields.map(f => [f.internalName, (f as SpFieldSpec).candidates ?? [f.internalName]])
    );
    const available = new Set(fields.v.map(f => f.internalName));
    // Keep drift evidence in this report without firing persistence observers.
    const resolution = resolveInternalNamesDetailed(available, candidates);
    fieldStatus = resolution.fieldStatus;
    const { missing } = resolution;

    // 2. Classify missing by essentiality
    const missingEssential = spec.requiredFields.filter(
      (f) => f.isEssential && missing.includes(f.internalName)
    );

    const fatalMissingEssential = missingEssential.filter(
      (f) => !isRuntimeToleratedMissingEssential(f.internalName)
    );
    const titleOnlyEssentialMissing =
      missingEssential.length > 0 && fatalMissingEssential.length === 0;

    const missingOptional = spec.requiredFields.filter(
      (f) => !f.isEssential && !f.isSilent && missing.includes(f.internalName)
    );

    const drifted = spec.requiredFields.filter(
      (f) => {
        if (f.isSilent) return false;
        const status = fieldStatus[f.internalName];
        if (!status || !status.isDrifted) return false;
        // expected (f.internalName) と actual (resolvedName) が完全に一致している（自己一致）場合は drift とみなさない
        if (status.resolvedName === f.internalName) return false;
        return true;
      }
    );

    // 4. Report Results
    if (fatalMissingEssential.length > 0) {
      results.push(
        fail({
          key: `schema.fields.${spec.key}`,
          label: `スキーマ構成違反：${spec.displayName}`,
          category: "schema",
          summary: `致命的エラー：アプリ稼働に必須な列が存在しません。システムは正常に稼働できません。`,
          detail: `以下の必須列が見つかりません: ${fatalMissingEssential.map(f => f.internalName).join(", ")}\nインフラ管理者に連絡し、列を追加してください。`,
          evidence: {
            listTitle: spec.resolvedTitle,
            missing: fatalMissingEssential.map(f => f.internalName),
          },
          nextActions: [
            {
              kind: "copy",
              label: "インフラ管理者に連絡",
              value: `リスト「${spec.resolvedTitle}」に必須列が不足しており、システムが異常終了します。不足列: ${fatalMissingEssential.map(f => f.internalName).join(", ")}`
            }
          ]
        })
      );
    } else if (titleOnlyEssentialMissing) {
      results.push(
        warn({
          key: `schema.fields.${spec.key}`,
          label: `スキーマ（Title 欠落）：${spec.displayName}`,
          category: "schema",
          summary: `Title 列が物理列一覧で解決できませんでしたが、runtime 必須列ではないため致命的エラーにはしません。`,
          detail: `SharePoint の Title は既定列として扱われる場合があり、repository が実データを読める構成では FAIL ではなく drift として扱います。`,
          evidence: {
            listTitle: spec.resolvedTitle,
            missing: ["Title"],
          },
        })
      );
    } else if (drifted.length > 0) {
      const legacyDrifted = drifted.filter(f => {
        const resName = fieldStatus[f.internalName].resolvedName;
        return f.isLegacy || (resName && f.legacyCandidates?.includes(resName));
      });
      const regularDrifted = drifted.filter(f => !legacyDrifted.includes(f));

      if (legacyDrifted.length > 0) {
        results.push(
          pass({
            key: `schema.fields.${spec.key}.legacy`,
            label: `スキーマ（レガシー列）: ${spec.displayName}`,
            category: "schema",
            summary: `退役予定のレガシー列（${legacyDrifted.map(f => f.internalName).join(", ")}）が検出されました。`,
            detail: `この列は将来的に削除される予定ですが、現在は後方互換性のために保持されています。\n解決名: ${legacyDrifted.map(f => `${f.internalName} → ${fieldStatus[f.internalName].resolvedName}`).join(", ")}`,
            evidence: {
              listTitle: spec.resolvedTitle,
              drifted: legacyDrifted.map(f => ({
                expected: f.internalName,
                actual: fieldStatus[f.internalName].resolvedName,
                driftType: "legacy_tolerated"
              }))
            },
          })
        );
      }

      if (regularDrifted.length > 0) {
        const primaryDrift = regularDrifted[0];
        const driftType = fieldStatus[primaryDrift.internalName].driftType as DriftType;
        const isEssential = Boolean(primaryDrift.isEssential);
        const decision = decideGovernanceAction(driftType, ctx.autonomyLevel, isEssential);

        results.push(
          warn({
            key: `schema.fields.${spec.key}`,
            label: `スキーマ（内部名乖離）：${spec.displayName}`,
            category: "schema",
            summary: `${regularDrifted.length}個の列で内部名の乖離（Drift）を検出しました。`,
            detail: `SharePoint上の内部名にサフィックスが付与されていますが、アプリ側で自動吸収しています。\n乖離項目: ${regularDrifted.map(f => `${f.internalName} → ${fieldStatus[f.internalName].resolvedName}`).join(", ")}`,
            evidence: {
              listTitle: spec.resolvedTitle,
              drifted: regularDrifted.map(f => ({
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
                value: `リスト「${spec.resolvedTitle}」の「${regularDrifted[0].internalName}」が「${fieldStatus[regularDrifted[0].internalName].resolvedName}」として解決されています。`,
              },
            ],
          })
        );
      }
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
              label: "実列 InternalName を確認し、候補名に追加。不足確定時のみ Provision 再実行",
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
  const read = isSkipSharePoint
    ? { ok: true as const, v: [] as unknown[] }
    : await safe(() => sp.getItemsTop1(spec.resolvedTitle));
  if (!read.ok) {
    if (isTransientPermissionStatus(read.status) || read.isThrottled) {
      results.push(
        warn({
          key: `permissions.read.${spec.key}`,
          label: `権限：Read（${spec.displayName}）`,
          category: "permissions",
          summary: read.isThrottled
            ? `一時的エラー：SharePoint 側の一時的なスロットリングを検知しました。`
            : `閲覧（Read）確認中に一時的エラー（${summarizeHttpStatus(read.status)}）を検出しました。`,
          detail: read.isThrottled
            ? `SharePoint throttling detected. This is treated as an external transient condition, not an application schema failure. Retry after the tenant recovers. (Error: ${read.err})`
            : read.err,
          evidence: { listTitle: spec.resolvedTitle },
          nextActions: [
            {
              kind: "doc",
              label: "時間をおいて再実行する（429/5xx またはスロットリングは一時エラー）",
              value: "Health 診断を 5〜10 分後に再実行してください。",
            },
          ],
        })
      );
    } else {
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
    }
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

  // Diagnostics never authorize mutations, regardless of mode or autonomy level.
  results.push(
    warn({
      key: `permissions.write.skipped.${spec.key}`,
      label: `権限：Write（${spec.displayName}）`,
      category: "permissions",
      summary: "読み取り専用診断のため、作成・更新・削除は実行していません（書込み権限は未検証）。",
      detail: "WRITE_DIAGNOSTICS_DISABLED",
      evidence: { mode: "READ_ONLY", writeExecuted: false, listTitle: spec.resolvedTitle },
    })
  );
}

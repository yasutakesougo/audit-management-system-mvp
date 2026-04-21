#!/usr/bin/env node
/**
 * Lot1B PR #E — UserBenefit_Profile optional 6-column backfill (CUTOVER STEP 3).
 *
 * 責務:
 *   - legacy (`_x0020_` encoded) 列に存在するが canonical 列が空の項目を洗い出し、
 *     canonical 列に同一値を書き戻す（冪等・再実行安全）。
 *
 * この責務から外すもの:
 *   - read path / write path の切替 → cutover stage flag で制御（別モジュール）
 *   - canonical 列の provision → 管理者作業（PR #A1 完了後に実施）
 *   - legacy 列の drop → Lot2 送り
 *
 * Usage:
 *   node scripts/ops/migrate-user-benefit-profile-optional.mjs --dry-run
 *   node scripts/ops/migrate-user-benefit-profile-optional.mjs --execute --batch=100
 *
 * Rollback:
 *   - dry-run で差分を確認し、書き込みバッチが巨大なら --limit で分割
 *   - 書き込み後の整合性確認で乖離が出た場合は、cutover stage を DUAL_WRITE に戻す
 *     （canonical 列には既に値が入っているが、read が legacy fallback を継続）
 */

// TODO(lot1b-pr-e-integration):
//   - 既存の SP 接続モジュール（認証・ページング）を import で差し込む
//   - LIST_TITLE は src/sharepoint/fields/userFields.ts の SSOT から取得する
//   - MIGRATING_COLUMNS は TS 側 columns.ts と同じ定義を JSON export して共有する

const MIGRATING_COLUMNS = [
  { canonical: 'CopayPaymentMethod', legacy: 'Copay_x0020_Payment_x0020_Method' },
  { canonical: 'GrantMunicipality',  legacy: 'Grant_x0020_Municipality' },
  { canonical: 'GrantPeriodStart',   legacy: 'Grant_x0020_Period_x0020_Start' },
  { canonical: 'GrantPeriodEnd',     legacy: 'Grant_x0020_Period_x0020_End' },
  { canonical: 'MealAddition',       legacy: 'Meal_x0020_Addition' },
  { canonical: 'UserCopayLimit',     legacy: 'User_x0020_Copay_x0020_Limit' },
];

const LIST_TITLE = 'UserBenefit_Profile';

const args = process.argv.slice(2);
const DRY_RUN = !args.includes('--execute');
const BATCH_SIZE = Number(args.find((a) => a.startsWith('--batch='))?.slice('--batch='.length) ?? 100);
const LIMIT = Number(args.find((a) => a.startsWith('--limit='))?.slice('--limit='.length) ?? Infinity);

const isEmpty = (v) => v === null || v === undefined || v === '';

function diffRowAgainstCanonical(row) {
  const patch = {};
  for (const { canonical, legacy } of MIGRATING_COLUMNS) {
    const canonicalValue = row[canonical];
    const legacyValue = row[legacy];
    if (isEmpty(canonicalValue) && !isEmpty(legacyValue)) {
      patch[canonical] = legacyValue;
    }
  }
  return patch;
}

async function fetchAllRows() {
  // TODO(lot1b-pr-e-integration): 既存の SP list fetcher を呼ぶ
  // 例: return await spFetchAllItems(LIST_TITLE, { select: [...canonical, ...legacy] });
  throw new Error('fetchAllRows: SP 接続モジュールを差し込んでください');
}

async function applyPatch(itemId, patch) {
  // TODO(lot1b-pr-e-integration): 既存の SP updater を呼ぶ
  // 例: await spUpdateItem(LIST_TITLE, itemId, patch);
  void itemId;
  void patch;
  throw new Error('applyPatch: SP 接続モジュールを差し込んでください');
}

async function main() {
  console.log(`[migrate] list=${LIST_TITLE} dryRun=${DRY_RUN} batch=${BATCH_SIZE} limit=${LIMIT}`);

  const rows = await fetchAllRows();
  const plannedPatches = [];
  for (const row of rows) {
    const patch = diffRowAgainstCanonical(row);
    if (Object.keys(patch).length > 0) {
      plannedPatches.push({ id: row.ID ?? row.Id, patch });
    }
    if (plannedPatches.length >= LIMIT) break;
  }

  console.log(`[migrate] planned updates: ${plannedPatches.length} / ${rows.length}`);
  if (DRY_RUN || plannedPatches.length === 0) {
    console.log('[migrate] dry-run — no writes performed');
    return;
  }

  let applied = 0;
  for (let i = 0; i < plannedPatches.length; i += BATCH_SIZE) {
    const batch = plannedPatches.slice(i, i + BATCH_SIZE);
    for (const { id, patch } of batch) {
      await applyPatch(id, patch);
      applied += 1;
    }
    console.log(`[migrate] applied ${applied} / ${plannedPatches.length}`);
  }

  console.log('[migrate] done');
}

main().catch((err) => {
  console.error('[migrate] failed:', err);
  process.exitCode = 1;
});

/* eslint-disable no-console -- CLI ops script */
/**
 * Nightly Index Remediation — Mode B: guarded add only
 *
 * 設計方針:
 * 1. allowlist のみ対象（KNOWN_REQUIRED_INDEXED_FIELDS に定義されたリストのみ）
 * 2. add のみ実行（delete は封印）
 * 3. 1 run あたりの実行上限（NIGHTLY_RUN_LIMIT）
 * 4. fail-soft: 1フィールドの失敗が他を止めない
 * 5. source: 'nightly' を全結果に付与
 *
 * sessionStorage は Node.js 非対応のため使用しない。
 * 重複防止は in-memory Set で run スコープのみ保証する。
 */

import { KNOWN_REQUIRED_INDEXED_FIELDS } from '@/features/sp/health/indexAdvisor/spIndexKnownConfig';

// ── Constants ─────────────────────────────────────────────────────────────────

/** 1 run あたりの自動修復上限 */
const NIGHTLY_RUN_LIMIT = 3;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NightlyRemediationConfig {
  token: string;
  siteUrl: string;
  /** 1 run あたりの実行上限（テスト上書き用。省略時は NIGHTLY_RUN_LIMIT）*/
  runLimit?: number;
}

export interface NightlyRemediationResult {
  listTitle: string;
  internalName: string;
  /** true = index added, false = failed or skipped */
  ok: boolean;
  /** 'added' | 'failed' | 'skipped_limit' */
  outcome: 'added' | 'failed' | 'skipped_limit';
  message: string;
  /** 常に 'nightly' */
  source: 'nightly';
}

// ── SP REST helpers ───────────────────────────────────────────────────────────

async function fetchIndexedFieldNames(
  config: NightlyRemediationConfig,
  listTitle: string,
): Promise<Set<string>> {
  const url =
    `${config.siteUrl}/_api/web/lists/getbytitle('${encodeURIComponent(listTitle)}')/fields` +
    `?$filter=Indexed eq true&$select=InternalName`;

  const res = await globalThis.fetch(url, {
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: 'application/json;odata=nometadata',
    },
  });

  if (!res.ok) {
    throw new Error(`SP fetch failed (${res.status}) for list "${listTitle}"`);
  }

  const data = (await res.json()) as { value: { InternalName: string }[] };
  return new Set(data.value.map((f) => f.InternalName));
}

async function setFieldIndexed(
  config: NightlyRemediationConfig,
  listTitle: string,
  internalName: string,
): Promise<void> {
  const url =
    `${config.siteUrl}/_api/web/lists/getbytitle('${encodeURIComponent(listTitle)}')` +
    `/fields/getbyinternalnameortitle('${encodeURIComponent(internalName)}')`;

  const res = await globalThis.fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: 'application/json;odata=nometadata',
      'Content-Type': 'application/json;odata=nometadata',
      'X-HTTP-Method': 'MERGE',
      'If-Match': '*',
    },
    body: JSON.stringify({ Indexed: true }),
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => 'No error body');
    throw new Error(`SP PATCH failed (${res.status}) for ${listTitle}.${internalName}: ${errorBody}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

/**
 * Nightly 自動インデックス修復を実行する。
 *
 * - allowlist (KNOWN_REQUIRED_INDEXED_FIELDS) に定義されたリストのみ対象
 * - 追加候補（SP にインデックスがない必須フィールド）のみ実行
 * - 最大 NIGHTLY_RUN_LIMIT 件まで実行し、超過分は skipped_limit として記録
 * - 各フィールドのエラーは個別に捕捉し、他のフィールドに影響しない (fail-soft)
 */
export async function runNightlyIndexRemediation(
  config: NightlyRemediationConfig,
): Promise<NightlyRemediationResult[]> {
  const limit = config.runLimit ?? NIGHTLY_RUN_LIMIT;
  const results: NightlyRemediationResult[] = [];
  let addedCount = 0;
  const executedKeys = new Set<string>(); // run スコープ内の重複防止

  for (const [listTitle, requiredFields] of Object.entries(KNOWN_REQUIRED_INDEXED_FIELDS)) {
    let currentIndexed: Set<string>;
    try {
      currentIndexed = await fetchIndexedFieldNames(config, listTitle);
    } catch (err) {
      console.warn(`  ⚠️ [nightly-remediation] Skipping "${listTitle}": ${err instanceof Error ? err.message : err}`);
      continue;
    }

    // SP Limit Guard (Standard SP limit is 20 indexed columns per list)
    const SP_INDEX_LIMIT = 20;
    const currentCount = currentIndexed.size;

    const additionCandidates = requiredFields.filter(
      (f) => !currentIndexed.has(f.internalName),
    );

    if (additionCandidates.length === 0) continue;

    let addedToThisList = 0;
    for (const field of additionCandidates) {
      const key = `${listTitle}::${field.internalName}`;
      if (executedKeys.has(key)) continue;

      // 1. Run Limit Check
      if (addedCount >= limit) {
        results.push({
          listTitle,
          internalName: field.internalName,
          ok: false,
          outcome: 'skipped_limit',
          message: `実行上限（${limit}件/回）のため次回の巡回にまわします。`,
          source: 'nightly',
        });
        continue;
      }

      // 2. SharePoint List Limit Guard (Abort if adding more would exceed 20)
      if (currentCount + addedToThisList >= SP_INDEX_LIMIT) {
        results.push({
          listTitle,
          internalName: field.internalName,
          ok: false,
          outcome: 'failed',
          message: `SharePointのインデックス上限（${SP_INDEX_LIMIT}件）に達しているため自動作成を中止しました。（現在: ${currentCount}件）`,
          source: 'nightly',
        });
        console.warn(`  ⚠️ [nightly-remediation] ${listTitle} reached SP index limit (${currentCount}/${SP_INDEX_LIMIT})`);
        break; 
      }

      // 3. Execution (fail-soft)
      try {
        await setFieldIndexed(config, listTitle, field.internalName);
        executedKeys.add(key);
        addedCount++;
        addedToThisList++;
        
        const currentTotal = currentCount + addedToThisList;
        const msg = `${field.internalName} のインデックスを自動作成しました。成功（${currentTotal}/${SP_INDEX_LIMIT}）`;
        console.log(`  ✅ [nightly-remediation] ${listTitle}.${field.internalName} — added (${currentTotal}/${SP_INDEX_LIMIT})`);
        results.push({ listTitle, internalName: field.internalName, ok: true, outcome: 'added', message: msg, source: 'nightly' });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn(`  ❌ [nightly-remediation] ${listTitle}.${field.internalName} — ${errMsg}`);
        results.push({
          listTitle,
          internalName: field.internalName,
          ok: false,
          outcome: 'failed',
          message: `${field.internalName} の作成に失敗: ${errMsg}`,
          source: 'nightly',
        });
      }
    }
  }

  return results;
}

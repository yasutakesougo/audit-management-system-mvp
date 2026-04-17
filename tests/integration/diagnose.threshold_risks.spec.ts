import { expect, test } from '@playwright/test';
import { resolveSharePointSiteUrl } from './_shared/resolveSiteUrl';

/**
 * Diagnostic: Check critical column indexing to prevent SharePoint Threshold errors (500)
 *
 * List titles are resolved with the SAME env vars and defaults used by SP_LIST_REGISTRY
 * (see src/sharepoint/spListRegistry.ts — schedule_events: L475, drift_events_log: L694).
 * Registry entries use `envOr(VITE_SP_LIST_*, <default>)`; this spec mirrors that logic
 * inline because Playwright's ESM loader can't transitively import the registry module.
 *
 * Override via env vars: VITE_SP_LIST_SCHEDULES, VITE_SP_LIST_DRIFT_LOG
 *
 * Run: SHAREPOINT_SITE=https://... npm run diagnose:threshold
 */

/** Mirrors `envOr` from src/sharepoint/spListRegistry.shared.ts:34 */
function envOr(envKey: string, fallback: string): string {
  const raw = process.env[envKey]?.trim();
  if (!raw) return fallback;
  if (raw.toLowerCase().startsWith('guid:')) return fallback;
  return raw;
}

type Target = {
  key: string;
  resolveTitle: () => string;
  criticalFields: readonly string[];
};

// Keep in sync with SP_LIST_REGISTRY entries referenced above.
const TARGETS: readonly Target[] = [
  {
    key: 'schedule_events',
    resolveTitle: () => envOr('VITE_SP_LIST_SCHEDULES', 'Schedules'),
    criticalFields: ['EventDate', 'EndDate', 'cr014_dayKey'],
  },
  {
    key: 'drift_events_log',
    resolveTitle: () => envOr('VITE_SP_LIST_DRIFT_LOG', 'DriftEventsLog'),
    criticalFields: ['Detected_At', 'DetectedAt', 'Detected_x0020_At'],
  },
  {
    key: 'drift_events_log_v2',
    resolveTitle: () => 'DriftEventsLog_v2',
    criticalFields: ['Detected_At', 'DetectedAt', 'Detected_x0020_At'],
  },
];

test.describe('SharePoint Threshold Risk Diagnosis', () => {
  test.use({
    storageState: 'tests/.auth/storageState.json',
  });

  const siteUrl = resolveSharePointSiteUrl();

  for (const target of TARGETS) {
    const resolvedTitle = target.resolveTitle();

    test(`Check indexing for list: ${target.key} → '${resolvedTitle}'`, async ({ context }, testInfo) => {
      const request = context.request;

      await test.step(
        `resolve context | key=${target.key} title='${resolvedTitle}' siteUrl=${siteUrl}`,
        async () => {
          expect
            .soft(resolvedTitle, `resolved title is empty for '${target.key}'`)
            .not.toEqual('');
        },
      );

      const listUrl = `${siteUrl}/_api/web/lists/GetByTitle('${resolvedTitle}')?$select=Title,ItemCount,Id`;
      const listRes = await request.get(listUrl, {
        headers: { 'Accept': 'application/json;odata=verbose' }
      });

      if (!listRes.ok()) {
        const bodySnippet = await listRes.text().then((t) => t.slice(0, 400)).catch(() => '(no body)');
        const diagnostic = [
          `❌ list not found / not accessible — 診断未実施`,
          `   key            = ${target.key}`,
          `   resolved title = '${resolvedTitle}'`,
          `   siteUrl        = ${siteUrl}`,
          `   status         = ${listRes.status()} ${listRes.statusText()}`,
          `   body           = ${bodySnippet}`,
        ].join('\n');
        console.warn(`\n${diagnostic}`);
        testInfo.annotations.push({ type: 'diagnostic-skip', description: diagnostic });
        expect.soft(listRes.ok(), diagnostic).toBe(true);
        return;
      }

      const listJson = await listRes.json();
      const list = listJson?.d || listJson;
      const itemCount: number = list.ItemCount;

      console.log(`\n[Threshold Check] ${target.key} → '${resolvedTitle}'`);
      console.log(`   ItemCount: ${itemCount}`);
      if (itemCount >= 5000) {
        console.log(`   🚨 CRITICAL: List has reached the 5000 item threshold!`);
      } else if (itemCount >= 4000) {
        console.log(`   ⚠️ WARNING: List is approaching the 5000 item threshold.`);
      }

      for (const fieldName of target.criticalFields) {
        const fieldUrl = `${siteUrl}/_api/web/lists/GetByTitle('${resolvedTitle}')/fields/GetByInternalNameOrTitle('${fieldName}')?$select=InternalName,Indexed,Title`;
        const fieldRes = await request.get(fieldUrl, {
          headers: { 'Accept': 'application/json;odata=verbose' }
        });

        if (!fieldRes.ok()) {
          console.warn(`   ⚠️ Field [${fieldName}] not found. Listing all available fields for debugging:`);
          const allFieldsRes = await request.get(`${siteUrl}/_api/web/lists/GetByTitle('${resolvedTitle}')/fields?$select=InternalName,Title,Indexed`, {
            headers: { 'Accept': 'application/json;odata=verbose' }
          });
          if (allFieldsRes.ok()) {
            const allFields = await allFieldsRes.json();
            const fields = allFields?.d?.results || [];
            fields.forEach((f: any) => {
              if (f.Title.includes('Date') || f.Title.includes('Key')) {
                console.log(`      - Title: "${f.Title}", InternalName: "${f.InternalName}", Indexed: ${f.Indexed}`);
              }
            });
          }
          continue;
        }

        const raw = await fieldRes.json();
        const field = raw?.d || raw;
        const isIndexed = field.Indexed;

        if (isIndexed) {
          console.log(`   ✅ [${field.InternalName}] is INDEXED.`);
        } else {
          console.log(`   ❌ [${field.InternalName}] is NOT INDEXED.`);
          if (itemCount >= 5000) {
            console.log(`      🔥 RISK: This column will cause 500 Threshold Errors when used in $filter or $orderby!`);
          }
        }
      }
    });
  }

  test('Check drift_events_log specifically for Detected_At indexing', async ({ context }, testInfo) => {
    const driftTarget = TARGETS.find((t) => t.key === 'drift_events_log');
    const resolvedTitle = driftTarget?.resolveTitle() ?? '(unresolved)';
    const request = context.request;

    await test.step(
      `resolve context | key=drift_events_log title='${resolvedTitle}' siteUrl=${siteUrl}`,
      async () => {
        expect
          .soft(driftTarget, `TARGETS entry missing for 'drift_events_log'`)
          .toBeDefined();
      },
    );

    if (!driftTarget) return;

    const fieldProbes = ['Detected_At', 'DetectedAt', 'Detected_x0020_At'];
    let foundAny = false;

    for (const fieldName of fieldProbes) {
      const url = `${siteUrl}/_api/web/lists/GetByTitle('${resolvedTitle}')/fields/GetByInternalNameOrTitle('${fieldName}')?$select=InternalName,Indexed`;
      const res = await request.get(url, {
        headers: { 'Accept': 'application/json;odata=verbose' }
      });
      if (!res.ok()) {
        continue;
      }
      const raw = await res.json();
      const field = raw?.d || raw;
      console.log(`\n[DriftLog] '${resolvedTitle}' field=${field.InternalName} Indexed=${field.Indexed}`);
      foundAny = true;
      if (!field.Indexed) {
        console.log(`   🚨 RECOMMENDATION: Index '${field.InternalName}' on '${resolvedTitle}' immediately.`);
      }
    }

    if (!foundAny) {
      const diagnostic = [
        `[DriftLog] Could not find any DetectedAt variants — 診断未実施`,
        `   key            = drift_events_log`,
        `   resolved title = '${resolvedTitle}'`,
        `   siteUrl        = ${siteUrl}`,
        `   probes         = ${fieldProbes.join(', ')}`,
      ].join('\n');
      console.warn(`\n${diagnostic}`);
      testInfo.annotations.push({ type: 'diagnostic-skip', description: diagnostic });
      expect.soft(foundAny, diagnostic).toBe(true);
    }
  });
});

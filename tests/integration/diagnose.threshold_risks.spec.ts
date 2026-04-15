import { test } from '@playwright/test';
import { resolveSharePointSiteUrl } from './_shared/resolveSiteUrl';

/**
 * Diagnostic: Check critical column indexing to prevent SharePoint Threshold errors (500)
 * 
 * Target Lists:
 * - schedule_events (Schedules)
 * - DriftEventsLog_v2 (Drift Logging)
 * 
 * Target Columns:
 * - EventDate, EndDate, cr014_dayKey (Schedules)
 * - Detected_At (DriftEventsLog)
 * 
 * Run: SHAREPOINT_SITE=https://... npm test tests/integration/diagnose.threshold_risks.spec.ts
 */
test.describe('SharePoint Threshold Risk Diagnosis', () => {
  test.use({
    storageState: 'tests/.auth/storageState.json',
  });
  const siteUrl = resolveSharePointSiteUrl();

  const TARGET_LISTS = [
    {
      title: 'schedule_events',
      criticalFields: ['EventDate', 'EndDate', 'cr014_dayKey']
    },
    {
      title: 'DriftEventsLog_v2',
      criticalFields: ['Detected_At', 'DetectedAt', 'Detected_x0020_At'] // Try common variants
    }
  ];

  for (const listInfo of TARGET_LISTS) {
    test(`Check indexing for list: ${listInfo.title}`, async ({ context }) => {
      const request = context.request;
      
      console.log(`\n[Threshold Check] List: ${listInfo.title}`);
      
      // 1. Get List Entry (to see item count)
      const listUrl = `${siteUrl}/_api/web/lists/GetByTitle('${listInfo.title}')?$select=Title,ItemCount,Id`;
      const listRes = await request.get(listUrl);
      
      if (!listRes.ok()) {
        console.warn(`⚠️ List '${listInfo.title}' not found or not accessible. Skipping.`);
        return;
      }
      
      const listJson = await listRes.json();
      const list = listJson?.d || listJson;
      const itemCount = list.ItemCount;
      
      console.log(`   ItemCount: ${itemCount}`);
      if (itemCount >= 5000) {
        console.log(`   🚨 CRITICAL: List has reached the 5000 item threshold!`);
      } else if (itemCount >= 4000) {
        console.log(`   ⚠️ WARNING: List is approaching the 5000 item threshold.`);
      }

      // 2. Check each critical field's Indexed property
      for (const fieldName of listInfo.criticalFields) {
        const fieldUrl = `${siteUrl}/_api/web/lists/GetByTitle('${listInfo.title}')/fields/GetByInternalNameOrTitle('${fieldName}')?$select=InternalName,Indexed,Title`;
        const fieldRes = await request.get(fieldUrl);
        
        if (!fieldRes.ok()) {
          // If not found, skip variant
          continue;
        }
        
        const field = (await fieldRes.json())?.d || (await fieldRes.json());
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

  test('Check DriftEventsLog_v2 specifically for Detected_At indexing', async ({ context }) => {
    const request = context.request;
    const listTitle = 'DriftEventsLog_v2';
    
    // Attempt to find ANY of the detectedAt variants
    const fieldProbes = ['Detected_At', 'DetectedAt', 'Detected_x0020_At'];
    let foundAny = false;

    for (const fieldName of fieldProbes) {
      const url = `${siteUrl}/_api/web/lists/GetByTitle('${listTitle}')/fields/GetByInternalNameOrTitle('${fieldName}')?$select=InternalName,Indexed`;
      const res = await request.get(url);
      if (res.ok()) {
        const field = (await res.json())?.d || (await res.json());
        console.log(`\n[DriftLog] Found field: ${field.InternalName}, Indexed: ${field.Indexed}`);
        foundAny = true;
        if (!field.Indexed) {
          console.log(`   🚨 RECOMMENDATION: Index '${field.InternalName}' in '${listTitle}' immediately.`);
        }
      }
    }

    if (!foundAny) {
      console.warn(`\n[DriftLog] Could not find any DetectedAt variants in '${listTitle}'.`);
    }
  });
});

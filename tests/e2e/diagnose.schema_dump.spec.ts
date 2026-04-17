import { test } from '@playwright/test';
import { resolveSharePointSiteUrl } from '../integration/_shared/resolveSiteUrl';

test.describe('Targeted Schema Check for 400 Errors', () => {
  test.use({
    storageState: 'tests/.auth/storageState.json',
  });

  const siteUrl = resolveSharePointSiteUrl();
  const targets = [
    { 
      title: 'DriftEventsLog_v2', 
      fields: ['List_x0020_Name', 'Field_x0020_Name', 'Detected_x0020_At', 'Severity', 'ResolutionType', 'DriftType', 'Resolved', 'DetectedAt'] 
    },
    { 
      title: 'Diagnostics_Reports', 
      fields: ['Overall', 'TopIssue', 'SummaryText', 'ReportLink', 'Notified', 'NotifiedAt'] 
    },
    {
      title: 'Schedules',
      fields: ['Title', 'EventDate', 'EndDate', 'fAllDayEvent', 'Location', 'Description']
    }
  ];

  for (const target of targets) {
    test(`Check fields for ${target.title}`, async ({ context }) => {
      const request = context.request;
      const url = `${siteUrl}/_api/web/lists/GetByTitle('${target.title}')/fields?$select=InternalName,Title,Indexed`;
      const res = await request.get(url, {
        headers: { 'Accept': 'application/json;odata=verbose' }
      });

      if (res.ok()) {
        const json = await res.json();
        const results = json?.d?.results || [];
        const internalNames = results.map((f: { InternalName: string }) => f.InternalName);
        
        console.log(`\n=== CHECKING LIST: ${target.title} ===`);
        target.fields.forEach(f => {
          const exists = internalNames.includes(f);
          console.log(`${exists ? '✅' : '❌'} Field: "${f}"`);
        });
        
        if (target.fields.some(f => !internalNames.includes(f))) {
            console.log(`\n--- ALL available fields in ${target.title} ---`);
            console.log(internalNames.join(', '));
        }
      } else {
        console.error(`Failed to fetch fields for ${target.title}`);
      }
    });
  }
});

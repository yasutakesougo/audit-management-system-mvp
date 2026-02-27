import { config } from 'dotenv';
import { z } from 'zod';
import { SharePointDailyRecordItemSchema } from '../src/features/daily/schema';
import { SpOrgRowSchema } from '../src/features/org/data/orgRowSchema';
import { parseSpScheduleRows } from '../src/features/schedules/data/spRowSchema';
import { SpUserMasterItemSchema } from '../src/features/users/schema';
import { getAppConfig } from '../src/lib/env';

config({ path: '.env.local' });
config();

if (!process.env.VITE_SP_RESOURCE) process.env.VITE_SP_RESOURCE = 'https://example.sharepoint.com';
if (!process.env.VITE_SP_SITE_RELATIVE) process.env.VITE_SP_SITE_RELATIVE = '/sites/app';
if (!process.env.VITE_MSAL_CLIENT_ID) process.env.VITE_MSAL_CLIENT_ID = 'dummy-client-id';
if (!process.env.VITE_MSAL_TENANT_ID) process.env.VITE_MSAL_TENANT_ID = 'dummy-tenant-id';
if (!process.env.VITE_SP_SCOPE_DEFAULT) process.env.VITE_SP_SCOPE_DEFAULT = 'https://example.sharepoint.com/AllSites.Read';

const env = getAppConfig();
const acquireToken = async () => {
    // .env.local または .env に設定したトークンを取得
    const token = process.env.SMOKE_TEST_BEARER_TOKEN;

    if (!token || token === 'mock-token') {
        throw new Error(
            "❌ [AUTH ERROR]: SMOKE_TEST_BEARER_TOKEN が設定されていないか、デフォルト値のままです。\n" +
            "ブラウザの DevTools (Networkタブ) から 'Bearer ' 以降の値をコピーして .env.local に貼り付けてください。"
        );
    }

    // 文字列の先頭に 'Bearer ' が含まれていてもいなくても対応できるように正規化
    return token.startsWith('Bearer ') ? token.replace('Bearer ', '') : token;
};

async function fetchSpList(listName: string, select: string = '', expand: string = '') {
    const baseUrl = env.VITE_SP_RESOURCE + env.VITE_SP_SITE_RELATIVE;
    let url = `${baseUrl}/lists/getByTitle('${listName}')/items?$top=50`;
    if (select) url += `&$select=${select}`;
    if (expand) url += `&$expand=${expand}`;

    console.log(`FETCHING: ${url}`);
    const token = await acquireToken();
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json;odata=nometadata'
        }
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} - ${await response.text()}`);
    }

    const data = await response.json();
    return data.value || [];
}

async function runSmokeTest() {
  const targets = [
    {
        name: 'Schedules',
        schema: parseSpScheduleRows,
        listName: 'ScheduleEvents',
        select: 'Id,Title,Category,EventDate,EndDate,ServiceType,EventLocation,MeetingUrl,StaffIds,IsAllDayEvent,Status,Description,Author/Id,Author/Title,Editor/Id,Editor/Title,Modified',
        expand: 'Author,Editor'
    },
    {
        name: 'Users',
        schema: SpUserMasterItemSchema,
        listName: 'UserMaster'
    },
    {
        name: 'Daily Records',
        schema: SharePointDailyRecordItemSchema,
        listName: 'DailyRecord'
    },
    {
        name: 'Org Rows (Users)',
        schema: SpOrgRowSchema,
        listName: 'UserMaster'
    },
     {
        name: 'Org Rows (Staff)',
        schema: SpOrgRowSchema,
        listName: 'StaffMaster'
    },
  ];

  console.log('🚀 Starting Live Data Smoke Test...\n');

  for (const target of targets) {
    console.log(`📋 Checking List: ${target.name} (List: ${target.listName})...`);

    try {
        const rawData: unknown[] = await fetchSpList(target.listName, target.select, target.expand);

        let passed = 0;
        let failed = 0;
        const errors: { id: string | number; issues: Array<{ path: (string | number)[]; message: string }> }[] = [];

        rawData.forEach((item: unknown) => {
            const schema: z.ZodTypeAny | null = typeof target.schema === 'function' ? null : target.schema as z.ZodTypeAny;

            if (!schema && target.name === 'Schedules') {
                try {
                   const parsedFn = target.schema as (input: unknown) => unknown[];
                   const parsed = parsedFn([item]);
                   if (parsed.length > 0) {
                       passed++;
                   } else {
                       failed++;
                       const _id = item && typeof item === 'object' && 'Id' in item ? (item as Record<string, unknown>).Id : (item && typeof item === 'object' && 'id' in item ? (item as Record<string, unknown>).id : 'N/A');
                       errors.push({ id: _id as string | number, issues: [{ path: ['N/A'], message: 'Failed to map Schedule Row'}] });
                   }
                } catch(e: unknown) {
                    failed++;
                    const _id = item && typeof item === 'object' && 'Id' in item ? (item as Record<string, unknown>).Id : (item && typeof item === 'object' && 'id' in item ? (item as Record<string, unknown>).id : 'N/A');
                    errors.push({ id: _id as string | number, issues: [{ path: ['N/A'], message: e instanceof Error ? e.message : String(e) }] });
                }
                return;
            }

            if (schema) {
                const result = schema.safeParse(item);
                if (result.success) {
                    passed++;
                } else {
                    failed++;
                    const _id = item && typeof item === 'object' && 'Id' in item ? (item as Record<string, unknown>).Id : (item && typeof item === 'object' && 'id' in item ? (item as Record<string, unknown>).id : 'N/A');
                    errors.push({ id: _id as string | number, issues: result.error.issues });
                }
            }
        });

        console.log(`   ✅ Passed: ${passed}`);
        if (failed > 0) {
            console.warn(`   ⚠️ Failed: ${failed}`);
            errors.forEach((err) => {
                err.issues.forEach(issue => {
                    console.error(`      └─ [ID: ${err.id}] Path: "${issue.path.join('.')}" -> ${issue.message}`);
                });
            });
        }
    } catch (e: unknown) {
        console.error(`   ❌ Failed to fetch or process list: ${e instanceof Error ? e.message : String(e)}`);
    }
    console.log('\n' + '-'.repeat(40) + '\n');
  }
}

runSmokeTest().catch(console.error);

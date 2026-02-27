
import { useMsal } from '@azure/msal-react';
import { useState } from 'react';
import { z, type ZodIssue } from 'zod';
import { SharePointDailyRecordItemSchema } from '../features/daily/schema';
import { SpOrgRowSchema } from '../features/org/data/orgRowSchema';
import { parseSpScheduleRows } from '../features/schedules/data/spRowSchema';
import { SpUserMasterItemSchema } from '../features/users/schema';
import { getAppConfig } from '../lib/env';

export default function SmokeTestPage() {
    const { instance, accounts } = useMsal();
    const [logs, setLogs] = useState<string[]>([]);
    const [isRunning, setIsRunning] = useState(false);

    const log = (msg: string) => setLogs(prev => [...prev, msg]);

    const runDiagnostic = async () => {
        setIsRunning(true);
        setLogs(["・ｽ蝎ｫ Starting Live Data Smoke Test..."]);

        try {
            if (accounts.length === 0) {
                log("隨ｶ繝ｻ[AUTH ERROR]: No active MSAL account found. Please login first.");
                setIsRunning(false);
                return;
            }

            const env = getAppConfig();
            const provider = instance;
            const account = accounts[0];

            log(`隨ｨ繝ｻUsing account: ${account.username}`);

            const tokenResponse = await provider.acquireTokenSilent({
                scopes: [env.VITE_SP_SCOPE_DEFAULT || "https://isogokatudouhome.sharepoint.com/AllSites.Read"],
                account: account
            });

            const token = tokenResponse.accessToken;
            log(`隨ｨ繝ｻToken acquired: ${token.substring(0, 15)}...`);
            const targets = [
                {
                    name: 'Schedules',
                    schema: parseSpScheduleRows,
                    listName: env.VITE_SP_LIST_SCHEDULES || 'ScheduleEvents',
                },
                {
                    name: 'Users',
                    schema: SpUserMasterItemSchema,
                    listName: env.VITE_SP_LIST_USERS || 'Users_Master'
                },
                {
                    name: 'Daily Records',
                    schema: SharePointDailyRecordItemSchema,
                    listName: env.VITE_SP_LIST_DAILY || 'SupportRecord_Daily'
                },
                {
                    name: 'Org Rows (Users)',
                    schema: SpOrgRowSchema,
                    listName: env.VITE_SP_LIST_USERS || 'Users_Master'
                },
                 {
                    name: 'Org Rows (Staff)',
                    schema: SpOrgRowSchema,
                    listName: env.VITE_SP_LIST_STAFF || 'Staff_Master'
                },
            ];

            for (const target of targets) {
                log(`\n謳ｭ Checking List: ${target.name} (List: ${target.listName})...`);
                const baseUrl = env.VITE_SP_RESOURCE + env.VITE_SP_SITE_RELATIVE + '/_api/web';
                const url = `${baseUrl}/lists/getByTitle('${target.listName}')/items?$top=50`;
                
                

                try {
                    const response = await fetch(url, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Accept': 'application/json;odata=nometadata'
                        }
                    });

                    if (!response.ok) {
                        log(`   隨ｶ繝ｻHTTP error! status: ${response.status}`);
                        continue;
                    }

                    const data = await response.json();
                    const rawData = data.value || [];

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
                                errors.push({ id: _id as string | number, issues: result.error.issues.map((i: ZodIssue) => ({ path: i.path as (string | number)[], message: i.message })) });
                            }
                        }
                    });

                    log(`   隨ｨ繝ｻPassed: ${passed}`);
                    if (failed > 0) {
                        log(`   隨橸ｿｽ繝ｻ繝ｻFailed: ${failed}`);
                        errors.forEach((err) => {
                            err.issues.forEach(issue => {
                                log(`      隨乗喚讌ｳ [ID: ${err.id}] Path: "${issue.path.join('.')}" -> ${issue.message}`);
                            });
                        });
                    }
                } catch (e: unknown) {
                    log(`   隨ｶ繝ｻFailed to fetch or process list: ${e instanceof Error ? e.message : String(e)}`);
                }
            }
            log("\n・ｽ邏・Diagnostics Complete!");

        } catch (e: unknown) {
            log(`隨ｶ繝ｻFatal Error: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            setIsRunning(false);
        }
    }

    return (
        <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', fontFamily: 'monospace' }}>
            <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Data Smoke Test Runner</h1>
            <p style={{ marginBottom: '2rem', color: '#666' }}>
                This page uses your active browser session to download real production data and test it against the local schemas.
            </p>

            <button
                onClick={runDiagnostic}
                disabled={isRunning}
                style={{
                    padding: '0.75rem 1.5rem',
                    background: isRunning ? '#ccc' : '#0066cc',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: isRunning ? 'not-allowed' : 'pointer',
                    fontWeight: 'bold',
                    marginBottom: '2rem'
                }}
            >
                {isRunning ? 'Running Diagnostics...' : '隨・ｽｶ繝ｻ繝ｻRun Smoke Test'}
            </button>

            <div style={{
                background: '#1e1e1e',
                color: '#d4d4d4',
                padding: '1.5rem',
                borderRadius: '8px',
                minHeight: '300px',
                maxHeight: '600px',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                fontSize: '0.9rem',
                lineHeight: '1.5'
            }}>
                {logs.length === 0 ? (
                    <span style={{ color: '#666' }}>Ready. Click the button above to begin.</span>
                ) : (
                    logs.map((L, i) => <div key={i}>{L}</div>)
                )}
            </div>
        </div>
    )
}




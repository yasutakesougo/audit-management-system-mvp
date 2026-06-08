/* eslint-disable */
import { test } from '@playwright/test';
import { resolveSharePointSiteUrl } from './_shared/resolveSiteUrl';
import * as fs from 'fs';

const SUPPORT_CASE_SHAREPOINT_DIAGNOSTICS_FLAG =
  'VITE_FEATURE_SUPPORT_CASE_SHAREPOINT_DIAGNOSTICS';

type SupportCaseDiagnosticTarget = {
  key: string;
  displayName: string;
  listTitle: string;
  essentialFields: string[];
  fieldCandidates: Record<string, readonly string[]>;
};

const isTruthy = (value: string | undefined): boolean =>
  ['1', 'true', 'yes', 'y', 'on', 'enabled'].includes(
    String(value ?? '').trim().toLowerCase(),
  );

const supportCaseDiagnosticTargets = (): SupportCaseDiagnosticTarget[] => {
  if (!isTruthy(process.env[SUPPORT_CASE_SHAREPOINT_DIAGNOSTICS_FLAG])) return [];

  return [
    {
      key: 'support_cases',
      displayName: '汎用支援ケース',
      listTitle: process.env.VITE_SP_LIST_SUPPORT_CASES || 'SupportCases',
      essentialFields: ['CaseId', 'TenantId', 'UserId', 'Status'],
      fieldCandidates: {
        CaseId: ['CaseId', 'Case_x0020_ID', 'caseId', 'cr013_caseId'],
        TenantId: ['TenantId', 'Tenant_x0020_ID', 'tenantId', 'cr013_tenantId'],
        UserId: ['UserId', 'User_x0020_ID', 'UserID', 'userId', 'cr013_userId'],
        Status: ['Status', 'CaseStatus', 'status'],
      },
    },
    {
      key: 'support_case_documents',
      displayName: '汎用支援ケース文書索引',
      listTitle:
        process.env.VITE_SP_LIST_SUPPORT_CASE_DOCUMENTS ||
        'SupportCaseDocuments',
      essentialFields: [
        'DocumentId',
        'TenantId',
        'SupportCaseId',
        'Category',
        'StoragePolicy',
        'LibraryTarget',
        'Sensitivity',
        'AuditLogRequired',
      ],
      fieldCandidates: {
        DocumentId: ['DocumentId', 'Document_x0020_ID', 'documentId', 'cr013_documentId'],
        TenantId: ['TenantId', 'Tenant_x0020_ID', 'tenantId', 'cr013_tenantId'],
        SupportCaseId: ['SupportCaseId', 'Support_x0020_Case_x0020_ID', 'CaseId', 'caseId'],
        Category: ['Category', 'DocumentCategory', 'Document_x0020_Category'],
        StoragePolicy: ['StoragePolicy', 'Storage_x0020_Policy', 'storagePolicy'],
        LibraryTarget: ['LibraryTarget', 'Library_x0020_Target', 'libraryTarget'],
        Sensitivity: ['Sensitivity', 'DocumentSensitivity', 'sensitivity'],
        AuditLogRequired: ['AuditLogRequired', 'Audit_x0020_Log_x0020_Required', 'auditLogRequired'],
      },
    },
    {
      key: 'support_case_events',
      displayName: '汎用支援ケース監査イベント',
      listTitle: process.env.VITE_SP_LIST_SUPPORT_CASE_EVENTS || 'SupportCaseEvents',
      essentialFields: [
        'EventId',
        'TenantId',
        'SupportCaseId',
        'Action',
        'ActorId',
        'OccurredAt',
        'AuditLogRequired',
      ],
      fieldCandidates: {
        EventId: ['EventId', 'Event_x0020_ID', 'eventId', 'cr013_eventId'],
        TenantId: ['TenantId', 'Tenant_x0020_ID', 'tenantId', 'cr013_tenantId'],
        SupportCaseId: ['SupportCaseId', 'Support_x0020_Case_x0020_ID', 'CaseId', 'caseId'],
        Action: ['Action', 'EventType', 'Event_x0020_Type', 'eventType'],
        ActorId: ['ActorId', 'Actor_x0020_ID', 'actorId'],
        OccurredAt: ['OccurredAt', 'Occurred_x0020_At', 'occurredAt'],
        AuditLogRequired: ['AuditLogRequired', 'Audit_x0020_Log_x0020_Required', 'auditLogRequired'],
      },
    },
    {
      key: 'support_case_restricted_documents',
      displayName: '汎用支援ケース個人情報書類',
      listTitle:
        process.env.VITE_SP_LIBRARY_SUPPORT_CASE_RESTRICTED_DOCUMENTS ||
        'SupportCaseRestrictedDocuments',
      essentialFields: [
        'DocumentId',
        'TenantId',
        'SupportCaseId',
        'Category',
        'StoragePolicy',
        'LibraryTarget',
        'Sensitivity',
        'AuditLogRequired',
      ],
      fieldCandidates: {
        DocumentId: ['DocumentId', 'Document_x0020_ID', 'documentId', 'cr013_documentId'],
        TenantId: ['TenantId', 'Tenant_x0020_ID', 'tenantId', 'cr013_tenantId'],
        SupportCaseId: ['SupportCaseId', 'Support_x0020_Case_x0020_ID', 'CaseId', 'caseId'],
        Category: ['Category', 'DocumentCategory', 'Document_x0020_Category'],
        StoragePolicy: ['StoragePolicy', 'Storage_x0020_Policy', 'storagePolicy'],
        LibraryTarget: ['LibraryTarget', 'Library_x0020_Target', 'libraryTarget'],
        Sensitivity: ['Sensitivity', 'DocumentSensitivity', 'sensitivity'],
        AuditLogRequired: ['AuditLogRequired', 'Audit_x0020_Log_x0020_Required', 'auditLogRequired'],
      },
    },
  ];
};

/**
 * Diagnostic: Check SharePoint permissions and list existence
 * 
 * Run: SHAREPOINT_SITE=https://... npm run ci:integration:diagnose
 */
test.describe('SharePoint Diagnostics', () => {
  const STORAGE_STATE_PATH = 'tests/.auth/storageState.json';
  const supportCaseTargets = supportCaseDiagnosticTargets();
  
  test.use({
    storageState: STORAGE_STATE_PATH,
  });
  const siteUrl = resolveSharePointSiteUrl();

  test.beforeEach(async () => {
    console.log(`\n--- SharePoint Diagnostic Start ---`);
    console.log(`Site URL: ${siteUrl}`);
    
    if (fs.existsSync(STORAGE_STATE_PATH)) {
      const stats = fs.statSync(STORAGE_STATE_PATH);
      const ageMs = Date.now() - stats.mtimeMs;
      const ageDays = (ageMs / (1000 * 60 * 60 * 24)).toFixed(1);
      console.log(`Auth State: ${STORAGE_STATE_PATH} (${ageDays} days old, mtime: ${stats.mtime.toISOString()})`);
      if (ageMs > 1000 * 60 * 60 * 24 * 7) {
        console.warn(`⚠️ Warning: Auth state is older than 7 days. This might cause 401/403 errors.`);
      }
    } else {
      console.error(`❌ Error: ${STORAGE_STATE_PATH} not found. Run 'npm run auth:setup' first.`);
    }
  });

  test('1. Current user (who am I?)', async ({ context }) => {
    const request = context.request;
    const url = `${siteUrl}/_api/web/currentuser`;
    console.log(`\n[診断1] Checking current user: ${url}`);

    try {
      const res = await request.get(url, {
        headers: { 'Accept': 'application/json;odata=verbose' }
      });
      const status = res.status();
      console.log(`Status: ${status}`);

      if (res.ok()) {
        const json = await res.json();
        const user = json?.d || json;
        console.log(`✅ Current User:`);
        console.log(`   Title: ${user.Title}`);
        console.log(`   Email: ${user.Email}`);
      } else {
        const body = await res.text().catch(() => '');
        classifyAuthError(status, body, 'Current User');
      }
    } catch (err) {
      console.error(`❌ Exception:`, err);
    }
  });

  test('2. Staff_Master list existence and permissions', async ({ context }) => {
    const request = context.request;
    const url = `${siteUrl}/_api/web/lists/GetByTitle('Staff_Master')?$select=Title,Id,Hidden,HasUniqueRoleAssignments,BaseTemplate`;
    console.log(`\n[診断2] Checking Staff_Master list: ${url}`);

    try {
      const res = await request.get(url, {
        headers: { 'Accept': 'application/json;odata=verbose' }
      });
      const status = res.status();
      console.log(`Status: ${status}`);

      if (res.ok()) {
        const json = await res.json();
        const list = json?.d || json;
        console.log(`✅ List Found: ${list.Title} (${list.Id})`);
      } else {
        const body = await res.text().catch(() => '');
        classifyAuthError(status, body, 'List Metadata');
      }
    } catch (err) {
      console.error(`❌ Exception:`, err);
    }
  });

  test('3. Staff_Master items endpoint', async ({ context }) => {
    const request = context.request;
    const url = `${siteUrl}/_api/web/lists/GetByTitle('Staff_Master')/items?$select=Id&$top=1`;
    console.log(`\n[診断3] Checking items endpoint: ${url}`);

    try {
      const res = await request.get(url, {
        headers: { 'Accept': 'application/json;odata=verbose' }
      });
      const status = res.status();
      console.log(`Status: ${status}`);

      if (res.ok()) {
        const json = await res.json();
        console.log(`✅ Items accessible (Count: ${json?.d?.results?.length ?? json?.value?.length ?? 0})`);
      } else {
        const body = await res.text().catch(() => '');
        classifyAuthError(status, body, 'List Items');
        
        const headers = res.headers();
        const sprequestguid = headers['sprequestguid'] || headers['request-id'] || 'N/A';
        console.error(`   sprequestguid: ${sprequestguid}`);
      }
    } catch (err) {
      console.error(`❌ Exception:`, err);
    }
  });

  test('4. SupportCase experimental definitions (opt-in, read-only)', async ({ context }, testInfo) => {
    test.skip(
      supportCaseTargets.length === 0,
      `${SUPPORT_CASE_SHAREPOINT_DIAGNOSTICS_FLAG}=1 is required for SupportCase diagnostics.`,
    );

    const request = context.request;
    console.log(`\n[診断4] Checking SupportCase experimental definitions (read-only)`);
    console.log(`Flag: ${SUPPORT_CASE_SHAREPOINT_DIAGNOSTICS_FLAG}=enabled`);
    console.log(`Targets: ${supportCaseTargets.map((target) => target.listTitle).join(', ')}`);

    for (const target of supportCaseTargets) {
      const metadataUrl = `${siteUrl}/_api/web/lists/GetByTitle('${encodeURIComponent(target.listTitle)}')?$select=Title,Id,Hidden,HasUniqueRoleAssignments,BaseTemplate`;
      console.log(`\n[SupportCase] List metadata: ${metadataUrl}`);

      const metadataRes = await request.get(metadataUrl, {
        headers: { 'Accept': 'application/json;odata=verbose' },
      });
      const metadataStatus = metadataRes.status();
      console.log(`Status: ${metadataStatus}`);

      if (!metadataRes.ok()) {
        const body = await metadataRes.text().catch(() => '');
        classifyAuthError(metadataStatus, body, `SupportCase list ${target.key}`);
        testInfo.annotations.push({
          type: 'support-case-diagnostic',
          description: `${target.key}: list metadata returned HTTP ${metadataStatus}`,
        });
        continue;
      }

      const metadataJson = await metadataRes.json();
      const list = metadataJson?.d || metadataJson;
      console.log(`List Found: ${list.Title} (${list.Id}), BaseTemplate=${list.BaseTemplate}`);

      await diagnoseSupportCaseFields(siteUrl, request, target, testInfo);
    }
  });
});

function classifyAuthError(status: number, body: string, label: string) {
  if (status === 401) {
    console.error(`❌ [${label}] 401 Unauthorized: Authentication session has expired.`);
    console.error(`👉 Action: Regenerate PW_STORAGE_STATE_B64 by running 'npm run auth:setup' locally.`);
  } else if (status === 403) {
    console.error(`❌ [${label}] 403 Forbidden: Access denied.`);
    console.error(`👉 Action: Check if the user has Read permissions on the site/list AND verify if storageState.json is fresh.`);
  } else {
    console.error(`❌ [${label}] HTTP ${status} Failure`);
  }
  console.error(`   Body snippet: ${body.slice(0, 200)}`);
}

async function diagnoseSupportCaseFields(
  siteUrl: string,
  request: { get: (url: string, options?: { headers?: Record<string, string> }) => Promise<{ ok: () => boolean; status: () => number; json: () => Promise<any>; text: () => Promise<string> }> },
  target: SupportCaseDiagnosticTarget,
  testInfo: { annotations: Array<{ type: string; description?: string }> },
) {
  const fieldsUrl = `${siteUrl}/_api/web/lists/GetByTitle('${encodeURIComponent(target.listTitle)}')/fields?$select=InternalName,Title,TypeAsString,Hidden,ReadOnlyField`;
  console.log(`[SupportCase] Fields: ${fieldsUrl}`);

  const fieldsRes = await request.get(fieldsUrl, {
    headers: { 'Accept': 'application/json;odata=verbose' },
  });
  const fieldsStatus = fieldsRes.status();
  console.log(`Fields status: ${fieldsStatus}`);

  if (!fieldsRes.ok()) {
    const body = await fieldsRes.text().catch(() => '');
    classifyAuthError(fieldsStatus, body, `SupportCase fields ${target.key}`);
    testInfo.annotations.push({
      type: 'support-case-diagnostic',
      description: `${target.key}: fields endpoint returned HTTP ${fieldsStatus}`,
    });
    return;
  }

  const fieldsJson = await fieldsRes.json();
  const fields = Array.isArray(fieldsJson?.d?.results)
    ? fieldsJson.d.results
    : Array.isArray(fieldsJson?.value)
      ? fieldsJson.value
      : [];
  const internalNames = new Set(
    fields
      .map((field: { InternalName?: unknown }) => String(field.InternalName ?? ''))
      .filter(Boolean),
  );

  for (const essential of target.essentialFields ?? []) {
    const candidates = target.fieldCandidates?.[essential] ?? [essential];
    const matched = candidates.find((candidate) => internalNames.has(candidate));
    const message = matched
      ? `${target.key}.${essential}: matched ${matched}`
      : `${target.key}.${essential}: missing candidates [${candidates.join(', ')}]`;

    console.log(`  ${message}`);
    testInfo.annotations.push({
      type: matched ? 'support-case-field-ok' : 'support-case-field-missing',
      description: message,
    });
  }
}

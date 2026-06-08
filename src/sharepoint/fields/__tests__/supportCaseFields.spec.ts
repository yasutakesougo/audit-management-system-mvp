import { describe, expect, it } from 'vitest';
import {
  getDriftProbeTargets,
  getSupportCaseExperimentalDriftProbeTargets,
  SUPPORT_CASE_SHAREPOINT_DIAGNOSTICS_FLAG,
} from '@/sharepoint/driftProbeRegistry';
import { findListEntry } from '@/sharepoint/spListRegistry';
import {
  SUPPORT_CASE_DOCUMENTS_CANDIDATES,
  SUPPORT_CASE_EVENTS_CANDIDATES,
  SUPPORT_CASE_RESTRICTED_DOCUMENTS_LIBRARY_TITLE,
  SUPPORT_CASES_CANDIDATES,
} from '../supportCaseFields';

const registryKeys = [
  'support_cases',
  'support_case_documents',
  'support_case_events',
  'support_case_restricted_documents',
] as const;

describe('SupportCase SharePoint definitions', () => {
  it('registers definitions as opt-in experimental resources', () => {
    for (const key of registryKeys) {
      const entry = findListEntry(key);
      expect(entry).toBeDefined();
      expect(entry?.lifecycle).toBe('experimental');
      expect(entry?.provisioningFields?.length).toBeGreaterThan(0);
    }
  });

  it('keeps experimental resources out of default drift probes', () => {
    const targetKeys = new Set(getDriftProbeTargets().map((target) => target.key));

    for (const key of registryKeys) {
      expect(targetKeys.has(key)).toBe(false);
    }
  });

  it('keeps SupportCase diagnostics empty until the explicit flag is enabled', () => {
    expect(getSupportCaseExperimentalDriftProbeTargets()).toEqual([]);
    expect(
      getSupportCaseExperimentalDriftProbeTargets({
        [SUPPORT_CASE_SHAREPOINT_DIAGNOSTICS_FLAG]: '0',
      }),
    ).toEqual([]);
  });

  it('builds opt-in diagnostic targets for experimental SupportCase resources', () => {
    const targets = getSupportCaseExperimentalDriftProbeTargets({
      [SUPPORT_CASE_SHAREPOINT_DIAGNOSTICS_FLAG]: '1',
    });
    const targetKeys = targets.map((target) => target.key);

    expect(targetKeys).toEqual([...registryKeys]);
    expect(targets).toHaveLength(4);
    expect(targets.every((target) => target.selectFields.includes('Id'))).toBe(true);
    expect(targets.every((target) => target.selectFields.includes('Title'))).toBe(true);
    expect(targets.find((target) => target.key === 'support_cases')?.selectFields).toEqual(
      expect.arrayContaining(['CaseId', 'TenantId', 'UserId', 'Status']),
    );
    expect(
      targets.find((target) => target.key === 'support_case_documents')
        ?.fieldCandidates?.SupportCaseId,
    ).toEqual(SUPPORT_CASE_DOCUMENTS_CANDIDATES.caseId);
    expect(
      targets.find((target) => target.key === 'support_case_events')
        ?.fieldCandidates?.Action,
    ).toEqual(SUPPORT_CASE_EVENTS_CANDIDATES.eventType);
    expect(
      targets.find((target) => target.key === 'support_case_restricted_documents')
        ?.baseTemplate,
    ).toBe(101);
  });

  it('defines the restricted personal document target as a separate library', () => {
    const restricted = findListEntry('support_case_restricted_documents');
    const standardMetadata = findListEntry('support_case_documents');

    expect(restricted?.resolve()).toBe(SUPPORT_CASE_RESTRICTED_DOCUMENTS_LIBRARY_TITLE);
    expect(restricted?.baseTemplate).toBe(101);
    expect(standardMetadata?.baseTemplate).toBeUndefined();
    expect(restricted?.resolve()).not.toBe(standardMetadata?.resolve());
  });

  it('keeps essential fields inside each provisioning definition', () => {
    for (const key of registryKeys) {
      const entry = findListEntry(key);
      const provisioned = new Set(
        entry?.provisioningFields?.map((field) => field.internalName),
      );

      for (const essential of entry?.essentialFields ?? []) {
        expect(provisioned.has(essential)).toBe(true);
      }
    }
  });

  it('requires tenant, case, storage policy, and audit fields for documents', () => {
    const documents = findListEntry('support_case_documents');
    const restricted = findListEntry('support_case_restricted_documents');

    expect(documents?.essentialFields).toEqual(
      expect.arrayContaining([
        'TenantId',
        'SupportCaseId',
        'StoragePolicy',
        'LibraryTarget',
        'Sensitivity',
        'AuditLogRequired',
      ]),
    );
    expect(restricted?.essentialFields).toEqual(
      expect.arrayContaining([
        'TenantId',
        'SupportCaseId',
        'StoragePolicy',
        'LibraryTarget',
        'Sensitivity',
        'AuditLogRequired',
      ]),
    );
  });

  it('uses canonical names first and includes encoded field candidates', () => {
    expect(SUPPORT_CASES_CANDIDATES.tenantId[0]).toBe('TenantId');
    expect(SUPPORT_CASES_CANDIDATES.tenantId).toContain('Tenant_x0020_ID');
    expect(SUPPORT_CASE_DOCUMENTS_CANDIDATES.caseId[0]).toBe('SupportCaseId');
    expect(SUPPORT_CASE_DOCUMENTS_CANDIDATES.storagePolicy).toContain(
      'Storage_x0020_Policy',
    );
    expect(SUPPORT_CASE_DOCUMENTS_CANDIDATES.auditLogRequired).toContain(
      'Audit_x0020_Log_x0020_Required',
    );
    expect(SUPPORT_CASE_EVENTS_CANDIDATES.eventType[0]).toBe('Action');
    expect(SUPPORT_CASE_EVENTS_CANDIDATES.actorName).toContain(
      'Actor_x0020_Name',
    );
  });
});

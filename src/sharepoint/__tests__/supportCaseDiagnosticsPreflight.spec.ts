import { describe, expect, it } from 'vitest';
import type { DriftProbeTarget } from '../contracts/driftProbeTargets';
import {
  getDriftProbeTargets,
  getSupportCaseExperimentalDriftProbeTargets,
  SUPPORT_CASE_SHAREPOINT_DIAGNOSTICS_FLAG,
} from '../driftProbeRegistry';
import {
  runSupportCaseDiagnosticsPreflight,
  SUPPORT_CASE_DIAGNOSTIC_KEYS,
} from '../supportCaseDiagnosticsPreflight';
import { SP_LIST_REGISTRY } from '../spListRegistry';
import type { SpListEntry } from '../spListRegistry';

const optInEnv = {
  [SUPPORT_CASE_SHAREPOINT_DIAGNOSTICS_FLAG]: '1',
};

const appTestInput = {
  environmentName: 'app-test',
  siteUrl: 'https://tenant.sharepoint.com/sites/app-test',
  envOverride: optInEnv,
};

describe('SupportCase app-test diagnostics preflight', () => {
  it('fails when the target looks like production', () => {
    const result = runSupportCaseDiagnosticsPreflight({
      environmentName: 'production',
      siteUrl: 'https://tenant.sharepoint.com/sites/prod',
      envOverride: optInEnv,
    });

    expect(result.ok).toBe(false);
    expect(result.failures).toContain('production_site_suspected');
  });

  it('passes for app-test when diagnostics opt-in is explicit', () => {
    const result = runSupportCaseDiagnosticsPreflight(appTestInput);

    expect(result).toEqual({
      ok: true,
      failures: [],
      warnings: [],
    });
  });

  it('fails when SupportCase targets are present without opt-in', () => {
    const defaultTargets: DriftProbeTarget[] = [
      ...getDriftProbeTargets(),
      {
        key: 'support_cases',
        displayName: '汎用支援ケース',
        listTitle: 'SupportCases',
        selectFields: ['Id', 'Title', 'CaseId'],
      },
    ];

    const result = runSupportCaseDiagnosticsPreflight({
      environmentName: 'app-test',
      siteUrl: 'https://tenant.sharepoint.com/sites/app-test',
      defaultTargets,
    });

    expect(result.ok).toBe(false);
    expect(result.failures).toEqual(
      expect.arrayContaining([
        'support_case_diagnostics_opt_in_missing',
        'support_case_included_without_opt_in',
      ]),
    );
  });

  it('keeps SupportCase resources out of default target selection', () => {
    const targetKeys = new Set(getDriftProbeTargets().map(target => target.key));

    for (const key of SUPPORT_CASE_DIAGNOSTIC_KEYS) {
      expect(targetKeys.has(key)).toBe(false);
    }
  });

  it('includes SupportCase resources only in opt-in target selection', () => {
    expect(getSupportCaseExperimentalDriftProbeTargets()).toEqual([]);

    const targetKeys = getSupportCaseExperimentalDriftProbeTargets(optInEnv).map(
      target => target.key,
    );

    expect(targetKeys).toEqual([...SUPPORT_CASE_DIAGNOSTIC_KEYS]);
  });

  it('fails when opt-in does not produce every SupportCase target', () => {
    const result = runSupportCaseDiagnosticsPreflight({
      ...appTestInput,
      optInTargets: getSupportCaseExperimentalDriftProbeTargets(optInEnv).filter(
        target => target.key !== 'support_case_events',
      ),
    });

    expect(result.ok).toBe(false);
    expect(result.failures).toContain('support_case_opt_in_targets_missing');
  });

  it('requires restricted documents to remain a document library', () => {
    const restricted = getSupportCaseExperimentalDriftProbeTargets(optInEnv).find(
      target => target.key === 'support_case_restricted_documents',
    );

    expect(restricted?.baseTemplate).toBe(101);

    const registryEntries = SP_LIST_REGISTRY.map(entry =>
      entry.key === 'support_case_restricted_documents'
        ? ({ ...entry, baseTemplate: undefined } as SpListEntry)
        : entry,
    );

    const result = runSupportCaseDiagnosticsPreflight({
      ...appTestInput,
      registryEntries,
    });

    expect(result.ok).toBe(false);
    expect(result.failures).toContain('restricted_library_not_document_library');
  });

  it('requires restricted documents to stay separate from standard document metadata', () => {
    const standard = SP_LIST_REGISTRY.find(
      entry => entry.key === 'support_case_documents',
    );
    const registryEntries = SP_LIST_REGISTRY.map(entry =>
      entry.key === 'support_case_restricted_documents' && standard
        ? ({ ...entry, resolve: standard.resolve } as SpListEntry)
        : entry,
    );

    const result = runSupportCaseDiagnosticsPreflight({
      ...appTestInput,
      registryEntries,
    });

    expect(result.ok).toBe(false);
    expect(result.failures).toContain(
      'restricted_library_mixed_with_standard_documents',
    );
  });

  it('requires SupportCase resources to remain experimental', () => {
    const registryEntries = SP_LIST_REGISTRY.map(entry =>
      entry.key === 'support_cases'
        ? ({ ...entry, lifecycle: 'optional' } as SpListEntry)
        : entry,
    );

    const result = runSupportCaseDiagnosticsPreflight({
      ...appTestInput,
      registryEntries,
    });

    expect(result.ok).toBe(false);
    expect(result.failures).toContain('support_case_lifecycle_not_experimental');
  });
});

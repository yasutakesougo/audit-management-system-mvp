import type { DriftProbeTarget } from './contracts/driftProbeTargets';
import {
  getDriftProbeTargets,
  getSupportCaseExperimentalDriftProbeTargets,
  isSupportCaseSharePointDiagnosticsEnabled,
} from './driftProbeRegistry';
import { SP_LIST_REGISTRY, type SpListEntry } from './spListRegistry';
import type { EnvRecord } from '@/lib/env';

export const SUPPORT_CASE_DIAGNOSTIC_KEYS = [
  'support_cases',
  'support_case_documents',
  'support_case_events',
  'support_case_restricted_documents',
] as const;

export type SupportCaseDiagnosticKey =
  (typeof SUPPORT_CASE_DIAGNOSTIC_KEYS)[number];

export type SupportCaseDiagnosticsPreflightFailure =
  | 'production_site_suspected'
  | 'app_test_target_missing'
  | 'support_case_diagnostics_opt_in_missing'
  | 'support_case_included_without_opt_in'
  | 'support_case_opt_in_targets_missing'
  | 'support_case_lifecycle_not_experimental'
  | 'restricted_library_not_document_library'
  | 'restricted_library_mixed_with_standard_documents';

export type SupportCaseDiagnosticsPreflightWarning =
  | 'site_url_missing'
  | 'environment_name_missing';

export interface SupportCaseDiagnosticsPreflightInput {
  environmentName?: string;
  siteUrl?: string;
  envOverride?: EnvRecord;
  defaultTargets?: readonly DriftProbeTarget[];
  optInTargets?: readonly DriftProbeTarget[];
  registryEntries?: readonly SpListEntry[];
}

export interface SupportCaseDiagnosticsPreflightResult {
  ok: boolean;
  failures: SupportCaseDiagnosticsPreflightFailure[];
  warnings: SupportCaseDiagnosticsPreflightWarning[];
}

const SUPPORT_CASE_KEY_SET = new Set<string>(SUPPORT_CASE_DIAGNOSTIC_KEYS);
const RESTRICTED_DOCUMENTS_KEY = 'support_case_restricted_documents';
const STANDARD_DOCUMENTS_KEY = 'support_case_documents';

const normalize = (value?: string): string =>
  String(value ?? '').trim().toLowerCase();

const hasAppTestMarker = (value: string): boolean =>
  /(^|[^a-z0-9])(app[-_]?test|apptest)([^a-z0-9]|$)/i.test(value);

const hasProductionMarker = (value: string): boolean =>
  /(^|[^a-z0-9])(prod|production)([^a-z0-9]|$)/i.test(value);

const includesSupportCaseTarget = (targets: readonly DriftProbeTarget[]): boolean =>
  targets.some(target => SUPPORT_CASE_KEY_SET.has(target.key));

const listSupportCaseTargetKeys = (
  targets: readonly DriftProbeTarget[],
): Set<string> =>
  new Set(
    targets
      .filter(target => SUPPORT_CASE_KEY_SET.has(target.key))
      .map(target => target.key),
  );

const addFailure = (
  failures: SupportCaseDiagnosticsPreflightFailure[],
  failure: SupportCaseDiagnosticsPreflightFailure,
): void => {
  if (!failures.includes(failure)) failures.push(failure);
};

const findEntry = (
  registryEntries: readonly SpListEntry[],
  key: SupportCaseDiagnosticKey,
): SpListEntry | undefined => registryEntries.find(entry => entry.key === key);

export function runSupportCaseDiagnosticsPreflight(
  input: SupportCaseDiagnosticsPreflightInput,
): SupportCaseDiagnosticsPreflightResult {
  const registryEntries = input.registryEntries ?? SP_LIST_REGISTRY;
  const defaultTargets = input.defaultTargets ?? getDriftProbeTargets(input.envOverride);
  const optInTargets =
    input.optInTargets ?? getSupportCaseExperimentalDriftProbeTargets(input.envOverride);
  const optInEnabled = isSupportCaseSharePointDiagnosticsEnabled(input.envOverride);

  const failures: SupportCaseDiagnosticsPreflightFailure[] = [];
  const warnings: SupportCaseDiagnosticsPreflightWarning[] = [];
  const environmentName = normalize(input.environmentName);
  const siteUrl = normalize(input.siteUrl);
  const targetLabel = `${environmentName} ${siteUrl}`.trim();

  if (!environmentName) warnings.push('environment_name_missing');
  if (!siteUrl) warnings.push('site_url_missing');

  if (hasProductionMarker(targetLabel)) {
    addFailure(failures, 'production_site_suspected');
  }

  if (!hasAppTestMarker(targetLabel)) {
    addFailure(failures, 'app_test_target_missing');
  }

  if (!optInEnabled) {
    addFailure(failures, 'support_case_diagnostics_opt_in_missing');
  }

  if (includesSupportCaseTarget(defaultTargets)) {
    addFailure(failures, 'support_case_included_without_opt_in');
  }

  if (optInEnabled) {
    const optInTargetKeys = listSupportCaseTargetKeys(optInTargets);
    const hasAllSupportCaseTargets = SUPPORT_CASE_DIAGNOSTIC_KEYS.every(key =>
      optInTargetKeys.has(key),
    );

    if (!hasAllSupportCaseTargets) {
      addFailure(failures, 'support_case_opt_in_targets_missing');
    }
  }

  for (const key of SUPPORT_CASE_DIAGNOSTIC_KEYS) {
    if (findEntry(registryEntries, key)?.lifecycle !== 'experimental') {
      addFailure(failures, 'support_case_lifecycle_not_experimental');
    }
  }

  const restrictedEntry = findEntry(registryEntries, RESTRICTED_DOCUMENTS_KEY);
  const standardEntry = findEntry(registryEntries, STANDARD_DOCUMENTS_KEY);

  if (restrictedEntry?.baseTemplate !== 101) {
    addFailure(failures, 'restricted_library_not_document_library');
  }

  if (restrictedEntry?.resolve() === standardEntry?.resolve()) {
    addFailure(failures, 'restricted_library_mixed_with_standard_documents');
  }

  return {
    ok: failures.length === 0,
    failures,
    warnings,
  };
}

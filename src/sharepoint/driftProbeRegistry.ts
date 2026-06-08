/**
 * Drift Probe Registry — SSOT Bridge for Schema Drift Monitoring
 *
 * Dynamically generates DriftProbeTarget[] from SP_LIST_REGISTRY.
 * This file acts as the official registry for Nightly Patrol and UI.
 */
import { SP_LIST_REGISTRY, type SpListEntry } from './spListRegistry';
import { type DriftProbeTarget } from './contracts/driftProbeTargets';
import { readBool, type EnvRecord } from '@/lib/env';
import {
  BILLING_ORDERS_REGISTRY_KEY,
  shouldExcludeBillingOrdersFromDefaultSiteDrift,
} from './crossSiteDrift';

export const SUPPORT_CASE_SHAREPOINT_DIAGNOSTICS_FLAG =
  'VITE_FEATURE_SUPPORT_CASE_SHAREPOINT_DIAGNOSTICS';

const SUPPORT_CASE_REGISTRY_KEYS = new Set([
  'support_cases',
  'support_case_documents',
  'support_case_events',
  'support_case_restricted_documents',
]);

function toDriftProbeTarget(entry: SpListEntry): DriftProbeTarget {
  // 1. Resolve actual list title (honoring environment variable overrides if any)
  const listTitle = entry.resolve();

  // 2. Derive selectFields:
  //    Prioritize essentialFields, then add Id/Title if missing,
  //    or fallback to first 5 fields from provisioningFields if essentialFields is empty.
  const rawFields = [...(entry.essentialFields || [])];

  // Ensure universal identifiers
  if (!rawFields.includes('Id')) rawFields.unshift('Id');
  if (!rawFields.includes('Title')) rawFields.push('Title');

  // Add a few more from provisioning if we're thin
  if (rawFields.length < 5 && entry.provisioningFields) {
    for (const f of entry.provisioningFields) {
      if (!rawFields.includes(f.internalName)) {
        rawFields.push(f.internalName);
      }
      if (rawFields.length >= 8) break;
    }
  }

  const fieldCandidates = (entry.provisioningFields ?? []).reduce<
    Record<string, readonly string[]>
  >((acc, field) => {
    if (field.candidates && field.candidates.length > 0) {
      acc[field.internalName] = field.candidates;
    }
    return acc;
  }, {});

  const target: DriftProbeTarget = {
    key: entry.key,
    displayName: entry.displayName,
    listTitle,
    selectFields: rawFields,
    essentialFields: entry.essentialFields ? [...entry.essentialFields] : undefined,
    baseTemplate: entry.baseTemplate,
  };

  if (Object.keys(fieldCandidates).length > 0) {
    target.fieldCandidates = fieldCandidates;
  }

  return target;
}

export function isSupportCaseSharePointDiagnosticsEnabled(
  envOverride?: EnvRecord,
): boolean {
  return readBool(SUPPORT_CASE_SHAREPOINT_DIAGNOSTICS_FLAG, false, envOverride);
}

/**
 * Generates the list of probe targets based on the central SP_LIST_REGISTRY.
 * Filters out deprecated/experimental lists to ensure monitoring stability.
 */
export function getDriftProbeTargets(envOverride?: EnvRecord): DriftProbeTarget[] {
  const excludeBillingOrders = shouldExcludeBillingOrdersFromDefaultSiteDrift(envOverride);

  return SP_LIST_REGISTRY
    .filter(entry => entry.lifecycle === 'required' || entry.lifecycle === 'optional')
    .filter(entry => !(excludeBillingOrders && entry.key === BILLING_ORDERS_REGISTRY_KEY))
    .map(toDriftProbeTarget);
}

/**
 * Opt-in diagnostic targets for experimental SupportCase SharePoint resources.
 *
 * This intentionally stays separate from getDriftProbeTargets() so default
 * nightly/UI drift probes never include experimental SupportCase lists.
 */
export function getSupportCaseExperimentalDriftProbeTargets(
  envOverride?: EnvRecord,
): DriftProbeTarget[] {
  if (!isSupportCaseSharePointDiagnosticsEnabled(envOverride)) return [];

  return SP_LIST_REGISTRY
    .filter(entry => SUPPORT_CASE_REGISTRY_KEYS.has(entry.key))
    .filter(entry => entry.lifecycle === 'experimental')
    .map(toDriftProbeTarget);
}

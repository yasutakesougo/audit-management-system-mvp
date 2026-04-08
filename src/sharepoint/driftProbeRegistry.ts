/**
 * Drift Probe Registry — SSOT Bridge for Schema Drift Monitoring
 *
 * Dynamically generates DriftProbeTarget[] from SP_LIST_REGISTRY.
 * This file acts as the official registry for Nightly Patrol and UI.
 */
import { SP_LIST_REGISTRY } from './spListRegistry';
import { type DriftProbeTarget } from './contracts/driftProbeTargets';

/**
 * Generates the list of probe targets based on the central SP_LIST_REGISTRY.
 * Filters out deprecated/experimental lists to ensure monitoring stability.
 */
export function getDriftProbeTargets(): DriftProbeTarget[] {
  return SP_LIST_REGISTRY
    .filter(entry => entry.lifecycle === 'required' || entry.lifecycle === 'optional')
    .map(entry => {
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

      return {
        key: entry.key,
        displayName: entry.displayName,
        listTitle,
        selectFields: rawFields,
        essentialFields: entry.essentialFields ? [...entry.essentialFields] : undefined,
      };
    });
}

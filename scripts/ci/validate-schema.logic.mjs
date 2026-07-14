/**
 * Generic schema drift validation logic for SharePoint lists.
 * No I/O — testable without SharePoint or Playwright.
 */

import { resolveSchemaFields } from './resolve-schema-fields.mjs';

/**
 * Validate actual SharePoint field names against expected fields.
 *
 * @param {string[]} actualNames - InternalName values from SharePoint
 * @param {string[]} essentialFields - Fields that MUST exist (case-insensitive check, case-match preferred)
 * @param {string[]} optionalFields - Fields that SHOULD exist (warn if missing)
 * @param {{ aliases?: Record<string, string[]> }} options - Logical field aliases
 * @returns {{
 *   ok: boolean,
 *   missing: string[],
 *   caseMismatch: { expected: string, actual: string }[],
 *   optionalMissing: string[],
 *   resolved: Record<string, string>,
 *   aliasResolutions: { logical: string, actual: string, method: string, candidate: string }[],
 *   ambiguous: { logical: string, actual: string[] }[],
 * }}
 */
export function validateSchema(
  actualNames,
  essentialFields = [],
  optionalFields = [],
  options = {},
) {
  const logicalFields = [...new Set([...essentialFields, ...optionalFields])];
  const resolution = resolveSchemaFields(actualNames, logicalFields, options.aliases || {});
  const missing = essentialFields.filter((name) => !resolution.resolved[name]);
  const caseMismatch = essentialFields
    .filter((name) => {
      const actual = resolution.resolved[name];
      return actual && actual !== name && actual.toLowerCase() === name.toLowerCase();
    })
    .map((name) => ({ expected: name, actual: resolution.resolved[name] }));
  const optionalMissing = optionalFields.filter((name) => !resolution.resolved[name]);
  const aliasResolutions = resolution.resolutions.filter(({ method }) => method !== 'exact');

  return {
    ok: missing.length === 0 && resolution.ambiguous.length === 0,
    missing,
    caseMismatch,
    optionalMissing,
    resolved: resolution.resolved,
    aliasResolutions,
    ambiguous: resolution.ambiguous,
  };
}

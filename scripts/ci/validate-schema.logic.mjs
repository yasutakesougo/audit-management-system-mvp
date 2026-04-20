/**
 * Generic schema drift validation logic for SharePoint lists.
 * No I/O — testable without SharePoint or Playwright.
 */

/**
 * Validate actual SharePoint field names against expected fields.
 *
 * @param {string[]} actualNames - InternalName values from SharePoint
 * @param {string[]} essentialFields - Fields that MUST exist (case-insensitive check, case-match preferred)
 * @param {string[]} optionalFields - Fields that SHOULD exist (warn if missing)
 * @returns {{
 *   ok: boolean,
 *   missing: string[],
 *   caseMismatch: { expected: string, actual: string }[],
 *   optionalMissing: string[]
 * }}
 */
export function validateSchema(actualNames, essentialFields = [], optionalFields = []) {
  const nameSet = new Set(actualNames);
  const lowerMap = new Map(
    actualNames.map((n) => [n.toLowerCase(), n]),
  );

  const missing = [];
  const caseMismatch = [];

  for (const name of essentialFields) {
    if (nameSet.has(name)) continue;

    const lower = name.toLowerCase();
    if (lowerMap.has(lower)) {
      caseMismatch.push({ expected: name, actual: lowerMap.get(lower) });
    } else {
      missing.push(name);
    }
  }

  const optionalMissing = [];
  for (const name of optionalFields) {
    if (!nameSet.has(name) && !lowerMap.has(name.toLowerCase())) {
      optionalMissing.push(name);
    }
  }

  return {
    ok: missing.length === 0,
    missing,
    caseMismatch,
    optionalMissing,
  };
}


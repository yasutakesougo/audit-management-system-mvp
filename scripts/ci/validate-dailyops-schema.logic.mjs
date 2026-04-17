/**
 * Pure validation logic for DailyOpsSignals schema drift detection.
 * No I/O — testable without SharePoint or Playwright.
 *
 * SSOT reference: src/features/dailyOps/data/spSchema.ts
 */

// Essential fields — CI FAILs if any are missing
export const ESSENTIAL_FIELDS = [
  'date',
  'targetType',
  'targetId',
  'kind',
  'summary',
  'status',
];

// Optional fields — warn only
export const OPTIONAL_FIELDS = ['time', 'source'];

/**
 * Validate actual SharePoint field names against the SSOT.
 *
 * @param {string[]} actualNames - InternalName values from SharePoint
 * @returns {{ ok: boolean, missing: string[], caseMismatch: { expected: string, actual: string }[], optionalMissing: string[] }}
 */
export function validateSchema(actualNames) {
  const nameSet = new Set(actualNames);
  const lowerMap = new Map(
    actualNames.map((n) => [n.toLowerCase(), n]),
  );

  const missing = [];
  const caseMismatch = [];

  for (const name of ESSENTIAL_FIELDS) {
    if (nameSet.has(name)) continue;

    const lower = name.toLowerCase();
    if (lowerMap.has(lower)) {
      caseMismatch.push({ expected: name, actual: lowerMap.get(lower) });
    } else {
      missing.push(name);
    }
  }

  const optionalMissing = [];
  for (const name of OPTIONAL_FIELDS) {
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

/**
 * Pure SharePoint InternalName resolver shared by CI schema validation and
 * Playwright integration tests.
 *
 * The logical field name remains the contract.  Aliases are only a mapping
 * for known physical InternalName drift (for example, SharePoint's encoded
 * space form).
 */

const ENCODED_TOKEN = /_x[0-9a-f]{4}_/gi;

function normalizeName(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(ENCODED_TOKEN, '')
    .replace(/[^a-z0-9]/g, '');
}

function unique(values) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.length > 0))];
}

function candidateNames(logicalName, aliases) {
  const explicitAliases = Array.isArray(aliases?.[logicalName])
    ? aliases[logicalName]
    : [];
  const encodedLogicalName = logicalName.replace(/ /g, '_x0020_');
  return unique([logicalName, ...explicitAliases, encodedLogicalName]);
}

function findUnique(actualNames, predicate, used) {
  const matches = actualNames.filter((actual) => !used.has(actual) && predicate(actual));
  if (matches.length > 1) return { ambiguous: matches };
  return { actual: matches[0] };
}

/**
 * Resolve logical field names to the available SharePoint InternalNames.
 *
 * Resolution precedence is deterministic:
 *   1. exact candidate match
 *   2. case-insensitive candidate match
 *   3. normalized match (removes SharePoint _x####_ tokens and punctuation)
 *
 * A physical name can be used only once.  Ambiguous normalized matches are
 * reported instead of selecting an arbitrary field.
 *
 * @param {string[]} actualNames
 * @param {string[]} logicalNames
 * @param {Record<string, string[]>} aliases
 * @returns {{
 *   resolved: Record<string, string>,
 *   missing: string[],
 *   ambiguous: { logical: string, actual: string[] }[],
 *   resolutions: { logical: string, actual: string, method: string, candidate: string }[],
 * }}
 */
export function resolveSchemaFields(actualNames = [], logicalNames = [], aliases = {}) {
  const available = unique(actualNames);
  const resolved = {};
  const missing = [];
  const ambiguous = [];
  const resolutions = [];
  const used = new Set();

  for (const logicalName of unique(logicalNames)) {
    const candidates = candidateNames(logicalName, aliases);
    let actual;
    let method;
    let candidate;

    for (const currentCandidate of candidates) {
      const result = findUnique(
        available,
        (name) => name === currentCandidate,
        used,
      );
      if (result.ambiguous) {
        ambiguous.push({ logical: logicalName, actual: result.ambiguous });
        break;
      }
      if (result.actual) {
        actual = result.actual;
        method = currentCandidate === logicalName ? 'exact' : 'alias';
        candidate = currentCandidate;
        break;
      }
    }

    if (!actual && !ambiguous.some((entry) => entry.logical === logicalName)) {
      for (const currentCandidate of candidates) {
        const result = findUnique(
          available,
          (name) => name.toLowerCase() === currentCandidate.toLowerCase(),
          used,
        );
        if (result.ambiguous) {
          ambiguous.push({ logical: logicalName, actual: result.ambiguous });
          break;
        }
        if (result.actual) {
          actual = result.actual;
          method = currentCandidate === logicalName ? 'case-insensitive' : 'alias';
          candidate = currentCandidate;
          break;
        }
      }
    }

    if (!actual && !ambiguous.some((entry) => entry.logical === logicalName)) {
      const normalizedCandidates = unique(candidates.map(normalizeName));
      const result = findUnique(
        available,
        (name) => normalizedCandidates.includes(normalizeName(name)),
        used,
      );
      if (result.ambiguous) {
        ambiguous.push({ logical: logicalName, actual: result.ambiguous });
      } else if (result.actual) {
        actual = result.actual;
        method = 'normalized';
        candidate = candidates.find((value) => normalizeName(value) === normalizeName(actual)) || logicalName;
      }
    }

    if (actual) {
      used.add(actual);
      resolved[logicalName] = actual;
      resolutions.push({ logical: logicalName, actual, method, candidate });
    } else {
      missing.push(logicalName);
    }
  }

  return { resolved, missing, ambiguous, resolutions };
}

/**
 * Convert logical payload keys to their resolved physical InternalNames.
 * Unknown keys are retained so existing system fields continue to work.
 */
export function mapSchemaPayload(payload, resolved = {}) {
  return Object.fromEntries(
    Object.entries(payload ?? {}).map(([key, value]) => [resolved[key] || key, value]),
  );
}

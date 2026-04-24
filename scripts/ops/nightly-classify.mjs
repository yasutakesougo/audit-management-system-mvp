/* eslint-disable no-console -- CLI ops script */
/**
 * nightly-classify — PatrolResult JSON → Classification
 *
 * Phase C-1: Nightly パトロール結果を分類し、次のアクションを判定する。
 *
 * 分類結果:
 *   - stable:       全ゲート green → no action
 *   - auto-fixable: test/stub only error → PR draft 候補
 *   - needs-review: prod code error → Issue draft (human review)
 *   - monitor:      threshold warning → low-priority issue draft
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║ SAFETY RULE: No Prod Auto-Fix                              ║
 * ║                                                            ║
 * ║ auto-fixable は test/stub ファイルのみに限定。              ║
 * ║ prod code (src/** excluding *.spec.*) を含む failure は     ║
 * ║ 常に needs-review に分類される。                             ║
 * ║                                                            ║
 * ║ この制約を緩めないこと。                                     ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * @see docs/nightly-patrol/
 */

// ─── Safety Guard ───────────────────────────────────────────────────────────

/**
 * Allowlist: directories where stub files are permitted for auto-fix.
 * These are non-production module stubs required only for import compatibility.
 */
const STUB_ALLOWLIST = [
  'src/features/accessibility/',
];

/**
 * Determine if a file is safe for auto-fix (test or stub only).
 *
 * Guard-first: if this returns false, the failure MUST be classified
 * as needs-review, never auto-fixable.
 *
 * @param {string} filePath - repo-relative file path
 * @returns {boolean}
 */
export function isTestOrStubFile(filePath) {
  // Test files: *.spec.ts, *.spec.tsx, *.test.ts, etc.
  if (/\.(spec|test)\.(ts|tsx|js|jsx)$/.test(filePath)) return true;

  // Test directories: __tests__/
  if (filePath.includes('__tests__/')) return true;

  // tests/ top-level directory
  if (filePath.startsWith('tests/')) return true;

  // Stub allowlist
  if (STUB_ALLOWLIST.some((prefix) => filePath.startsWith(prefix))) return true;

  return false;
}

// ─── Classification Logic ───────────────────────────────────────────────────

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

/**
 * Calculate percentiles from an array of numbers.
 * @param {number[]} values
 * @param {number} p - percentile (0-100)
 * @returns {number}
 */
function calculatePercentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  if (upper >= sorted.length) return sorted[lower];
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Classify a single gate failure.
 *
 * Guard-first design: check prod safety BEFORE checking auto-fixable.
 *
 * @param {object|null} gate - gate result from PatrolResult
 * @param {string} kind - 'unit-test' | 'typecheck'
 * @returns {object|null}
 */
function classifyGateFailure(gate, kind) {
  if (!gate || gate.pass) return null;

  const errorFiles = gate.errorFiles || [];

  // ╔═══════════════════════════════════════════════════╗
  // ║ GUARD: prod code → always needs-review           ║
  // ╚═══════════════════════════════════════════════════╝
  const allTestOrStub = errorFiles.length > 0 && errorFiles.every(isTestOrStubFile);

  return {
    kind,
    severity: allTestOrStub ? 'low' : 'high',
    classification: allTestOrStub ? 'auto-fixable' : 'needs-review',
    errorCount: gate.failed || gate.errorCount || 0,
    affectedFiles: errorFiles,
    isTestOnly: allTestOrStub,
  };
}

/**
 * Classify the entire PatrolResult into an overall status and per-kind actions.
 *
 * Pure function: no side effects, no file I/O, no date lookups.
 *
 * @param {object} patrolResult - Structured PatrolResult (version 1)
 * @returns {object} Classification result
 */
export function classify(patrolResult) {
  const {
    date,
    version = 1,
    gates = {},
    metrics = {},
  } = patrolResult;

  const classifications = [];

  // ── Gate failures ──────────────────────────────────────────────────────

  const unitTest = classifyGateFailure(gates.unitTest, 'unit-test');
  const typeCheck = classifyGateFailure(gates.typeCheck, 'typecheck');

  if (unitTest) classifications.push(unitTest);
  if (typeCheck) classifications.push(typeCheck);

  // ── Metric regressions ─────────────────────────────────────────────────

  // any regression: always needs human review (prod code quality)
  const anyCount = metrics.anyCount || 0;
  if (anyCount > 0) {
    classifications.push({
      kind: 'any-regression',
      severity: anyCount >= 30 ? 'critical' : anyCount >= 10 ? 'high' : 'medium',
      classification: 'needs-review',
      errorCount: anyCount,
      affectedFiles: metrics.anyFiles || [],
      isTestOnly: false,
    });
  }

  // Large file monitoring (≥800 = immediate, ≥600 = monitor)
  const largeFiles = metrics.largeFiles || [];
  const criticalLargeFiles = largeFiles.filter((f) => f.lines >= 800);
  if (criticalLargeFiles.length > 0) {
    classifications.push({
      kind: 'large-file-critical',
      severity: 'high',
      classification: 'monitor',
      errorCount: criticalLargeFiles.length,
      affectedFiles: criticalLargeFiles.map((f) => f.file),
      isTestOnly: false,
    });
  } else if (largeFiles.length >= 3) {
    classifications.push({
      kind: 'large-file-warn',
      severity: 'medium',
      classification: 'monitor',
      errorCount: largeFiles.length,
      affectedFiles: largeFiles.map((f) => f.file),
      isTestOnly: false,
    });
  }

  // ── Transport Assignment Concurrency ───────────────────────────────────
  const concurrencyMetrics = metrics.transportConcurrency || {};
  const assignmentConflicts = concurrencyMetrics.totalConflicts ?? metrics.assignmentConcurrencyConflicts ?? 0;
  
  if (assignmentConflicts > 0) {
    const vehicleHistogram = concurrencyMetrics.vehicleHistogram || {};
    const conflictCounts = Object.values(vehicleHistogram);
    
    // Calculate stats if we have histogram data
    const stats = concurrencyMetrics.stats || (conflictCounts.length > 0 ? {
      p50: Math.round(calculatePercentile(conflictCounts, 50)),
      p90: Math.round(calculatePercentile(conflictCounts, 90)),
      max: Math.max(...conflictCounts),
    } : null);

    classifications.push({
      kind: 'assignment-concurrency',
      severity: assignmentConflicts >= 10 || (stats?.p90 >= 5) ? 'high' : assignmentConflicts >= 5 ? 'medium' : 'low',
      classification: 'monitor',
      errorCount: assignmentConflicts,
      affectedFiles: metrics.assignmentConflictVehicles || Object.keys(vehicleHistogram),
      isTestOnly: false,
      concurrency: {
        totalConflicts: assignmentConflicts,
        vehicleHistogram,
        hourBandHistogram: concurrencyMetrics.hourBandHistogram || {},
        recoveryRate: concurrencyMetrics.recoveryRate || 0,
        stats,
      }
    });
  }

  // ── Overall status ─────────────────────────────────────────────────────

  // Priority: needs-review > auto-fixable > monitor > stable
  let overall = 'stable';
  if (classifications.some((c) => c.classification === 'needs-review')) {
    overall = 'needs-review';
  } else if (classifications.some((c) => c.classification === 'auto-fixable')) {
    overall = 'auto-fixable';
  } else if (classifications.some((c) => c.classification === 'monitor')) {
    overall = 'monitor';
  }

  // ── Actions ────────────────────────────────────────────────────────────

  // Sort by severity
  classifications.sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9),
  );

  // Derive action for each classification (used by nightly-apply)
  for (const c of classifications) {
    c.action = c.classification === 'auto-fixable'
      ? 'draft-pr'
      : c.classification === 'needs-review'
        ? 'draft-issue'
        : 'log-only';
  }

  const actions = classifications.map((c) => ({
    kind: c.kind,
    action: c.action,
    priority: c.severity,
    fileCount: c.affectedFiles.length,
  }));

  return {
    version,
    date,
    overall,
    classifications,
    actions,
  };
}

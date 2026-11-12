export type AssignmentSaveOutcome =
  | 'CONFIRMED_APPLIED'
  | 'CONFIRMED_NOT_APPLIED'
  | 'NOT_ATTEMPTED'
  | 'UNKNOWN';

export type AssignmentSaveTargetResult = {
  dateKey: string;
  direction: 'to' | 'from';
  userId: string;
  scheduleRowId: string | null;
  outcome: AssignmentSaveOutcome;
  conflict: boolean;
  writeStarted: boolean;
  reason?: string;
};

export type AssignmentSaveReport = {
  reconciliation: 'complete' | 'incomplete';
  targets: AssignmentSaveTargetResult[];
};

export type AssignmentSavePhase = 'validating' | 'writing' | 'reconciling';

export class AssignmentPartialSaveError extends Error {
  readonly code = 'ASSIGNMENT_PARTIAL_SAVE';
  readonly saveReport: AssignmentSaveReport;

  constructor(message: string, report: AssignmentSaveReport) {
    super(message);
    this.name = 'AssignmentPartialSaveError';
    this.saveReport = report;
  }
}

export function attachAssignmentSaveReport(error: unknown, report: AssignmentSaveReport): void {
  if (!error || typeof error !== 'object') return;
  Object.defineProperty(error, 'saveReport', {
    value: report,
    enumerable: true,
    configurable: true,
    writable: true,
  });
}

export function readAssignmentSaveReport(error: unknown): AssignmentSaveReport | null {
  if (!error || typeof error !== 'object' || !('saveReport' in error)) return null;
  const report = (error as { saveReport?: AssignmentSaveReport }).saveReport;
  if (!report || (report.reconciliation !== 'complete' && report.reconciliation !== 'incomplete')) return null;
  if (!Array.isArray(report.targets)) return null;
  return report;
}

export type AssignmentFieldSnapshot = {
  vehicleId: string;
  driverId: string;
  notes: string;
};

export function classifyReconciledTarget(input: {
  before: AssignmentFieldSnapshot;
  intent: AssignmentFieldSnapshot;
  after: AssignmentFieldSnapshot | null;
  identityMatches: boolean;
}): { outcome: AssignmentSaveOutcome; conflict: boolean; reason?: string } {
  if (!input.identityMatches) {
    return { outcome: 'UNKNOWN', conflict: true, reason: 'target_mismatch' };
  }
  if (!input.after) {
    return { outcome: 'CONFIRMED_NOT_APPLIED', conflict: true, reason: 'item_gone' };
  }
  if (sameAssignmentFields(input.after, input.intent)) {
    return { outcome: 'CONFIRMED_APPLIED', conflict: false };
  }
  if (sameAssignmentFields(input.after, input.before)) {
    return { outcome: 'CONFIRMED_NOT_APPLIED', conflict: false };
  }
  return { outcome: 'CONFIRMED_NOT_APPLIED', conflict: true, reason: 'external_change' };
}

export function sameAssignmentFields(left: AssignmentFieldSnapshot, right: AssignmentFieldSnapshot): boolean {
  return left.vehicleId === right.vehicleId && left.driverId === right.driverId && left.notes === right.notes;
}

export function isIndeterminateSaveError(error: unknown): boolean {
  const status = readStatus(error);
  if (status === 408 || status === 504) return true;
  if (status != null) return false;
  const name = error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message : String(error ?? '');
  return name === 'TimeoutError' || /timeout|timed out|network|failed to fetch|econn|aborted/i.test(message);
}

export function isAssignmentRetryClosed(report: AssignmentSaveReport | null): boolean {
  if (!report) return false;
  if (report.reconciliation !== 'complete') return true;
  return report.targets.some((target) => target.outcome === 'UNKNOWN' || target.conflict);
}

export type AssignmentFieldSeal = {
  vehicleId: string;
  driverId: string;
  mark: string;
};

export type AssignmentSaveRequestTarget = {
  dateKey: string;
  direction: 'to' | 'from';
  userId: string;
  scheduleRowId: string | null;
  before?: AssignmentFieldSeal | null;
  intent?: AssignmentFieldSeal | null;
};

export type UnresolvedAssignmentTarget = AssignmentSaveRequestTarget & {
  outcome: AssignmentSaveOutcome | 'IN_FLIGHT';
  conflict: boolean;
  writeStarted: boolean;
  reason?: string;
  before?: AssignmentFieldSeal | null;
  intent?: AssignmentFieldSeal | null;
};

export type UnresolvedAssignmentSave = {
  schemaVersion?: 1 | 2;
  /** 1 means real-ETag assignment writes with no stale retry. Missing means an older save. */
  saveContractVersion?: 1;
  requestId: string;
  reconciliation: 'pending' | 'complete' | 'incomplete';
  targets: UnresolvedAssignmentTarget[];
};

export type AssignmentLedgerState =
  | { kind: 'empty' }
  | { kind: 'records'; records: UnresolvedAssignmentSave[]; scopeClosed: boolean }
  | { kind: 'corrupt'; reason: 'json' | 'schema' | 'invalid-record' | 'read-failed' }
  | { kind: 'write-failed' };

export const UNRESOLVED_ASSIGNMENT_SAVE_STORAGE_KEY = 'iceberg.transportAssignment.unresolvedSave.v1';
export const UNRESOLVED_ASSIGNMENT_SAVE_SCHEMA_VERSION = 2 as const;
export const ASSIGNMENT_SAVE_CONTRACT_VERSION = 1 as const;
export const ASSIGNMENT_WRITE_LOCK_NAME = 'iceberg.transportAssignment.write';

export function isUsableAssignmentEtag(etag: string | null | undefined, itemId: string): etag is string {
  if (typeof etag !== 'string') return false;
  const trimmed = etag.trim();
  if (!trimmed || trimmed === '*') return false;
  const unquoted = assignmentEtagToken(trimmed);
  if (!unquoted || unquoted === '*' || unquoted === itemId || unquoted === `sp-${itemId}`) return false;
  if (unquoted.startsWith('sp-')) return false;
  return true;
}

export function assignmentEtagToken(etag: string): string {
  return etag.trim().replace(/^W\//i, '').replace(/^"(.*)"$/, '$1').trim();
}

export type AssignmentRecoveryMerge = {
  scheduleRowId: string;
  beforeEtag: string;
  afterEtag: string;
};

export function didAssignmentEtagAdvance(before: string, after: string, itemId: string): boolean {
  if (!isUsableAssignmentEtag(before, itemId) || !isUsableAssignmentEtag(after, itemId)) return false;
  return assignmentEtagToken(before) !== assignmentEtagToken(after);
}

/**
 * A prior request is proven only when every one of its rows accepted a MERGE
 * and the real ETag moved. A skipped row keeps the whole request.
 */
export function provenRecoveryRequestIds(
  records: readonly UnresolvedAssignmentSave[],
  requestedIds: readonly string[],
  merges: readonly AssignmentRecoveryMerge[],
): string[] {
  const advanced = new Set<string>();
  for (const merge of merges) {
    if (didAssignmentEtagAdvance(merge.beforeEtag, merge.afterEtag, merge.scheduleRowId)) {
      advanced.add(merge.scheduleRowId);
    }
  }
  return requestedIds.filter((requestId) => {
    const record = records.find((entry) => entry.requestId === requestId);
    if (!record || record.saveContractVersion !== ASSIGNMENT_SAVE_CONTRACT_VERSION) return false;
    return record.targets.length > 0 && record.targets.every((target) =>
      typeof target.scheduleRowId === 'string'
      && target.scheduleRowId !== ''
      && advanced.has(target.scheduleRowId)
    );
  });
}

const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function rotateRight(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits));
}

export function sha256Hex(message: string): string {
  const bytes = Array.from(new TextEncoder().encode(message));
  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const high = Math.floor(bitLength / 0x100000000);
  const low = bitLength >>> 0;
  for (let shift = 24; shift >= 0; shift -= 8) bytes.push((high >>> shift) & 0xff);
  for (let shift = 24; shift >= 0; shift -= 8) bytes.push((low >>> shift) & 0xff);
  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;
  for (let offset = 0; offset < bytes.length; offset += 64) {
    const words = new Array<number>(64);
    for (let index = 0; index < 16; index += 1) {
      const cursor = offset + index * 4;
      words[index] = ((bytes[cursor] << 24) | (bytes[cursor + 1] << 16) | (bytes[cursor + 2] << 8) | bytes[cursor + 3]) >>> 0;
    }
    for (let index = 16; index < 64; index += 1) {
      const s0 = rotateRight(words[index - 15], 7) ^ rotateRight(words[index - 15], 18) ^ (words[index - 15] >>> 3);
      const s1 = rotateRight(words[index - 2], 17) ^ rotateRight(words[index - 2], 19) ^ (words[index - 2] >>> 10);
      words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
    }
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;
    for (let index = 0; index < 64; index += 1) {
      const s1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + choice + SHA256_K[index] + words[index]) >>> 0;
      const s0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }
  return [h0, h1, h2, h3, h4, h5, h6, h7].map((value) => value.toString(16).padStart(8, '0')).join('');
}

export function sealAssignmentFields(snapshot: AssignmentFieldSnapshot): AssignmentFieldSeal {
  return {
    vehicleId: snapshot.vehicleId,
    driverId: snapshot.driverId,
    mark: sha256Hex(snapshot.notes),
  };
}

export function assignmentSealMatches(snapshot: AssignmentFieldSnapshot, seal: AssignmentFieldSeal): boolean {
  return snapshot.vehicleId === seal.vehicleId
    && snapshot.driverId === seal.driverId
    && sha256Hex(snapshot.notes) === seal.mark;
}

const ASSIGNMENT_TIME_ZONE = 'Asia/Tokyo';

export function assignmentJstDateKey(start: string): string | null {
  const parsed = new Date(start);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat('sv-SE', { timeZone: ASSIGNMENT_TIME_ZONE }).format(parsed);
}

export function assignmentSaveTargetsFrom(assignments: Array<{
  type?: string;
  start: string;
  direction?: 'to' | 'from';
  userIds?: string[];
}>): AssignmentSaveRequestTarget[] {
  const targets: AssignmentSaveRequestTarget[] = [];
  for (const assignment of assignments) {
    if (assignment.type != null && assignment.type !== 'transport') continue;
    if (assignment.direction !== 'to' && assignment.direction !== 'from') continue;
    const dateKey = assignmentJstDateKey(assignment.start) ?? '';
    for (const userId of assignment.userIds ?? []) {
      if (typeof userId !== 'string' || userId.trim() === '') continue;
      targets.push({
        dateKey,
        direction: assignment.direction,
        userId: userId.trim(),
        scheduleRowId: null,
      });
    }
  }
  return targets;
}

export function readAssignmentLedger(storage: Pick<Storage, 'getItem'> | null = globalThis.localStorage ?? null): AssignmentLedgerState {
  if (!storage) return { kind: 'empty' };
  let raw: string | null;
  try {
    raw = storage.getItem(UNRESOLVED_ASSIGNMENT_SAVE_STORAGE_KEY);
  } catch {
    return { kind: 'corrupt', reason: 'read-failed' };
  }
  if (raw == null) return { kind: 'empty' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: 'corrupt', reason: 'json' };
  }
  return parseAssignmentLedger(parsed);
}

export function loadUnresolvedAssignmentSaves(): UnresolvedAssignmentSave[] {
  const ledger = readAssignmentLedger();
  if (ledger.kind === 'corrupt') {
    throw new Error(`[assignmentSaveReport] Unresolved ledger is ${ledger.reason}`);
  }
  return ledger.kind === 'records' ? ledger.records : [];
}

export function persistUnresolvedAssignmentSaves(
  records: readonly UnresolvedAssignmentSave[],
  storage: Pick<Storage, 'getItem' | 'setItem'> | null = globalThis.localStorage ?? null,
): void {
  const current = readAssignmentLedger(storage);
  if (current.kind === 'corrupt') {
    throw new Error(`[assignmentSaveReport] Refusing to replace a ${current.reason} ledger`);
  }
  if (!storage) {
    throw new Error('[assignmentSaveReport] Unresolved ledger storage is unavailable');
  }
  storage.setItem(UNRESOLVED_ASSIGNMENT_SAVE_STORAGE_KEY, JSON.stringify(records.map(storedAssignmentSave)));
}

/**
 * Replace or remove one request in the latest persisted ledger.
 * A corrupt ledger is returned unchanged and is not written.
 */
export function replaceUnresolvedAssignmentSave(
  requestId: string,
  next: UnresolvedAssignmentSave | null,
  storage: Pick<Storage, 'getItem' | 'setItem'> | null = globalThis.localStorage ?? null,
): AssignmentLedgerState {
  const current = readAssignmentLedger(storage);
  if (current.kind === 'corrupt') return current;
  const records = current.kind === 'records'
    ? current.records.filter((record) => record.requestId !== requestId)
    : [];
  if (next) records.push(next);
  persistUnresolvedAssignmentSaves(records, storage);
  return readAssignmentLedger(storage);
}

export function removeUnresolvedAssignmentSaves(
  requestIds: readonly string[],
  storage: Pick<Storage, 'getItem' | 'setItem'> | null = globalThis.localStorage ?? null,
): AssignmentLedgerState {
  const current = readAssignmentLedger(storage);
  if (current.kind === 'corrupt') return current;
  const drop = new Set(requestIds);
  const records = current.kind === 'records'
    ? current.records.filter((record) => !drop.has(record.requestId))
    : [];
  persistUnresolvedAssignmentSaves(records, storage);
  return readAssignmentLedger(storage);
}

export function assignmentRecoveryEligibility(
  ledger: AssignmentLedgerState,
  request: readonly AssignmentSaveRequestTarget[],
): 'available' | 'legacy' | 'corrupt' | 'closed' | 'none' {
  if (ledger.kind === 'corrupt' || ledger.kind === 'write-failed') return ledger.kind === 'corrupt' ? 'corrupt' : 'closed';
  if (ledger.kind !== 'records') return 'none';
  if (ledger.scopeClosed) return 'closed';
  const overlapping = ledger.records.filter((record) => isAssignmentSaveBlocked([record], request));
  if (overlapping.length === 0) return 'none';
  if (overlapping.some((record) => record.saveContractVersion !== ASSIGNMENT_SAVE_CONTRACT_VERSION)) return 'legacy';
  if (overlapping.some((record) => record.targets.some((target) =>
    !target.scheduleRowId || !target.dateKey || !target.userId || (target.direction !== 'to' && target.direction !== 'from')
  ))) return 'closed';
  return 'available';
}

export function isAssignmentLedgerClosed(ledger: AssignmentLedgerState): boolean {
  return ledger.kind === 'corrupt' || ledger.kind === 'write-failed' || (ledger.kind === 'records' && ledger.scopeClosed);
}

export function isAssignmentSaveBlocked(
  records: readonly UnresolvedAssignmentSave[],
  request: readonly AssignmentSaveRequestTarget[],
): boolean {
  if (records.length === 0 || request.length === 0) return false;
  if (records.some((record) => record.targets.some((target) => !target.scheduleRowId))) return true;
  if (request.some((target) => !target.dateKey || !target.userId || (target.direction !== 'to' && target.direction !== 'from'))) {
    return true;
  }
  return request.some((next) => records.some((record) => record.targets.some((held) => assignmentTargetsOverlap(held, next))));
}

export function judgeRecoveredAssignmentTarget(input: {
  before: AssignmentFieldSeal | null;
  intent: AssignmentFieldSeal | null;
  after: AssignmentFieldSnapshot | null;
  identityMatches: boolean;
  readable: boolean;
}): { outcome: AssignmentSaveOutcome; conflict: boolean; reason?: string } {
  if (!input.readable) return { outcome: 'UNKNOWN', conflict: false, reason: 'reconcile_failed' };
  if (!input.before || !input.intent) return { outcome: 'UNKNOWN', conflict: false, reason: 'missing_snapshot' };
  if (!input.identityMatches) return { outcome: 'UNKNOWN', conflict: true, reason: 'target_mismatch' };
  if (!input.after) return { outcome: 'CONFIRMED_NOT_APPLIED', conflict: true, reason: 'item_gone' };
  const writePlanned = input.before.vehicleId !== input.intent.vehicleId
    || input.before.driverId !== input.intent.driverId
    || input.before.mark !== input.intent.mark;
  if (
    writePlanned
    && (assignmentSealMatches(input.after, input.intent) || assignmentSealMatches(input.after, input.before))
  ) {
    return { outcome: 'UNKNOWN', conflict: true, reason: 'write_still_possible' };
  }
  if (assignmentSealMatches(input.after, input.intent)) return { outcome: 'CONFIRMED_APPLIED', conflict: false };
  if (assignmentSealMatches(input.after, input.before)) return { outcome: 'CONFIRMED_NOT_APPLIED', conflict: false };
  return { outcome: 'CONFIRMED_NOT_APPLIED', conflict: true, reason: 'external_change' };
}

export function settleUnresolvedRecovery(record: UnresolvedAssignmentSave): UnresolvedAssignmentSave | null {
  const incomplete = record.targets.some((target) => target.outcome === 'UNKNOWN' || target.outcome === 'IN_FLIGHT');
  const reconciliation = incomplete ? 'incomplete' : 'complete';
  const settled: UnresolvedAssignmentSave = { ...record, reconciliation, targets: record.targets };
  const releaseReport: AssignmentSaveReport = { reconciliation, targets: [] };
  if (canReleaseUnresolvedSave(releaseReport, settled.targets)) {
    return null;
  }
  return settled;
}

export function nextUnresolvedAssignmentSave(
  requestId: string,
  request: readonly AssignmentSaveRequestTarget[],
  report: AssignmentSaveReport | null,
): UnresolvedAssignmentSave | null {
  const targets = mergeUnresolvedTargets(request, report);
  if (targets.length === 0) return null;
  if (canReleaseUnresolvedSave(report, targets)) return null;
  return {
    schemaVersion: targets.every((target) => target.before && target.intent && target.scheduleRowId)
      ? UNRESOLVED_ASSIGNMENT_SAVE_SCHEMA_VERSION
      : 1,
    saveContractVersion: ASSIGNMENT_SAVE_CONTRACT_VERSION,
    requestId,
    reconciliation: report?.reconciliation ?? 'pending',
    targets,
  };
}

export function describeBlockedAssignmentSave(
  records: readonly UnresolvedAssignmentSave[],
  request: readonly AssignmentSaveRequestTarget[],
): AssignmentSaveFeedback | null {
  const held = records.flatMap((record) => record.targets).filter((target) =>
    request.some((next) => assignmentTargetsOverlap(target, next)),
  );
  if (held.length === 0) return null;
  if (held.some((target) => target.outcome === 'IN_FLIGHT' || target.reason === 'write_still_possible')) {
    return {
      severity: 'error',
      testId: 'transport-assignment-save-blocked',
      message: '以前の保存処理がまだ反映される可能性があります。安全を確認できないため、同じ対象の保存を停止しています。',
    };
  }
  const unresolvedCount = held.filter((target) => target.outcome === 'UNKNOWN' || target.outcome === 'IN_FLIGHT').length;
  const countKnown = records.every((record) => record.reconciliation === 'complete')
    && held.every((target) => target.outcome !== 'IN_FLIGHT');
  const unknownText = !countKnown
    ? '結果不明の件数は確定できません。'
    : unresolvedCount > 0
      ? `結果不明 ${unresolvedCount}件。`
      : held.some((target) => target.conflict)
        ? '他の更新との競合が残っています。'
        : '結果不明の件数は確定できません。';
  return {
    severity: 'error',
    testId: 'transport-assignment-save-blocked',
    message: `一部の配車設定が保存された可能性があります。最新の記録を確認するまで、同じ内容を再保存しないでください。${unknownText}`,
  };
}

function assignmentTargetsOverlap(
  held: AssignmentSaveRequestTarget,
  next: AssignmentSaveRequestTarget,
): boolean {
  if (held.scheduleRowId && next.scheduleRowId && held.scheduleRowId === next.scheduleRowId) return true;
  if (!held.dateKey || !next.dateKey || held.dateKey !== next.dateKey) return false;
  if (held.direction !== next.direction) return false;
  if (!held.userId || !next.userId) return true;
  return held.userId === next.userId;
}

function canReleaseUnresolvedSave(
  report: AssignmentSaveReport | null,
  targets: readonly UnresolvedAssignmentTarget[],
): boolean {
  // NOT_ATTEMPTED plus writeStarted false is the pre-MERGE plan rejection.
  // The ledger's initial writeStarted false uses IN_FLIGHT and is not that evidence.
  // A sent MERGE stays locked even when a later GET matches the before image or the intent.
  if (!report || report.reconciliation !== 'complete' || targets.length === 0) return false;
  return targets.every((target) =>
    target.outcome === 'NOT_ATTEMPTED'
    && target.writeStarted === false
    && !target.conflict
    && Boolean(target.dateKey)
    && Boolean(target.userId)
    && (target.direction === 'to' || target.direction === 'from')
  );
}

function mergeUnresolvedTargets(
  request: readonly AssignmentSaveRequestTarget[],
  report: AssignmentSaveReport | null,
): UnresolvedAssignmentTarget[] {
  const merged = new Map<string, UnresolvedAssignmentTarget>();
  for (const target of request) {
    merged.set(requestTargetKey(target), {
      ...target,
      before: target.before ?? null,
      intent: target.intent ?? null,
      outcome: 'IN_FLIGHT',
      conflict: false,
      writeStarted: false,
    });
  }
  for (const target of report?.targets ?? []) {
    const key = requestTargetKey(target);
    const requestTarget = merged.get(key);
    merged.set(key, {
      dateKey: target.dateKey,
      direction: target.direction,
      userId: target.userId,
      scheduleRowId: target.scheduleRowId ?? requestTarget?.scheduleRowId ?? null,
      outcome: target.outcome,
      conflict: target.conflict,
      writeStarted: target.writeStarted,
      before: requestTarget?.before ?? null,
      intent: requestTarget?.intent ?? null,
    });
  }
  return [...merged.values()];
}

function requestTargetKey(target: AssignmentSaveRequestTarget): string {
  return `${target.dateKey}\u0000${target.direction}\u0000${target.userId}`;
}

function storedAssignmentSave(record: UnresolvedAssignmentSave): UnresolvedAssignmentSave {
  const recoverable = record.targets.every((target) => target.before && target.intent && target.scheduleRowId);
  return {
    schemaVersion: record.schemaVersion ?? (recoverable ? UNRESOLVED_ASSIGNMENT_SAVE_SCHEMA_VERSION : 1),
    requestId: record.requestId,
    ...(record.saveContractVersion === ASSIGNMENT_SAVE_CONTRACT_VERSION
      ? { saveContractVersion: ASSIGNMENT_SAVE_CONTRACT_VERSION }
      : {}),
    reconciliation: record.reconciliation,
    targets: record.targets.map((target) => ({
      dateKey: target.dateKey,
      direction: target.direction,
      userId: target.userId,
      scheduleRowId: target.scheduleRowId,
      outcome: target.outcome,
      conflict: target.conflict,
      writeStarted: target.writeStarted,
      ...(typeof target.reason === 'string' && target.reason.trim() !== '' ? { reason: target.reason } : {}),
      before: target.before ?? null,
      intent: target.intent ?? null,
    })),
  };
}

function parseAssignmentLedger(value: unknown): AssignmentLedgerState {
  if (!Array.isArray(value)) return { kind: 'corrupt', reason: 'schema' };
  if (value.length === 0) return { kind: 'empty' };
  const records: UnresolvedAssignmentSave[] = [];
  for (const entry of value) {
    const record = parseUnresolvedRecord(entry);
    if (!record) return { kind: 'corrupt', reason: 'invalid-record' };
    records.push(record);
  }
  return {
    kind: 'records',
    records,
    scopeClosed: records.some((record) => record.targets.some((target) => !target.scheduleRowId)),
  };
}

function parseUnresolvedRecord(value: unknown): UnresolvedAssignmentSave | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const schemaVersion = record.schemaVersion === undefined ? 1 : record.schemaVersion;
  if (schemaVersion !== 1 && schemaVersion !== 2) return null;
  if (record.saveContractVersion !== undefined && record.saveContractVersion !== ASSIGNMENT_SAVE_CONTRACT_VERSION) return null;
  if (typeof record.requestId !== 'string' || record.requestId.trim() === '') return null;
  if (record.reconciliation !== 'pending' && record.reconciliation !== 'complete' && record.reconciliation !== 'incomplete') return null;
  if (!Array.isArray(record.targets) || record.targets.length === 0) return null;
  const targets: UnresolvedAssignmentTarget[] = [];
  for (const entry of record.targets) {
    const target = parseUnresolvedTarget(entry);
    if (!target) return null;
    targets.push(target);
  }
  return {
    schemaVersion,
    ...(record.saveContractVersion === ASSIGNMENT_SAVE_CONTRACT_VERSION
      ? { saveContractVersion: ASSIGNMENT_SAVE_CONTRACT_VERSION }
      : {}),
    requestId: record.requestId,
    reconciliation: record.reconciliation,
    targets,
  };
}

function parseUnresolvedTarget(value: unknown): UnresolvedAssignmentTarget | null {
  if (!value || typeof value !== 'object') return null;
  const target = value as Record<string, unknown>;
  if (target.direction !== 'to' && target.direction !== 'from') return null;
  if (typeof target.userId !== 'string' || target.userId.trim() === '') return null;
  if (target.outcome !== 'CONFIRMED_APPLIED'
    && target.outcome !== 'CONFIRMED_NOT_APPLIED'
    && target.outcome !== 'NOT_ATTEMPTED'
    && target.outcome !== 'UNKNOWN'
    && target.outcome !== 'IN_FLIGHT') return null;
  if (typeof target.conflict !== 'boolean' || typeof target.writeStarted !== 'boolean') return null;
  if (target.reason != null && typeof target.reason !== 'string') return null;
  if (target.dateKey != null && typeof target.dateKey !== 'string') return null;
  if (target.scheduleRowId != null && typeof target.scheduleRowId !== 'string') return null;
  const before = parseAssignmentSeal(target.before);
  const intent = parseAssignmentSeal(target.intent);
  if (before === undefined || intent === undefined) return null;
  return {
    dateKey: typeof target.dateKey === 'string' ? target.dateKey : '',
    direction: target.direction,
    userId: target.userId.trim(),
    scheduleRowId: typeof target.scheduleRowId === 'string' && target.scheduleRowId.trim() !== '' ? target.scheduleRowId : null,
    outcome: target.outcome,
    conflict: target.conflict,
    writeStarted: target.writeStarted,
    ...(typeof target.reason === 'string' && target.reason.trim() !== '' ? { reason: target.reason } : {}),
    before,
    intent,
  };
}

function parseAssignmentSeal(value: unknown): AssignmentFieldSeal | null | undefined {
  if (value == null) return null;
  if (!value || typeof value !== 'object') return undefined;
  const seal = value as Partial<AssignmentFieldSeal>;
  if (typeof seal.vehicleId !== 'string' || typeof seal.driverId !== 'string' || typeof seal.mark !== 'string' || seal.mark.trim() === '') {
    return undefined;
  }
  return { vehicleId: seal.vehicleId, driverId: seal.driverId, mark: seal.mark };
}

export function describeAssignmentLedger(ledger: AssignmentLedgerState): AssignmentSaveFeedback | null {
  if (ledger.kind === 'corrupt') {
    return {
      severity: 'error',
      testId: 'transport-assignment-ledger-corrupt',
      message: '配車の未解決台帳が破損しているため、配車の保存は停止しています。台帳は削除していません。',
    };
  }
  if (ledger.kind === 'write-failed') {
    return {
      severity: 'error',
      testId: 'transport-assignment-ledger-write-failed',
      message: '配車の未解決台帳を記録できないため、保存は開始していません。',
    };
  }
  if (ledger.kind === 'records' && ledger.scopeClosed) {
    return {
      severity: 'error',
      testId: 'transport-assignment-save-blocked',
      message: '未解決の配車保存の対象行を特定できないため、配車の保存は停止しています。結果不明の件数は確定できません。',
    };
  }
  return null;
}

export function shouldReplaceTransportDraft(input: { scopeChanged: boolean; dirty: boolean }): boolean {
  if (input.scopeChanged) return true;
  return !input.dirty;
}

export function isTransportAssignmentEditorBusy(status: string): boolean {
  return status === 'saving' || status === 'reconciling' || status === 'recovering';
}

export type AssignmentSaveFeedback = {
  severity: 'success' | 'info' | 'warning' | 'error';
  testId: string;
  message: string;
};

export function describeAssignmentSaveFeedback(
  status: string,
  error: unknown,
): AssignmentSaveFeedback | null {
  if (status === 'success') {
    return {
      severity: 'success',
      testId: 'transport-assignment-save-success',
      message: '配車設定を保存しました。',
    };
  }
  if (status === 'recovering') {
    return {
      severity: 'info',
      testId: 'transport-assignment-recovery-running',
      message: '保存をやり直しています。完了するまで、同じ対象の保存は停止しています。',
    };
  }
  if (status === 'conflict') {
    return {
      severity: 'error',
      testId: 'transport-assignment-save-conflict',
      message: '他の更新と重なったため、保存を止めています。自動では再送していません。内容を確認してから、保存をやり直してください。',
    };
  }
  if (status === 'recovery_unavailable') {
    return {
      severity: 'error',
      testId: 'transport-assignment-recovery-unavailable',
      message: 'この未解決の保存は、今の画面から安全にやり直せません。台帳は削除していません。',
    };
  }
  if (status === 'reconciling') {
    return {
      severity: 'info',
      testId: 'transport-assignment-save-reconciling',
      message: '保存結果を照合しています。',
    };
  }
  const report = readAssignmentSaveReport(error);
  if (status === 'reconcile_failed') {
    return {
      severity: 'error',
      testId: 'transport-assignment-save-reconcile-failed',
      message: '一部の配車設定が保存された可能性があります。最新の記録を確認するまで、同じ内容を再保存しないでください。結果不明の件数は確定できません。',
    };
  }
  if (status === 'partial' && report) {
    const applied = report.targets.filter((target) => target.outcome === 'CONFIRMED_APPLIED').length;
    const notApplied = report.targets.filter((target) => target.outcome === 'CONFIRMED_NOT_APPLIED' || target.outcome === 'NOT_ATTEMPTED').length;
    const unknown = report.targets.filter((target) => target.outcome === 'UNKNOWN').length;
    const unknownText = report.reconciliation !== 'complete'
      ? '結果不明の件数は確定できません。'
      : unknown > 0
        ? `結果不明 ${unknown}件。`
        : '';
    return {
      severity: 'warning',
      testId: 'transport-assignment-save-partial',
      message: `一部の配車設定が保存された可能性があります。最新の記録を確認するまで、同じ内容を再保存しないでください。確認できた保存 ${applied}件、未反映 ${notApplied}件。${unknownText}`,
    };
  }
  if (status === 'error') {
    const wrote = report?.targets.some((target) => target.writeStarted) ?? false;
    return {
      severity: 'error',
      testId: 'transport-assignment-save-error',
      message: wrote
        ? '一部の配車設定が保存された可能性があります。最新の記録を確認するまで、同じ内容を再保存しないでください。'
        : '配車設定の保存に失敗しました。書き込みは開始していません。',
    };
  }
  return null;
}

function readStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object' || !('status' in error)) return undefined;
  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' ? status : undefined;
}

import type { Assignment, AssignmentListFilter, AssignmentRepository, TransportAssignment } from '../domain/assignment';
import type { ScheduleItem, ScheduleRepository, UpdateScheduleInput } from '../domain/ScheduleRepository';
import { isTransportScheduleRow, inferTransportDirections } from '@/features/today/transport/transportAssignments';
import {
  normalizeText,
  extractTransportAttendantStaffId,
  extractTransportCourseId,
  buildTransportNotes
} from '@/features/transport-assignments/domain/transportAssignmentDraft';
import { emitTelemetry } from '@/lib/telemetry';
import { getHttpStatus } from './scheduleSpUtils';
import {
  AssignmentPartialSaveError,
  attachAssignmentSaveReport,
  classifyReconciledTarget,
  didAssignmentEtagAdvance,
  isUsableAssignmentEtag,
  judgeRecoveredAssignmentTarget,
  sameAssignmentFields,
  settleUnresolvedRecovery,
  readAssignmentSaveReport,
  type AssignmentFieldSnapshot,
  type AssignmentRecoveryMerge,
  type UnresolvedAssignmentSave,
  type AssignmentSavePhase,
  type AssignmentSaveReport,
  type AssignmentSaveTargetResult,
} from './assignmentSaveReport';

type UserAssignmentTarget = {
  vehicleId: string;
  driverId: string;
  attendantId: string;
  courseId: ReturnType<typeof extractTransportCourseId>;
};

const ASSIGNMENT_TIME_ZONE = 'Asia/Tokyo';

/**
 * Calendar date of an assignment instant in Asia/Tokyo.
 * Throws when `start` is not a parseable timestamp. The assignment id is not a date source.
 */
function requireJstDateKey(start: string): string {
  const parsed = new Date(start);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`[SharePointAssignmentRepository] Cannot resolve JST date from assignment start: ${start}`);
  }
  return new Intl.DateTimeFormat('sv-SE', { timeZone: ASSIGNMENT_TIME_ZONE }).format(parsed);
}

function jstDateKeyOrNull(start: string): string | null {
  const parsed = new Date(start);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat('sv-SE', { timeZone: ASSIGNMENT_TIME_ZONE }).format(parsed);
}

/**
 * SharePoint-backed implementation of AssignmentRepository.
 * 
 * This implementation acts as a domain-aligned view over the physical 'Schedules' list.
 * It uses the existing ScheduleRepository to perform the actual SharePoint operations
 * and maps the results to the Assignment domain model.
 */
type PlannedAssignmentTarget = {
  dateKey: string;
  direction: 'to' | 'from';
  userId: string;
  scheduleRowId: string;
  patch: UpdateScheduleInput | null;
  mapping: UserAssignmentTarget;
  before: AssignmentFieldSnapshot;
  intent: AssignmentFieldSnapshot;
  writeStarted: boolean;
  httpAccepted: boolean;
  accepted: AssignmentFieldSnapshot | null;
};

export class SharePointAssignmentRepository implements AssignmentRepository {
  private readonly scheduleRepo: ScheduleRepository;
  private recoveryMerges: AssignmentRecoveryMerge[] = [];
  onSavePhase?: (phase: AssignmentSavePhase) => void;

  /** Rows whose recovery MERGE was accepted and whose real ETag advanced. */
  consumeRecoveryMerges(): AssignmentRecoveryMerge[] {
    const found = this.recoveryMerges;
    this.recoveryMerges = [];
    return found;
  }

  constructor(scheduleRepo: ScheduleRepository) {
    this.scheduleRepo = scheduleRepo;
  }

  /**
   * List assignments based on filter criteria.
   * For 'transport' type, it performs grouping of individual schedule items.
   */
  async list(filter: AssignmentListFilter): Promise<Assignment[]> {
    if (!filter.range) {
      throw new Error('[SharePointAssignmentRepository] Range filter is required for SharePoint listing.');
    }

    // 1. Fetch schedules for the range
    const items = await this.scheduleRepo.list({ 
      range: {
        from: filter.range.from,
        to: filter.range.to
      }
    });

    // 2. If transport type is requested, apply grouping logic
    if (filter.type === 'transport' || !filter.type) {
      return this.mapToTransportAssignments(items, filter);
    }

    // For other types (support, staff, etc.), return empty or implement mapping as needed
    return [];
  }

  async getById(_id: string): Promise<Assignment | null> {
    // Basic implementation: we don't have a direct 1:1 mapping for grouped assignments yet
    return null;
  }

  async create(_assignment: Omit<Assignment, 'id'>): Promise<Assignment> {
    throw new Error('[SharePointAssignmentRepository] Mutation (create) not yet implemented for real repository.');
  }

  async update(assignment: Assignment): Promise<Assignment> {
    await this.saveBulk([assignment]);
    return assignment;
  }

  async delete(_id: string): Promise<void> {
    throw new Error('[SharePointAssignmentRepository] Mutation (delete) not yet implemented for real repository.');
  }

  async saveBulk(
    assignments: Assignment[],
    options?: { signal?: AbortSignal; recoveryTouchRowIds?: readonly string[] },
  ): Promise<void> {
    const signal = options?.signal;
    const touchRows = new Set(options?.recoveryTouchRowIds ?? []);
    const recordRecoveryEvidence = options?.recoveryTouchRowIds != null;
    this.recoveryMerges = [];
    const transportAssignments = assignments.filter(a => a.type === 'transport') as TransportAssignment[];
    if (transportAssignments.length === 0) return;

    this.onSavePhase?.('validating');
    const groups = this.groupTransportAssignments(transportAssignments);
    const planned: PlannedAssignmentTarget[] = [];
    try {
      for (const group of groups) {
        throwIfSaveAborted(signal);
        planned.push(...await this.planTransportGroup(group.dateKey, group.direction, group.items, signal));
      }
    } catch (error) {
      const existing = readAssignmentSaveReport(error);
      if (existing) {
        attachAssignmentSaveReport(error, {
          reconciliation: existing.reconciliation,
          targets: [
            ...planned.map((target) => ({
              dateKey: target.dateKey,
              direction: target.direction,
              userId: target.userId,
              scheduleRowId: target.scheduleRowId,
              outcome: 'NOT_ATTEMPTED' as const,
              conflict: false,
              writeStarted: false,
            })),
            ...existing.targets,
          ],
        });
      }
      throw error;
    }

    const writes = planned.filter((target) => target.patch != null || touchRows.has(target.scheduleRowId));
    let failure: unknown = null;
    if (writes.length > 0) {
      this.onSavePhase?.('writing');
    }
    for (const target of writes) {
      throwIfSaveAborted(signal);
      target.writeStarted = true;
      try {
        target.accepted = await this.updateWithRetry(
          target.scheduleRowId,
          target.mapping,
          {
            userId: target.userId,
            dateKey: target.dateKey,
            direction: target.direction,
          },
          signal,
          {
            sameValue: touchRows.has(target.scheduleRowId),
            recordEvidence: recordRecoveryEvidence,
          },
        );
        target.httpAccepted = true;
      } catch (error) {
        failure = error;
        break;
      }
    }
    if (signal?.aborted || isSaveAbortError(failure)) {
      throw abortedSaveError(signal, failure);
    }

    this.onSavePhase?.('reconciling');
    const report = await this.reconcilePlannedTargets(planned);
    const unresolved = report.targets.some((target) => target.outcome !== 'CONFIRMED_APPLIED');
    if (!unresolved && !failure) return;

    if (failure) {
      attachAssignmentSaveReport(failure, report);
      throw failure;
    }
    const error = new AssignmentPartialSaveError(
      '[SharePointAssignmentRepository] Persisted assignments do not match the save intent',
      report,
    );
    throw error;
  }

  private groupTransportAssignments(assignments: TransportAssignment[]): Array<{
    dateKey: string;
    direction: 'to' | 'from';
    items: TransportAssignment[];
  }> {
    const groups = new Map<string, { dateKey: string; direction: 'to' | 'from'; items: TransportAssignment[] }>();
    for (const assignment of assignments) {
      const dateKey = requireJstDateKey(assignment.start);
      const groupKey = `${dateKey}\u0000${assignment.direction}`;
      const existing = groups.get(groupKey);
      if (existing) existing.items.push(assignment);
      else groups.set(groupKey, { dateKey, direction: assignment.direction, items: [assignment] });
    }
    return [...groups.values()];
  }

  /**
   * Read one JST date + direction and build the write plan.
   * Missing rows, duplicate rows, and conflicting intents fail before any write.
   * A matched row whose vehicle, driver, and notes already agree is not written.
   */
  private async planTransportGroup(
    dateKey: string,
    direction: 'to' | 'from',
    group: TransportAssignment[],
    signal?: AbortSignal,
  ): Promise<PlannedAssignmentTarget[]> {
    const userMapping = new Map<string, UserAssignmentTarget>();
    for (const assignment of group) {
      for (const rawUserId of assignment.userIds) {
        if (typeof rawUserId !== 'string' || rawUserId.trim() === '') continue;
        const next = {
          vehicleId: assignment.vehicleId || '',
          driverId: assignment.driverId || '',
          attendantId: assignment.assistantStaffIds[0] || '',
          courseId: extractTransportCourseId(assignment.notes),
        };
        const previous = userMapping.get(rawUserId);
        if (previous && !sameUserTarget(previous, next)) {
          this.rejectPlan(
            `[SharePointAssignmentRepository] Conflicting assignment targets for ${dateKey} ${direction}: ${rawUserId}`,
            notAttemptedTargets(dateKey, direction, [...userMapping.keys(), rawUserId]),
          );
        }
        userMapping.set(rawUserId, next);
      }
    }
    if (userMapping.size === 0) return [];

    let allItems: ScheduleItem[];
    try {
      allItems = await this.scheduleRepo.list(
        signal ? { range: this.rangeFor(dateKey), signal } : { range: this.rangeFor(dateKey) },
      );
    } catch (error) {
      const report: AssignmentSaveReport = {
        reconciliation: 'incomplete',
        targets: [...userMapping.keys()].map((userId) => ({
          dateKey,
          direction,
          userId,
          scheduleRowId: null,
          outcome: 'UNKNOWN',
          conflict: false,
          writeStarted: false,
          reason: 'list_failed',
        })),
      };
      attachAssignmentSaveReport(error, report);
      throw error;
    }

    const planned: PlannedAssignmentTarget[] = [];
    const seen = new Map<string, string>();
    for (const item of allItems) {
      const rawRow = item as unknown as Record<string, unknown>;
      if (!isTransportScheduleRow(rawRow)) continue;
      if (jstDateKeyOrNull(item.start) !== dateKey) continue;
      if (!inferTransportDirections(rawRow).includes(direction)) continue;
      const userId = normalizeText(item.userId);
      if (!userId || !userMapping.has(userId)) continue;
      if (seen.has(userId)) {
        this.rejectPlan(
          `[SharePointAssignmentRepository] Multiple schedule rows for ${dateKey} ${direction}: ${userId}`,
          notAttemptedTargets(dateKey, direction, [...userMapping.keys()]),
        );
      }
      seen.set(userId, item.id);
      const mapping = userMapping.get(userId)!;
      const projected = this.projectAssignment(item, mapping);
      planned.push({
        dateKey,
        direction,
        userId,
        scheduleRowId: item.id,
        patch: projected.patch,
        mapping,
        before: projected.before,
        intent: projected.intent,
        writeStarted: false,
        httpAccepted: false,
        accepted: null,
      });
    }

    const missing = [...userMapping.keys()].filter((userId) => !seen.has(userId));
    if (missing.length > 0) {
      this.rejectPlan(
        `[SharePointAssignmentRepository] No schedule row for ${dateKey} ${direction}: ${missing.join(',')}`,
        notAttemptedTargets(dateKey, direction, [...userMapping.keys()]),
      );
    }
    return planned;
  }

  private rejectPlan(message: string, targets: AssignmentSaveTargetResult[]): never {
    const error = new Error(message);
    attachAssignmentSaveReport(error, { reconciliation: 'complete', targets });
    throw error;
  }

  private async reconcilePlannedTargets(planned: PlannedAssignmentTarget[]): Promise<AssignmentSaveReport> {
    const byDate = new Map<string, ScheduleItem[] | null>();
    let incomplete = false;
    for (const dateKey of new Set(planned.map((target) => target.dateKey))) {
      try {
        const listed = await this.scheduleRepo.list({ range: this.rangeFor(dateKey) });
        if (!Array.isArray(listed)) {
          byDate.set(dateKey, null);
          incomplete = true;
        } else {
          byDate.set(dateKey, listed);
        }
      } catch {
        byDate.set(dateKey, null);
        incomplete = true;
      }
    }

    const targets = planned.map((target): AssignmentSaveTargetResult => {
      const rows = byDate.get(target.dateKey);
      if (!rows) {
        return {
          dateKey: target.dateKey,
          direction: target.direction,
          userId: target.userId,
          scheduleRowId: target.scheduleRowId,
          outcome: 'UNKNOWN',
          conflict: false,
          writeStarted: target.writeStarted,
          reason: 'reconcile_failed',
        };
      }
      const current = rows.find((item) => item.id === target.scheduleRowId) ?? null;
      const identityMatches = !current || this.matchesRefetchedTransportRow(current, target.scheduleRowId, target);
      const after = current && identityMatches ? this.snapshotFields(current) : null;
      if (after && target.accepted && sameAssignmentFields(after, target.accepted)) {
        return {
          dateKey: target.dateKey,
          direction: target.direction,
          userId: target.userId,
          scheduleRowId: target.scheduleRowId,
          outcome: 'CONFIRMED_APPLIED',
          conflict: false,
          writeStarted: target.writeStarted,
        };
      }
      const classified = classifyReconciledTarget({
        before: target.before,
        intent: target.intent,
        after,
        identityMatches,
      });
      return {
        dateKey: target.dateKey,
        direction: target.direction,
        userId: target.userId,
        scheduleRowId: target.scheduleRowId,
        outcome: classified.outcome,
        conflict: classified.conflict,
        writeStarted: target.writeStarted,
        reason: classified.reason,
      };
    });

    return { reconciliation: incomplete ? 'incomplete' : 'complete', targets };
  }

  private rangeFor(dateKey: string): { from: string; to: string } {
    return {
      from: `${dateKey}T00:00:00+09:00`,
      to: `${dateKey}T23:59:59+09:00`,
    };
  }

  private snapshotFields(item: ScheduleItem): AssignmentFieldSnapshot {
    return {
      vehicleId: normalizeText(item.vehicleId) ?? '',
      driverId: normalizeText(item.assignedStaffId) ?? '',
      notes: item.notes || '',
    };
  }

  private snapshotFromPatch(patch: UpdateScheduleInput): AssignmentFieldSnapshot {
    return {
      vehicleId: normalizeText(patch.vehicleId) ?? '',
      driverId: normalizeText(patch.assignedStaffId) ?? '',
      notes: patch.notes || '',
    };
  }

  private projectAssignment(item: ScheduleItem, mapping: UserAssignmentTarget): {
    patch: UpdateScheduleInput | null;
    before: AssignmentFieldSnapshot;
    intent: AssignmentFieldSnapshot;
  } {
    const before = this.snapshotFields(item);
    const patch = this.buildPatch(item, mapping);
    return {
      patch,
      before,
      intent: patch
        ? {
            vehicleId: normalizeText(patch.vehicleId) ?? '',
            driverId: normalizeText(patch.assignedStaffId) ?? '',
            notes: patch.notes || '',
          }
        : before,
    };
  }

  private buildPatch(item: ScheduleItem, mapping: UserAssignmentTarget, force = false): UpdateScheduleInput | null {
    const currentCourse = extractTransportCourseId(item.notes);
    const nextCourse = mapping.courseId ?? currentCourse;
    const nextNotes = buildTransportNotes(item.notes, mapping.attendantId, nextCourse) || '';
    const nextVehicleId = normalizeText(mapping.vehicleId) ?? '';
    const nextDriverId = normalizeText(mapping.driverId) ?? '';

    const isChanged =
      (normalizeText(item.vehicleId) ?? '') !== nextVehicleId ||
      (normalizeText(item.assignedStaffId) ?? '') !== nextDriverId ||
      (item.notes || '') !== nextNotes;

    if (!isChanged && !force) return null;

    return {
      id: item.id,
      etag: item.etag,
      vehicleId: nextVehicleId,
      assignedStaffId: nextDriverId,
      notes: nextNotes,
    };
  }

  private matchesRefetchedTransportRow(
    item: ScheduleItem,
    expectedId: string,
    identity: { userId: string; dateKey: string; direction: 'to' | 'from' },
  ): boolean {
    if (item.id !== expectedId) return false;
    const rawRow = item as unknown as Record<string, unknown>;
    if (!isTransportScheduleRow(rawRow)) return false;
    if (normalizeText(item.userId) !== identity.userId) return false;
    if (jstDateKeyOrNull(item.start) !== identity.dateKey) return false;
    return inferTransportDirections(rawRow).includes(identity.direction);
  }

  /**
   * Read the row ETag immediately before one assignment MERGE.
   * A 412, a missing ETag, or a row that no longer matches stops without another write.
   * Recovery may repeat the current vehicle, staff, and notes so the real ETag advances.
   */
  private async updateWithRetry(
    rowId: string,
    mapping: UserAssignmentTarget,
    identity: { userId: string; dateKey: string; direction: 'to' | 'from' },
    signal: AbortSignal | undefined,
    recovery: { sameValue: boolean; recordEvidence: boolean },
  ): Promise<AssignmentFieldSnapshot> {
    throwIfSaveAborted(signal);
    const current = await this.readAuthoritativeRow(rowId, signal);
    if (!current || !isUsableAssignmentEtag(current.etag, rowId)) {
      emitTelemetry('assignment:conflict_unresolved', {
        itemId: rowId,
        reason: 'etag_unavailable',
        retryCount: 0,
      });
      throw new Error(`[SharePointAssignmentRepository] Real ETag is unavailable for schedule ${rowId}`);
    }
    if (!this.matchesRefetchedTransportRow(current.item, rowId, identity)) {
      emitTelemetry('assignment:conflict_unresolved', {
        itemId: rowId,
        reason: 'target_mismatch',
        retryCount: 0,
      });
      throw new Error(
        `[SharePointAssignmentRepository] Refetched schedule ${rowId} no longer matches ${identity.dateKey} ${identity.direction} ${identity.userId}`,
      );
    }
    const authoritativePatch = this.buildPatch(
      { ...current.item, etag: current.etag },
      mapping,
      recovery.sameValue,
    );
    if (!authoritativePatch) {
      return this.snapshotFields(current.item);
    }
    const beforeEtag = current.etag;
    const write: UpdateScheduleInput = { ...authoritativePatch, id: rowId, etag: beforeEtag };
    try {
      throwIfSaveAborted(signal);
      await this.scheduleRepo.update(write, {
        signal,
        assignmentWrite: { conflictRetry: 'none' },
      });
      if (recovery.recordEvidence) {
        await this.recordAdvancedEtag(rowId, beforeEtag, signal);
      }
      return this.snapshotFromPatch(write);
    } catch (err) {
      if (signal?.aborted || isSaveAbortError(err)) throw abortedSaveError(signal, err);
      const status = getHttpStatus(err);
      emitTelemetry('assignment:conflict_unresolved', {
        itemId: rowId,
        reason: status === 412 ? 'conflict' : 'non_conflict_error',
        status,
        retryCount: 0,
      });
      throw err;
    }
  }

  private async recordAdvancedEtag(rowId: string, beforeEtag: string, signal?: AbortSignal): Promise<void> {
    try {
      const after = await this.readAuthoritativeRow(rowId, signal);
      if (!after || !didAssignmentEtagAdvance(beforeEtag, after.etag, rowId)) return;
      this.recoveryMerges.push({
        scheduleRowId: rowId,
        beforeEtag,
        afterEtag: after.etag,
      });
    } catch {
      // A lost read is not evidence that the previous ETag is dead.
    }
  }

  private async readAuthoritativeRow(
    id: string,
    signal?: AbortSignal,
  ): Promise<{ etag: string; item: ScheduleItem } | null> {
    const reader = this.scheduleRepo as ScheduleRepository & {
      readTransportRowEtag?: (rowId: string, requestSignal?: AbortSignal) => Promise<{ etag: string; item: ScheduleItem } | null>;
    };
    if (typeof reader.readTransportRowEtag !== 'function') return null;
    return reader.readTransportRowEtag(id, signal);
  }

  /**
   * Internal helper to map schedule items to grouped TransportAssignment models.
   */
  private mapToTransportAssignments(items: ScheduleItem[], filter: AssignmentListFilter): TransportAssignment[] {
    type VehicleAccumulator = {
      userIds: string[];
      assistantStaffIds: string[];
      start: string;
      end: string;
      etag?: string;
      driverId?: string;
    };
    const dateGroups = new Map<string, Map<string, Map<string, VehicleAccumulator>>>(); // Date -> Direction -> VehicleId -> Data

    for (const item of items) {
      const rawRow = item as unknown as Record<string, unknown>;
      if (!isTransportScheduleRow(rawRow)) continue;

      const itemDirections = inferTransportDirections(rawRow);
      const vehicleId = normalizeText(item.vehicleId) || 'unassigned';
      const userId = normalizeText(item.userId);
      if (!userId) continue;

      const itemDate = item.start.split('T')[0];

      for (const dir of itemDirections) {
        // Map 'to'/'from' to 'pickup'/'dropoff'
        const domainDir = dir === 'to' ? 'to' : 'from';
        
        // Filter by direction if requested
        // Note: Generic filter doesn't have direction yet, but we might need it for transport
        // For now we return all directions found in the range.

        if (!dateGroups.has(itemDate)) dateGroups.set(itemDate, new Map());
        const dirGroups = dateGroups.get(itemDate)!;
        
        if (!dirGroups.has(domainDir)) dirGroups.set(domainDir, new Map());
        const vehicleMap = dirGroups.get(domainDir)!;

        const existing = vehicleMap.get(vehicleId) || {
          userIds: [],
          assistantStaffIds: [],
          start: item.start,
          end: item.end,
          etag: item.etag
        };

        if (!existing.userIds.includes(userId)) {
          existing.userIds.push(userId);
        }
        
        if (!existing.driverId && item.assignedStaffId) {
          existing.driverId = item.assignedStaffId;
        }
        
        const attendantId = extractTransportAttendantStaffId(item.notes);
        if (attendantId && !existing.assistantStaffIds.includes(attendantId)) {
          existing.assistantStaffIds.push(attendantId);
        }

        vehicleMap.set(vehicleId, existing);
      }
    }

    const results: TransportAssignment[] = [];
    for (const [date, dirMap] of dateGroups.entries()) {
      for (const [direction, vehicleMap] of dirMap.entries()) {
        for (const [vehicleId, data] of vehicleMap.entries()) {
          const id = `transport-${date}-${direction}-${vehicleId}`;
          results.push({
            id,
            type: 'transport',
            start: data.start,
            end: data.end,
            title: `送迎: ${vehicleId}`,
            status: 'planned',
            vehicleId: vehicleId === 'unassigned' ? undefined : vehicleId,
            driverId: data.driverId,
            assistantStaffIds: data.assistantStaffIds,
            userIds: data.userIds,
            direction: direction as 'to' | 'from',
            etag: data.etag
          });
        }
      }
    }

    // Apply resourceId filter if requested
    const resourceId = filter.resourceId;
    if (resourceId) {
      return results.filter(r => 
        r.vehicleId === resourceId || 
        r.driverId === resourceId || 
        r.assistantStaffIds.includes(resourceId)
      );
    }

    return results;
  }

  /**
   * Read the rows a save would touch. This does not create, update, or delete.
   */
  async previewTransportSave(assignments: Assignment[]): Promise<Array<{
    dateKey: string;
    direction: 'to' | 'from';
    userId: string;
    scheduleRowId: string;
    before: AssignmentFieldSnapshot;
    intent: AssignmentFieldSnapshot;
  }>> {
    const transportAssignments = assignments.filter((assignment) => assignment.type === 'transport') as TransportAssignment[];
    const planned: PlannedAssignmentTarget[] = [];
    for (const group of this.groupTransportAssignments(transportAssignments)) {
      planned.push(...await this.planTransportGroup(group.dateKey, group.direction, group.items));
    }
    return planned.map((target) => ({
      dateKey: target.dateKey,
      direction: target.direction,
      userId: target.userId,
      scheduleRowId: target.scheduleRowId,
      before: target.before,
      intent: target.intent,
    }));
  }

  /**
   * Compare a persisted save with the current rows. Listing is the only repository call.
   */
  async rereadUnresolvedSave(record: UnresolvedAssignmentSave): Promise<UnresolvedAssignmentSave | null> {
    const byDate = new Map<string, ScheduleItem[] | null>();
    for (const dateKey of new Set(record.targets.map((target) => target.dateKey).filter((dateKey) => dateKey))) {
      try {
        const listed = await this.scheduleRepo.list({ range: this.rangeFor(dateKey) });
        byDate.set(dateKey, Array.isArray(listed) ? listed : null);
      } catch {
        byDate.set(dateKey, null);
      }
    }
    const targets = record.targets.map((target) => {
      const rows = target.dateKey ? byDate.get(target.dateKey) : null;
      const readable = Boolean(target.dateKey) && rows != null;
      const current = rows?.find((item) => item.id === target.scheduleRowId) ?? null;
      const identityMatches = !current || !target.scheduleRowId
        ? !current && Boolean(target.scheduleRowId)
        : this.matchesRefetchedTransportRow(current, target.scheduleRowId, {
            userId: target.userId,
            dateKey: target.dateKey,
            direction: target.direction,
          });
      const judged = judgeRecoveredAssignmentTarget({
        before: target.before ?? null,
        intent: target.intent ?? null,
        after: current && identityMatches ? this.snapshotFields(current) : null,
        identityMatches,
        readable,
      });
      return { ...target, outcome: judged.outcome, conflict: judged.conflict, reason: judged.reason };
    });
    return settleUnresolvedRecovery({ ...record, targets });
  }
}

function sameUserTarget(left: UserAssignmentTarget, right: UserAssignmentTarget): boolean {
  return left.vehicleId === right.vehicleId
    && left.driverId === right.driverId
    && left.attendantId === right.attendantId
    && left.courseId === right.courseId;
}

function notAttemptedTargets(
  dateKey: string,
  direction: 'to' | 'from',
  userIds: string[],
): AssignmentSaveTargetResult[] {
  return [...new Set(userIds)].map((userId) => ({
    dateKey,
    direction,
    userId,
    scheduleRowId: null,
    outcome: 'NOT_ATTEMPTED',
    conflict: false,
    writeStarted: false,
  }));
}

function isSaveAbortError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'name' in error
    && (error as { name?: unknown }).name === 'AbortError';
}

function abortedSaveError(signal?: AbortSignal, error?: unknown): Error {
  if (isSaveAbortError(error) && error instanceof Error) return error;
  if (signal?.reason instanceof Error) return signal.reason;
  return new DOMException('The operation was aborted.', 'AbortError');
}

function throwIfSaveAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortedSaveError(signal);
}

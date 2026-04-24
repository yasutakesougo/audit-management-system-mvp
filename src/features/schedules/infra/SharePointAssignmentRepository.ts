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

type UserAssignmentTarget = { vehicleId: string; driverId: string; attendantId: string };

/**
 * SharePoint-backed implementation of AssignmentRepository.
 * 
 * This implementation acts as a domain-aligned view over the physical 'Schedules' list.
 * It uses the existing ScheduleRepository to perform the actual SharePoint operations
 * and maps the results to the Assignment domain model.
 */
export class SharePointAssignmentRepository implements AssignmentRepository {
  private readonly scheduleRepo: ScheduleRepository;

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

  async saveBulk(assignments: Assignment[]): Promise<void> {
    const transportAssignments = assignments.filter(a => a.type === 'transport') as TransportAssignment[];
    if (transportAssignments.length === 0) return;

    // Use the first assignment to determine the date context
    // Assumes bulk save is for a single date/direction context for now
    const first = transportAssignments[0];
    const date = first.id.split('-')[1];
    const range = {
      from: `${date}T00:00:00+09:00`,
      to: `${date}T23:59:59+09:00`,
    };

    const allItems = await this.scheduleRepo.list({ range });

    const userMapping = new Map<string, UserAssignmentTarget>();
    for (const a of transportAssignments) {
      for (const uId of a.userIds) {
        userMapping.set(uId, {
          vehicleId: a.vehicleId || '',
          driverId: a.driverId || '',
          attendantId: a.assistantStaffIds[0] || ''
        });
      }
    }

    for (const item of allItems) {
      const rawRow = item as unknown as Record<string, unknown>;
      if (!isTransportScheduleRow(rawRow)) continue;

      const uId = normalizeText(item.userId);
      if (!uId) continue;

      const mapping = userMapping.get(uId);
      if (!mapping) continue;

      const patch = this.buildPatch(item as ScheduleItem, mapping);
      if (!patch) continue;

      await this.updateWithRetry(patch, mapping, range);
    }
  }

  private buildPatch(item: ScheduleItem, mapping: UserAssignmentTarget): UpdateScheduleInput | null {
    const currentCourse = extractTransportCourseId(item.notes);
    const nextNotes = buildTransportNotes(item.notes, mapping.attendantId, currentCourse) || '';

    const isChanged =
      item.vehicleId !== mapping.vehicleId ||
      item.assignedStaffId !== mapping.driverId ||
      (item.notes || '') !== nextNotes;

    if (!isChanged) return null;

    return {
      ...(item as unknown as UpdateScheduleInput),
      vehicleId: mapping.vehicleId,
      assignedStaffId: mapping.driverId,
      notes: nextNotes,
      startLocal: item.start,
      endLocal: item.end,
    };
  }

  /**
   * Update a schedule item with one-shot retry-with-merge on 412 conflicts.
   * On ETag conflict: refetch the latest row, overlay the caller's intended
   * assignment fields onto the server's latest snapshot, and retry once.
   * Telemetry:
   *  - assignment:conflict_resolved  — retry succeeded after a 412
   *  - assignment:conflict_unresolved — retry exhausted, row vanished, or non-conflict error
   */
  private async updateWithRetry(
    patch: UpdateScheduleInput,
    mapping: UserAssignmentTarget,
    range: { from: string; to: string },
  ): Promise<void> {
    try {
      await this.scheduleRepo.update(patch);
    } catch (err) {
      const status = getHttpStatus(err);
      if (status !== 412) {
        emitTelemetry('assignment:conflict_unresolved', {
          itemId: patch.id,
          reason: 'non_conflict_error',
          status,
          retryCount: 0,
        });
        throw err;
      }

      // 412: refetch, merge, retry once.
      const fresh = await this.scheduleRepo.list({ range });
      const latest = fresh.find(i => i.id === patch.id);
      if (!latest) {
        emitTelemetry('assignment:conflict_unresolved', {
          itemId: patch.id,
          reason: 'item_gone',
          retryCount: 1,
        });
        throw err;
      }

      const mergedPatch = this.buildPatch(latest, mapping);
      if (!mergedPatch) {
        // Server already reflects our intended state — treat as resolved.
        emitTelemetry('assignment:conflict_resolved', {
          itemId: patch.id,
          reason: 'already_consistent',
          retryCount: 1,
        });
        return;
      }

      try {
        await this.scheduleRepo.update(mergedPatch);
        emitTelemetry('assignment:conflict_resolved', {
          itemId: patch.id,
          retryCount: 1,
        });
      } catch (retryErr) {
        emitTelemetry('assignment:conflict_unresolved', {
          itemId: patch.id,
          reason: getHttpStatus(retryErr) === 412 ? 'retry_exhausted' : 'retry_failed',
          status: getHttpStatus(retryErr),
          retryCount: 1,
        });
        throw retryErr;
      }
    }
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
}

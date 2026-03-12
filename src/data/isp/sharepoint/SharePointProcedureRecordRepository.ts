/**
 * SharePoint ProcedureRecord Repository — 第3層 SupportProcedureRecord_Daily
 *
 * @see src/domain/isp/port.ts
 * @see src/data/isp/sharepoint/mapper.ts
 */

import { isWriteEnabled } from '@/env';
import type { UseSP } from '@/lib/spClient';
import type { ProcedureRecordRepository, ProcedureRecordCreateInput, ProcedureRecordUpdateInput } from '@/domain/isp/port';
import type { SupportProcedureRecord, ProcedureRecordListItem } from '@/domain/isp/schema';
import {
  PROCEDURE_RECORD_LIST_TITLE,
  PROCEDURE_RECORD_SELECT_FIELDS,
  type SpProcedureRecordRow,
} from '@/sharepoint/fields/ispThreeLayerFields';
import {
  mapProcedureRecordRowToDomain,
  mapProcedureRecordRowToListItem,
  mapProcedureRecordCreateInputToPayload,
  mapProcedureRecordUpdateInputToPayload,
} from './mapper';
import { extractSpId } from './SharePointIspRepository';

// ────────────────────────────────────────────────────────────────
// Write Gate
// ────────────────────────────────────────────────────────────────

function assertWriteEnabled(op: string): void {
  if (!isWriteEnabled) {
    throw new Error(`Write operation "${op}" is disabled. Set VITE_WRITE_ENABLED=1 to enable.`);
  }
}

// ────────────────────────────────────────────────────────────────
// OData helpers
// ────────────────────────────────────────────────────────────────

const escapeOData = (s: string) => s.replace(/'/g, "''");

const SELECT = [...PROCEDURE_RECORD_SELECT_FIELDS] as string[];

// ────────────────────────────────────────────────────────────────
// Repository 実装
// ────────────────────────────────────────────────────────────────

export function createSharePointProcedureRecordRepository(client: UseSP): ProcedureRecordRepository {
  return {
    async getById(id: string): Promise<SupportProcedureRecord | null> {
      const numericId = extractSpId(id);
      if (numericId === null) return null;

      const rows = await client.listItems<SpProcedureRecordRow>(PROCEDURE_RECORD_LIST_TITLE, {
        select: SELECT,
        filter: `Id eq ${numericId}`,
        top: 1,
      });

      return rows[0] ? mapProcedureRecordRowToDomain(rows[0]) : null;
    },

    async listByPlanningSheet(planningSheetId: string): Promise<ProcedureRecordListItem[]> {
      const rows = await client.listItems<SpProcedureRecordRow>(PROCEDURE_RECORD_LIST_TITLE, {
        select: SELECT,
        filter: `PlanningSheetId eq '${escapeOData(planningSheetId)}'`,
        orderby: 'RecordDate desc, TimeSlot asc',
      });

      return rows.map(mapProcedureRecordRowToListItem);
    },

    async listByUserAndDate(userId: string, recordDate: string): Promise<ProcedureRecordListItem[]> {
      const rows = await client.listItems<SpProcedureRecordRow>(PROCEDURE_RECORD_LIST_TITLE, {
        select: SELECT,
        filter: `UserCode eq '${escapeOData(userId)}' and RecordDate eq '${escapeOData(recordDate)}'`,
        orderby: 'TimeSlot asc',
      });

      return rows.map(mapProcedureRecordRowToListItem);
    },

    async create(input: ProcedureRecordCreateInput): Promise<SupportProcedureRecord> {
      assertWriteEnabled('procedureRecord.create');

      const payload = mapProcedureRecordCreateInputToPayload(input);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const created: any = await client.addListItemByTitle(PROCEDURE_RECORD_LIST_TITLE, payload);
      const createdId = Number(created?.Id ?? created?.d?.Id ?? created?.data?.Id);

      if (!createdId || !Number.isFinite(createdId)) {
        throw new Error('[ProcedureRecordRepository] Failed to extract ID from create response');
      }

      const rows = await client.listItems<SpProcedureRecordRow>(PROCEDURE_RECORD_LIST_TITLE, {
        select: SELECT,
        filter: `Id eq ${createdId}`,
        top: 1,
      });

      if (!rows[0]) {
        throw new Error(`[ProcedureRecordRepository] Failed to fetch created item with ID: ${createdId}`);
      }

      return mapProcedureRecordRowToDomain(rows[0]);
    },

    async update(id: string, input: ProcedureRecordUpdateInput): Promise<SupportProcedureRecord> {
      assertWriteEnabled('procedureRecord.update');

      const numericId = extractSpId(id);
      if (numericId === null) {
        throw new Error(`[ProcedureRecordRepository] Invalid ID format: ${id}`);
      }

      const payload = mapProcedureRecordUpdateInputToPayload(input);
      await client.updateItem(PROCEDURE_RECORD_LIST_TITLE, numericId, payload);

      const rows = await client.listItems<SpProcedureRecordRow>(PROCEDURE_RECORD_LIST_TITLE, {
        select: SELECT,
        filter: `Id eq ${numericId}`,
        top: 1,
      });

      if (!rows[0]) {
        throw new Error(`[ProcedureRecordRepository] Failed to fetch updated item with ID: ${numericId}`);
      }

      return mapProcedureRecordRowToDomain(rows[0]);
    },
  };
}

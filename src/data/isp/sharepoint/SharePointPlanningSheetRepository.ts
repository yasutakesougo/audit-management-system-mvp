/**
 * SharePoint PlanningSheet Repository — 第2層 SupportPlanningSheet_Master
 *
 * @see src/domain/isp/port.ts
 * @see src/data/isp/sharepoint/mapper.ts
 */

import { isWriteEnabled } from '@/env';
import type { UseSP } from '@/lib/spClient';
import type { PlanningSheetRepository, PlanningSheetCreateInput, PlanningSheetUpdateInput } from '@/domain/isp/port';
import type { SupportPlanningSheet, PlanningSheetListItem } from '@/domain/isp/schema';
import {
  PLANNING_SHEET_LIST_TITLE,
  PLANNING_SHEET_SELECT_FIELDS,
  type SpPlanningSheetRow,
} from '@/sharepoint/fields/ispThreeLayerFields';
import {
  mapPlanningSheetRowToDomain,
  mapPlanningSheetRowToListItem,
  mapPlanningSheetCreateInputToPayload,
  mapPlanningSheetUpdateInputToPayload,
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

const SELECT = [...PLANNING_SHEET_SELECT_FIELDS] as string[];

// ────────────────────────────────────────────────────────────────
// SharePoint 作成系レスポンス型
// ────────────────────────────────────────────────────────────────

type SpCreatedItem = {
  Id?: number;
  d?: { Id?: number };
  data?: { Id?: number };
} & Record<string, unknown>;

// ────────────────────────────────────────────────────────────────
// Repository 実装
// ────────────────────────────────────────────────────────────────

export function createSharePointPlanningSheetRepository(client: UseSP): PlanningSheetRepository {
  return {
    async getById(id: string): Promise<SupportPlanningSheet | null> {
      const numericId = extractSpId(id);
      if (numericId === null) return null;

      const rows = await client.listItems<SpPlanningSheetRow>(PLANNING_SHEET_LIST_TITLE, {
        select: SELECT,
        filter: `Id eq ${numericId}`,
        top: 1,
      });

      return rows[0] ? mapPlanningSheetRowToDomain(rows[0]) : null;
    },

    async listByIsp(ispId: string): Promise<PlanningSheetListItem[]> {
      const rows = await client.listItems<SpPlanningSheetRow>(PLANNING_SHEET_LIST_TITLE, {
        select: SELECT,
        filter: `ISPId eq '${escapeOData(ispId)}'`,
        orderby: 'Created desc',
      });

      return rows.map(mapPlanningSheetRowToListItem);
    },

    async listCurrentByUser(userId: string): Promise<PlanningSheetListItem[]> {
      const rows = await client.listItems<SpPlanningSheetRow>(PLANNING_SHEET_LIST_TITLE, {
        select: SELECT,
        filter: `UserCode eq '${escapeOData(userId)}' and IsCurrent eq true`,
        orderby: 'Created desc',
      });

      return rows.map(mapPlanningSheetRowToListItem);
    },

    async create(input: PlanningSheetCreateInput): Promise<SupportPlanningSheet> {
      assertWriteEnabled('planningSheet.create');

      const payload = mapPlanningSheetCreateInputToPayload(input);
      const created = await client.addListItemByTitle(PLANNING_SHEET_LIST_TITLE, payload) as SpCreatedItem;
      const createdId = Number(created?.Id ?? created?.d?.Id ?? created?.data?.Id);

      if (!createdId || !Number.isFinite(createdId)) {
        throw new Error('[PlanningSheetRepository] Failed to extract ID from create response');
      }

      const rows = await client.listItems<SpPlanningSheetRow>(PLANNING_SHEET_LIST_TITLE, {
        select: SELECT,
        filter: `Id eq ${createdId}`,
        top: 1,
      });

      if (!rows[0]) {
        throw new Error(`[PlanningSheetRepository] Failed to fetch created item with ID: ${createdId}`);
      }

      return mapPlanningSheetRowToDomain(rows[0]);
    },

    async update(id: string, input: PlanningSheetUpdateInput): Promise<SupportPlanningSheet> {
      assertWriteEnabled('planningSheet.update');

      const numericId = extractSpId(id);
      if (numericId === null) {
        throw new Error(`[PlanningSheetRepository] Invalid ID format: ${id}`);
      }

      const payload = mapPlanningSheetUpdateInputToPayload(input);
      await client.updateItem(PLANNING_SHEET_LIST_TITLE, numericId, payload);

      const rows = await client.listItems<SpPlanningSheetRow>(PLANNING_SHEET_LIST_TITLE, {
        select: SELECT,
        filter: `Id eq ${numericId}`,
        top: 1,
      });

      if (!rows[0]) {
        throw new Error(`[PlanningSheetRepository] Failed to fetch updated item with ID: ${numericId}`);
      }

      return mapPlanningSheetRowToDomain(rows[0]);
    },
  };
}

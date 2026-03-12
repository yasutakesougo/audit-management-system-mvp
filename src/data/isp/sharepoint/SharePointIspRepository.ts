/**
 * SharePoint ISP Repository — 第1層 ISP_Master
 *
 * schedulesRepo.ts のパターンに準拠:
 *   - Query: OData フィルタ → listItems → mapper
 *   - Create: input → payload → addListItemByTitle → 再取得 → mapper
 *   - Update: input → payload → updateItem → mapper
 *   - WriteDisabledError で mutation を遮断
 *
 * @see src/domain/isp/port.ts
 * @see src/data/isp/sharepoint/mapper.ts
 */

import { isWriteEnabled } from '@/env';
import type { UseSP } from '@/lib/spClient';
import type { IspRepository, IspCreateInput, IspUpdateInput } from '@/domain/isp/port';
import type { IndividualSupportPlan, IspListItem } from '@/domain/isp/schema';
import {
  ISP_MASTER_LIST_TITLE,
  ISP_MASTER_SELECT_FIELDS,
  type SpIspMasterRow,
} from '@/sharepoint/fields/ispThreeLayerFields';
import {
  mapIspRowToDomain,
  mapIspRowToListItem,
  mapIspCreateInputToPayload,
  mapIspUpdateInputToPayload,
} from './mapper';

// ────────────────────────────────────────────────────────────────
// Write Gate
// ────────────────────────────────────────────────────────────────

class WriteDisabledError extends Error {
  readonly code = 'WRITE_DISABLED' as const;
  constructor(op: string) {
    super(`Write operation "${op}" is disabled. Set VITE_WRITE_ENABLED=1 to enable.`);
    this.name = 'WriteDisabledError';
  }
}

function assertWriteEnabled(op: string): void {
  if (!isWriteEnabled) throw new WriteDisabledError(op);
}

// ────────────────────────────────────────────────────────────────
// OData helpers
// ────────────────────────────────────────────────────────────────

const escapeOData = (s: string) => s.replace(/'/g, "''");

const SELECT = [...ISP_MASTER_SELECT_FIELDS] as string[];

// ────────────────────────────────────────────────────────────────
// Repository 実装
// ────────────────────────────────────────────────────────────────

export function createSharePointIspRepository(client: UseSP): IspRepository {
  return {
    async getById(id: string): Promise<IndividualSupportPlan | null> {
      const numericId = extractSpId(id);
      if (numericId === null) return null;

      const rows = await client.listItems<SpIspMasterRow>(ISP_MASTER_LIST_TITLE, {
        select: SELECT,
        filter: `Id eq ${numericId}`,
        top: 1,
      });

      return rows[0] ? mapIspRowToDomain(rows[0]) : null;
    },

    async listByUser(userId: string): Promise<IspListItem[]> {
      const rows = await client.listItems<SpIspMasterRow>(ISP_MASTER_LIST_TITLE, {
        select: SELECT,
        filter: `UserCode eq '${escapeOData(userId)}'`,
        orderby: 'PlanStartDate desc',
      });

      return rows.map(mapIspRowToListItem);
    },

    async getCurrentByUser(userId: string): Promise<IndividualSupportPlan | null> {
      const rows = await client.listItems<SpIspMasterRow>(ISP_MASTER_LIST_TITLE, {
        select: SELECT,
        filter: `UserCode eq '${escapeOData(userId)}' and IsCurrent eq 1`,
        top: 1,
        orderby: 'PlanStartDate desc',
      });

      return rows[0] ? mapIspRowToDomain(rows[0]) : null;
    },

    async create(input: IspCreateInput): Promise<IndividualSupportPlan> {
      assertWriteEnabled('isp.create');

      const payload = mapIspCreateInputToPayload(input);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const created: any = await client.addListItemByTitle(ISP_MASTER_LIST_TITLE, payload);
      const createdId = Number(created?.Id ?? created?.d?.Id ?? created?.data?.Id);

      if (!createdId || !Number.isFinite(createdId)) {
        throw new Error('[IspRepository] Failed to extract ID from create response');
      }

      // 再取得で完全なフィールドを得る
      const rows = await client.listItems<SpIspMasterRow>(ISP_MASTER_LIST_TITLE, {
        select: SELECT,
        filter: `Id eq ${createdId}`,
        top: 1,
      });

      if (!rows[0]) {
        throw new Error(`[IspRepository] Failed to fetch created ISP with ID: ${createdId}`);
      }

      return mapIspRowToDomain(rows[0]);
    },

    async update(id: string, input: IspUpdateInput): Promise<IndividualSupportPlan> {
      assertWriteEnabled('isp.update');

      const numericId = extractSpId(id);
      if (numericId === null) {
        throw new Error(`[IspRepository] Invalid ID format: ${id}`);
      }

      const payload = mapIspUpdateInputToPayload(input);
      await client.updateItem(ISP_MASTER_LIST_TITLE, numericId, payload);

      // 更新後に再取得
      const rows = await client.listItems<SpIspMasterRow>(ISP_MASTER_LIST_TITLE, {
        select: SELECT,
        filter: `Id eq ${numericId}`,
        top: 1,
      });

      if (!rows[0]) {
        throw new Error(`[IspRepository] Failed to fetch updated ISP with ID: ${numericId}`);
      }

      return mapIspRowToDomain(rows[0]);
    },
  };
}

// ────────────────────────────────────────────────────────────────
// Utilities
// ────────────────────────────────────────────────────────────────

/**
 * ドメイン ID ("sp-42") から SP 用 数値 ID を抽出。
 * 数値だけの場合もサポート。
 */
export function extractSpId(id: string): number | null {
  const num = id.startsWith('sp-') ? Number(id.slice(3)) : Number(id);
  return Number.isFinite(num) && num > 0 ? num : null;
}

import { describe, expect, it, vi } from 'vitest';
import type { createSpClient } from '@/lib/spClient';
import {
  getByEntryKey,
  listByDate,
  listByMonth,
} from '../SharePointServiceProvisionRepository';

const createMockClient = () => ({
  getListItemsByTitle: vi.fn(),
  addListItemByTitle: vi.fn(),
  getItemByIdWithEtag: vi.fn(),
  updateItemByTitle: vi.fn(),
});

describe('SharePointServiceProvisionRepository', () => {
  it('returns empty list when ServiceProvisionRecords list is missing on listByDate', async () => {
    const client = createMockClient();
    const err = Object.assign(new Error("リスト 'ServiceProvisionRecords' は存在しません。"), {
      status: 404,
    });
    client.getListItemsByTitle.mockRejectedValue(err);

    const rows = await listByDate(
      client as unknown as ReturnType<typeof createSpClient>,
      '2026-03-29',
    );

    expect(rows).toEqual([]);
  });

  it('returns empty list when ServiceProvisionRecords list is missing on listByMonth', async () => {
    const client = createMockClient();
    const err = Object.assign(new Error('Not Found'), { status: 404 });
    client.getListItemsByTitle.mockRejectedValue(err);

    const rows = await listByMonth(
      client as unknown as ReturnType<typeof createSpClient>,
      '2026-03',
    );

    expect(rows).toEqual([]);
  });

  it('returns null when ServiceProvisionRecords list is missing on getByEntryKey', async () => {
    const client = createMockClient();
    const err = Object.assign(new Error('HTTP 404'), { status: 404 });
    client.getListItemsByTitle.mockRejectedValue(err);

    const row = await getByEntryKey(
      client as unknown as ReturnType<typeof createSpClient>,
      'U001|2026-03-29',
    );

    expect(row).toBeNull();
  });
});

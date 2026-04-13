import { beforeEach, describe, expect, it } from 'vitest';

import { DataProviderPlanningSheetRepository } from '../DataProviderPlanningSheetRepository';
import type {
  DataProviderOptions,
  IDataProvider,
} from '@/lib/data/dataProvider.interface';
import type { SpFieldDef } from '@/lib/sp/types';
import { PLANNING_SHEET_LIST_TITLE } from '@/sharepoint/fields/ispThreeLayerFields';

type SeedRow = {
  Id: number;
  Title: string;
  UserCode: string;
  ISPId: string;
  VersionNo: number;
  IsCurrent: boolean;
  Status: string;
  Created: string;
  Modified: string;
  ObservationFacts: string;
  InterpretationHypothesis: string;
  SupportIssues: string;
  SupportPolicy: string;
  ConcreteApproaches: string;
};

function row(overrides: Partial<SeedRow>): SeedRow {
  return {
    Id: 0,
    Title: '',
    UserCode: '',
    ISPId: '',
    VersionNo: 1,
    IsCurrent: true,
    Status: 'active',
    Created: '2026-01-01T00:00:00.000Z',
    Modified: '2026-01-01T00:00:00.000Z',
    ObservationFacts: 'obs',
    InterpretationHypothesis: 'hyp',
    SupportIssues: 'issues',
    SupportPolicy: 'policy',
    ConcreteApproaches: 'approaches',
    ...overrides,
  };
}

/**
 * Minimal in-memory provider that honors the OData-like filter strings
 * built by DataProviderPlanningSheetRepository. It supports:
 *   - "<Field> eq '<value>'"
 *   - "<Field> eq <bool>"
 *   - Conjunction via " and "
 */
class FakeDataProvider implements IDataProvider {
  private rows: Record<string, unknown>[] = [];
  public readonly lastFilters: string[] = [];

  seed(rows: Record<string, unknown>[]): void {
    this.rows = rows;
  }

  async listItems<T>(_resourceName: string, options?: DataProviderOptions): Promise<T[]> {
    const filter = options?.filter ?? '';
    this.lastFilters.push(filter);
    const predicates = parseFilter(filter);
    const filtered = this.rows.filter((r) => predicates.every((p) => p(r)));
    return filtered as T[];
  }

  async getItemById<T>(_resourceName: string, id: string | number): Promise<T> {
    const found = this.rows.find((r) => String(r.Id) === String(id));
    if (!found) throw new Error(`not found: ${id}`);
    return found as T;
  }

  async createItem<T>(_resourceName: string, payload: Record<string, unknown>): Promise<T> {
    return payload as T;
  }

  async updateItem<T>(_resourceName: string, _id: string | number, payload: Record<string, unknown>): Promise<T> {
    return payload as T;
  }

  async deleteItem(): Promise<void> {}

  async getFieldInternalNames(): Promise<Set<string>> {
    return new Set([
      'Id',
      'Title',
      'UserCode',
      'ISPId',
      'VersionNo',
      'IsCurrent',
      'Status',
      'Created',
      'Modified',
      'ObservationFacts',
      'InterpretationHypothesis',
      'SupportIssues',
      'SupportPolicy',
      'ConcreteApproaches',
    ]);
  }

  async ensureAuth(): Promise<void> {}
  async getFieldDefinitions(): Promise<SpFieldDef[]> {
    return [];
  }
}

function parseFilter(filter: string): Array<(row: Record<string, unknown>) => boolean> {
  if (!filter) return [];
  return filter.split(/\s+and\s+/i).map((clause) => {
    const match = clause.match(/^\s*(\w+)\s+eq\s+(.+?)\s*$/);
    if (!match) return () => true;
    const [, field, rawValue] = match;
    const value = rawValue.startsWith("'")
      ? rawValue.slice(1, -1).replace(/''/g, "'")
      : rawValue === 'true'
        ? true
        : rawValue === 'false'
          ? false
          : Number(rawValue);
    return (r) => {
      const actual = r[field];
      if (typeof value === 'boolean') return actual === value;
      return String(actual) === String(value);
    };
  });
}

describe('DataProviderPlanningSheetRepository', () => {
  let provider: FakeDataProvider;
  let repo: DataProviderPlanningSheetRepository;

  beforeEach(() => {
    provider = new FakeDataProvider();
    repo = new DataProviderPlanningSheetRepository(provider, PLANNING_SHEET_LIST_TITLE);
  });

  describe('listByUser', () => {
    it('returns all versions for the given user regardless of isCurrent', async () => {
      provider.seed([
        row({ Id: 1, UserCode: 'U-001', ISPId: 'ISP-A', VersionNo: 1, IsCurrent: false, Status: 'archived' }),
        row({ Id: 2, UserCode: 'U-001', ISPId: 'ISP-A', VersionNo: 2, IsCurrent: true, Status: 'active' }),
        row({ Id: 3, UserCode: 'U-002', ISPId: 'ISP-B', VersionNo: 1, IsCurrent: true, Status: 'active' }),
      ]);

      const items = await repo.listByUser('U-001');

      expect(items).toHaveLength(2);
      expect(items.map((i) => i.id).sort()).toEqual(['sp-1', 'sp-2']);
      expect(items.every((i) => i.userId === 'U-001')).toBe(true);
    });

    it('does not filter out archived versions', async () => {
      provider.seed([
        row({ Id: 1, UserCode: 'U-001', ISPId: 'ISP-A', VersionNo: 1, IsCurrent: false, Status: 'archived' }),
      ]);

      const items = await repo.listByUser('U-001');
      expect(items).toHaveLength(1);
      expect(items[0].status).toBe('archived');
    });

    it('returns empty array when no matching rows exist', async () => {
      provider.seed([row({ Id: 1, UserCode: 'U-999', ISPId: 'ISP-Z', VersionNo: 1 })]);
      const items = await repo.listByUser('U-000');
      expect(items).toEqual([]);
    });

    it('filter does not include IsCurrent clause (distinguishing from listCurrentByUser)', async () => {
      provider.seed([row({ Id: 1, UserCode: 'U-001', ISPId: 'ISP-A' })]);
      await repo.listByUser('U-001');
      const issued = provider.lastFilters.at(-1) ?? '';
      expect(issued).toContain("UserCode eq 'U-001'");
      expect(issued).not.toContain('IsCurrent');
    });
  });

  describe('listBySeries', () => {
    it('returns full SupportPlanningSheet for the given userId + ispId series', async () => {
      provider.seed([
        row({ Id: 10, UserCode: 'U-001', ISPId: 'ISP-A', VersionNo: 1, IsCurrent: false, Status: 'archived' }),
        row({ Id: 11, UserCode: 'U-001', ISPId: 'ISP-A', VersionNo: 2, IsCurrent: true, Status: 'active' }),
        row({ Id: 12, UserCode: 'U-001', ISPId: 'ISP-B', VersionNo: 1, IsCurrent: true, Status: 'active' }),
        row({ Id: 13, UserCode: 'U-002', ISPId: 'ISP-A', VersionNo: 1, IsCurrent: true, Status: 'active' }),
      ]);

      const sheets = await repo.listBySeries('U-001', 'ISP-A');

      expect(sheets).toHaveLength(2);
      expect(sheets.map((s) => s.version).sort()).toEqual([1, 2]);
      expect(sheets.every((s) => s.userId === 'U-001' && s.ispId === 'ISP-A')).toBe(true);
    });

    it('returns full domain shape including nested intake/assessment/planning', async () => {
      provider.seed([row({ Id: 20, UserCode: 'U-001', ISPId: 'ISP-A', VersionNo: 1 })]);

      const sheets = await repo.listBySeries('U-001', 'ISP-A');
      expect(sheets).toHaveLength(1);
      const sheet = sheets[0];
      expect(sheet.intake).toBeDefined();
      expect(sheet.assessment).toBeDefined();
      expect(sheet.planning).toBeDefined();
      expect(sheet.observationFacts).toBe('obs');
      expect(sheet.supportPolicy).toBe('policy');
    });

    it('returns empty array when series does not exist', async () => {
      provider.seed([row({ Id: 1, UserCode: 'U-001', ISPId: 'ISP-A', VersionNo: 1 })]);
      const sheets = await repo.listBySeries('U-001', 'ISP-Z');
      expect(sheets).toEqual([]);
    });

    it('escapes single quotes in ispId', async () => {
      provider.seed([row({ Id: 1, UserCode: 'U-001', ISPId: "ISP-A'B" })]);
      const sheets = await repo.listBySeries('U-001', "ISP-A'B");
      expect(sheets).toHaveLength(1);
    });
  });
});

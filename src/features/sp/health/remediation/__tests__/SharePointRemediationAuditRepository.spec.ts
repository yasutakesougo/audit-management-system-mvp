import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SharePointRemediationAuditRepository, type ISpAuditOperations } from '../SharePointRemediationAuditRepository';
import type { RemediationAuditEntry } from '../audit';

vi.mock('@/sharepoint/spListRegistry', () => ({
  findListEntry: vi.fn(() => ({
    key: 'remediation_audit_log',
    resolve: () => 'RemediationAuditLog',
  })),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<RemediationAuditEntry> = {}): RemediationAuditEntry {
  return {
    planId: 'plan-sp-1',
    phase: 'planned',
    listKey: 'TestList',
    fieldName: 'FieldA',
    action: 'delete_index',
    risk: 'safe',
    autoExecutable: true,
    requiresApproval: false,
    reason: 'SP test reason',
    source: 'nightly_patrol',
    timestamp: '2026-04-18T00:00:00.000Z',
    ...overrides,
  };
}

function makeMockSpClient(overrides: Partial<ISpAuditOperations> = {}): ISpAuditOperations {
  return {
    createItem: vi.fn(async () => ({})),
    getListItemsByTitle: vi.fn(async () => []),
    getListFieldInternalNames: vi.fn(async () => new Set([
      'PlanId', 'Phase', 'ListKey', 'FieldName', 'Action',
      'Risk', 'AutoExecutable', 'RequiresApproval', 'Reason',
      'Source', 'ExecutionStatus', 'ExecutionError', 'Timestamp',
    ])),
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('SharePointRemediationAuditRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── logEntry ─────────────────────────────────────────────────────────────

  it('should write audit entry to SP list', async () => {
    const spClient = makeMockSpClient();
    const repo = new SharePointRemediationAuditRepository(spClient);

    await repo.logEntry(makeEntry());

    expect(spClient.createItem).toHaveBeenCalledTimes(1);
    const [listTitle, payload] = vi.mocked(spClient.createItem).mock.calls[0];
    expect(listTitle).toBe('RemediationAuditLog');
    expect(payload).toMatchObject({
      Title: 'planned:plan-sp-1',
      PlanId: 'plan-sp-1',
      Phase: 'planned',
      ListKey: 'TestList',
      FieldName: 'FieldA',
      Action: 'delete_index',
      Risk: 'safe',
      AutoExecutable: true,
      RequiresApproval: false,
      Reason: 'SP test reason',
      Source: 'nightly_patrol',
      Timestamp: '2026-04-18T00:00:00.000Z',
    });
  });

  it('should include execution fields for executed phase', async () => {
    const spClient = makeMockSpClient();
    const repo = new SharePointRemediationAuditRepository(spClient);

    await repo.logEntry(makeEntry({
      phase: 'executed',
      executionStatus: 'error',
      executionError: { code: 'SP_API_ERROR', message: 'timeout', retryable: true },
    }));

    const [, payload] = vi.mocked(spClient.createItem).mock.calls[0];
    expect(payload).toMatchObject({
      ExecutionStatus: 'error',
    });
    expect(JSON.parse(payload.ExecutionError as string)).toEqual({
      code: 'SP_API_ERROR',
      message: 'timeout',
      retryable: true,
    });
  });

  it('should deduplicate same planId+phase on same day', async () => {
    const spClient = makeMockSpClient();
    const repo = new SharePointRemediationAuditRepository(spClient);

    await repo.logEntry(makeEntry());
    await repo.logEntry(makeEntry()); // same planId+phase+day

    expect(spClient.createItem).toHaveBeenCalledTimes(1);
  });

  it('should not deduplicate different phases', async () => {
    const spClient = makeMockSpClient();
    const repo = new SharePointRemediationAuditRepository(spClient);

    await repo.logEntry(makeEntry({ phase: 'planned' }));
    await repo.logEntry(makeEntry({ phase: 'executed' }));

    expect(spClient.createItem).toHaveBeenCalledTimes(2);
  });

  it('should survive write errors (fail-open)', async () => {
    const spClient = makeMockSpClient({
      createItem: vi.fn().mockRejectedValue(new Error('SP down')),
    });
    const repo = new SharePointRemediationAuditRepository(spClient);

    // Should not throw
    await repo.logEntry(makeEntry());

    expect(spClient.createItem).toHaveBeenCalledTimes(1);
  });

  // ── getEntries ───────────────────────────────────────────────────────────

  it('should read and map entries from SP list', async () => {
    const spClient = makeMockSpClient({
      getListItemsByTitle: vi.fn().mockResolvedValue([
        {
          Id: 1,
          Title: 'planned:plan-read-1',
          PlanId: 'plan-read-1',
          Phase: 'planned',
          ListKey: 'ReadList',
          FieldName: 'RF1',
          Action: 'create_index',
          Risk: 'moderate',
          AutoExecutable: false,
          RequiresApproval: true,
          Reason: 'read test',
          Source: 'realtime',
          Timestamp: '2026-04-18T10:00:00.000Z',
        },
      ]),
    });
    const repo = new SharePointRemediationAuditRepository(spClient);

    const entries = await repo.getEntries();

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      planId: 'plan-read-1',
      phase: 'planned',
      listKey: 'ReadList',
      fieldName: 'RF1',
      action: 'create_index',
      risk: 'moderate',
      autoExecutable: false,
      requiresApproval: true,
      reason: 'read test',
      source: 'realtime',
    });
  });

  it('should parse executionError JSON from SP', async () => {
    const spClient = makeMockSpClient({
      getListItemsByTitle: vi.fn().mockResolvedValue([
        {
          PlanId: 'p1',
          Phase: 'executed',
          ListKey: 'L',
          FieldName: 'F',
          Action: 'delete_index',
          Risk: 'safe',
          AutoExecutable: true,
          RequiresApproval: false,
          Reason: 'r',
          Source: 'ci',
          ExecutionStatus: 'error',
          ExecutionError: '{"code":"SP_API_ERROR","message":"fail","retryable":true}',
          Timestamp: '2026-04-18T00:00:00.000Z',
        },
      ]),
    });
    const repo = new SharePointRemediationAuditRepository(spClient);

    const [entry] = await repo.getEntries();

    expect(entry.executionStatus).toBe('error');
    expect(entry.executionError).toEqual({
      code: 'SP_API_ERROR',
      message: 'fail',
      retryable: true,
    });
  });

  it('should return empty array on read errors (fail-open)', async () => {
    const spClient = makeMockSpClient({
      getListItemsByTitle: vi.fn().mockRejectedValue(new Error('SP down')),
    });
    const repo = new SharePointRemediationAuditRepository(spClient);

    const entries = await repo.getEntries();
    expect(entries).toEqual([]);
  });

  it('should pass filter parameters to SP query', async () => {
    const spClient = makeMockSpClient();
    const repo = new SharePointRemediationAuditRepository(spClient);

    await repo.getEntries({ planId: 'p1', phase: 'executed', listKey: 'L1', limit: 50 });

    const [, , filter, , top] = vi.mocked(spClient.getListItemsByTitle).mock.calls[0];
    expect(filter).toContain("PlanId eq 'p1'");
    expect(filter).toContain("Phase eq 'executed'");
    expect(filter).toContain("ListKey eq 'L1'");
    expect(top).toBe(50);
  });
});

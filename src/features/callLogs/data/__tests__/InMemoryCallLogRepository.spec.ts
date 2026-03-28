/**
 * InMemoryCallLogRepository — 単体テスト
 *
 * 対象:
 *   - list        フィルタなし / status / targetStaffName / 複合
 *   - create      フィールドマッピング・status固定・デフォルト
 *   - updateStatus done への遷移・completedAt の自動セット・not found エラー
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  __resetInMemoryCallLogStoreForTests,
  InMemoryCallLogRepository,
} from '../InMemoryCallLogRepository';
import type { CallLog } from '@/domain/callLogs/schema';

// ─── テストデータビルダー ─────────────────────────────────────────────────────

function makeLog(overrides?: Partial<CallLog>): CallLog {
  return {
    id: `log-${Math.random().toString(36).slice(2)}`,
    receivedAt: '2026-03-18T09:00:00.000Z',
    callerName: '田中太郎',
    callerOrg: '○○機関',
    targetStaffName: '山田スタッフ',
    receivedByName: '受付者A',
    subject: '件名テスト',
    message: '本文テスト',
    needCallback: false,
    urgency: 'normal',
    status: 'new',
    createdAt: '2026-03-18T09:00:00.000Z',
    updatedAt: '2026-03-18T09:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  __resetInMemoryCallLogStoreForTests();
});

// ─── list ─────────────────────────────────────────────────────────────────────

describe('InMemoryCallLogRepository.list', () => {
  it('should return all logs when no filter is specified', async () => {
    const seed = [makeLog({ id: '1' }), makeLog({ id: '2' })];
    const repo = new InMemoryCallLogRepository(seed);

    const result = await repo.list();
    expect(result).toHaveLength(2);
  });

  it('should filter by status', async () => {
    const seed = [
      makeLog({ id: '1', status: 'new' }),
      makeLog({ id: '2', status: 'done' }),
      makeLog({ id: '3', status: 'callback_pending' }),
    ];
    const repo = new InMemoryCallLogRepository(seed);

    const result = await repo.list({ status: 'done' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('should filter by targetStaffName', async () => {
    const seed = [
      makeLog({ id: '1', targetStaffName: '山田スタッフ' }),
      makeLog({ id: '2', targetStaffName: '佐藤スタッフ' }),
    ];
    const repo = new InMemoryCallLogRepository(seed);

    const result = await repo.list({ targetStaffName: '山田スタッフ' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('should sort results by receivedAt descending', async () => {
    const seed = [
      makeLog({ id: '1', receivedAt: '2026-03-18T08:00:00.000Z' }),
      makeLog({ id: '2', receivedAt: '2026-03-18T10:00:00.000Z' }),
      makeLog({ id: '3', receivedAt: '2026-03-18T09:00:00.000Z' }),
    ];
    const repo = new InMemoryCallLogRepository(seed);

    const result = await repo.list();
    expect(result.map((l) => l.id)).toEqual(['2', '3', '1']);
  });

  it('should return empty array when no logs exist', async () => {
    const repo = new InMemoryCallLogRepository();
    const result = await repo.list();
    expect(result).toEqual([]);
  });
});

describe('InMemoryCallLogRepository shared store option', () => {
  it('shares state between repository instances when useSharedStore=true', async () => {
    const repoA = new InMemoryCallLogRepository([], { useSharedStore: true });
    const repoB = new InMemoryCallLogRepository([], { useSharedStore: true });

    await repoA.create(
      {
        callerName: '共有ストア利用者',
        targetStaffName: '担当A',
        subject: '共有テスト',
        message: '同じストアを参照する',
        needCallback: false,
      },
      '受付',
    );

    const logs = await repoB.list();
    expect(logs).toHaveLength(1);
    expect(logs[0].subject).toBe('共有テスト');
  });
});

// ─── create ───────────────────────────────────────────────────────────────────

describe('InMemoryCallLogRepository.create', () => {
  let repo: InMemoryCallLogRepository;

  beforeEach(() => {
    repo = new InMemoryCallLogRepository();
  });

  it('should create a callback_pending log when needCallback is true', async () => {
    const log = await repo.create(
      {
        callerName: '田中太郎',
        targetStaffName: '山田スタッフ',
        subject: 'テスト件名',
        message: 'テスト本文',
        needCallback: true,
      },
      '受付者A',
    );

    expect(log.status).toBe('callback_pending');
  });

  it('should create a new log when callback requirement is absent', async () => {
    const log = await repo.create(
      {
        callerName: '田中太郎',
        targetStaffName: '山田スタッフ',
        subject: 'テスト件名',
        message: 'テスト本文',
        needCallback: false,
      },
      '受付者A',
    );

    expect(log.status).toBe('new');
  });

  it('should inject receivedByName from argument', async () => {
    const log = await repo.create(
      {
        callerName: '田中太郎',
        targetStaffName: '山田スタッフ',
        subject: 'テスト件名',
        message: 'テスト本文',
        needCallback: false,
      },
      'テスト受付者',
    );

    expect(log.receivedByName).toBe('テスト受付者');
  });

  it('should default urgency to "normal" when not provided', async () => {
    const log = await repo.create(
      {
        callerName: '田中太郎',
        targetStaffName: '山田スタッフ',
        subject: 'テスト件名',
        message: 'テスト本文',
        needCallback: false,
      },
      '受付者A',
    );

    expect(log.urgency).toBe('normal');
  });

  it('should use provided urgency when specified', async () => {
    const log = await repo.create(
      {
        callerName: '田中太郎',
        targetStaffName: '山田スタッフ',
        subject: 'テスト件名',
        message: 'テスト本文',
        needCallback: false,
        urgency: 'urgent',
      },
      '受付者A',
    );

    expect(log.urgency).toBe('urgent');
  });

  it('should assign a unique id to each created log', async () => {
    const input = {
      callerName: 'A',
      targetStaffName: 'B',
      subject: 'S',
      message: 'M',
      needCallback: false,
    };
    const log1 = await repo.create(input, 'R');
    const log2 = await repo.create(input, 'R');

    expect(log1.id).not.toBe(log2.id);
  });

  it('should make the created log appear in list()', async () => {
    await repo.create(
      {
        callerName: '田中太郎',
        targetStaffName: '山田スタッフ',
        subject: 'テスト件名',
        message: 'テスト本文',
        needCallback: true,
      },
      '受付者A',
    );

    const logs = await repo.list();
    expect(logs).toHaveLength(1);
    expect(logs[0].callerName).toBe('田中太郎');
  });
});

// ─── updateStatus ─────────────────────────────────────────────────────────────

describe('InMemoryCallLogRepository.updateStatus', () => {
  it('should change status to "done"', async () => {
    const repo = new InMemoryCallLogRepository([makeLog({ id: 'L1', status: 'new' })]);

    await repo.updateStatus('L1', 'done');

    const logs = await repo.list();
    expect(logs[0].status).toBe('done');
  });

  it('should set completedAt when status becomes "done"', async () => {
    const repo = new InMemoryCallLogRepository([makeLog({ id: 'L2', status: 'new' })]);

    await repo.updateStatus('L2', 'done');

    const logs = await repo.list();
    expect(logs[0].completedAt).toBeDefined();
  });

  it('should not set completedAt when status is "callback_pending"', async () => {
    const original = makeLog({ id: 'L3', status: 'new', completedAt: undefined });
    const repo = new InMemoryCallLogRepository([original]);

    await repo.updateStatus('L3', 'callback_pending');

    const logs = await repo.list();
    expect(logs[0].completedAt).toBeUndefined();
  });

  it('should clear completedAt when reopening from done to callback_pending', async () => {
    const original = makeLog({
      id: 'L3b',
      status: 'done',
      completedAt: '2026-03-18T09:00:00.000Z',
    });
    const repo = new InMemoryCallLogRepository([original]);

    await repo.updateStatus('L3b', 'callback_pending');

    const logs = await repo.list();
    expect(logs[0].status).toBe('callback_pending');
    expect(logs[0].completedAt).toBeUndefined();
  });

  it('should change status to "callback_pending"', async () => {
    const repo = new InMemoryCallLogRepository([makeLog({ id: 'L4', status: 'new' })]);

    await repo.updateStatus('L4', 'callback_pending');

    const logs = await repo.list();
    expect(logs[0].status).toBe('callback_pending');
  });

  it('should throw an error when log is not found', async () => {
    const repo = new InMemoryCallLogRepository();

    await expect(repo.updateStatus('NONEXISTENT', 'done')).rejects.toThrow(
      '[InMemoryCallLogRepository] id=NONEXISTENT not found',
    );
  });
});

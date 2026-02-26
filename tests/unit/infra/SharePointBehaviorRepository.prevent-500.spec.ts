import { SharePointBehaviorRepository } from '@/features/daily/infra/SharePointBehaviorRepository';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('SharePointBehaviorRepository - Prevent 500 on missing required fields', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockSp: any;

  beforeEach(() => {
    mockSp = {
      getListFieldInternalNames: vi.fn(),
      spFetch: vi.fn(),
    };
  });

  it('should throw error without calling spFetch when UserCode is missing', async () => {
    // Arrange: UserCode が存在しない Set を返す
    mockSp.getListFieldInternalNames.mockResolvedValue(
      new Set(['Id', 'Title', 'RecordDate', 'TimeSlot', 'Behavior'])
    );

    const repo = new SharePointBehaviorRepository({
      sp: mockSp,
    });

    // Act & Assert
    await expect(repo.listByUser('I022')).rejects.toThrow(
      /必要な列が見つかりません|UserCode/
    );

    // Assert: spFetch が呼ばれていないこと（500 を出さない）
    expect(mockSp.spFetch).not.toHaveBeenCalled();
  });

  it('should throw error without calling spFetch when RecordDate is missing', async () => {
    // Arrange: RecordDate が存在しない Set を返す
    mockSp.getListFieldInternalNames.mockResolvedValue(
      new Set(['Id', 'Title', 'UserCode', 'TimeSlot', 'Behavior'])
    );

    const repo = new SharePointBehaviorRepository({
      sp: mockSp,
    });

    // Act & Assert
    await expect(repo.listByUser('I022')).rejects.toThrow(
      /必要な列が見つかりません|RecordDate/
    );

    // Assert: spFetch が呼ばれていないこと
    expect(mockSp.spFetch).not.toHaveBeenCalled();
  });

  it('should throw error with available fields list in dev environment', async () => {
    // Arrange: localhost で実行されている前提
    Object.defineProperty(window, 'location', {
      value: { hostname: 'localhost' },
      writable: true,
    });

    mockSp.getListFieldInternalNames.mockResolvedValue(
      new Set(['Id', 'Title', 'TimeSlot', 'Behavior', 'version', 'Custom1', 'Custom2'])
    );

    const repo = new SharePointBehaviorRepository({
      sp: mockSp,
    });

    // Act & Assert
    const result = await repo.listByUser('I022').catch((e: unknown) => e);
    const error = result instanceof Error ? result : new Error(String(result));

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain('必要な列が見つかりません');
    expect(error.message).toContain('Available internal names');
    expect(error.message).toContain('UserCode');
    expect(error.message).toContain('RecordDate');
  });

  it('should succeed with all required fields present', async () => {
    // Arrange: すべての必須列が存在
    mockSp.getListFieldInternalNames.mockResolvedValue(
      new Set(['Id', 'UserCode', 'RecordDate', 'TimeSlot', 'Behavior', 'version', 'duration'])
    );
    mockSp.spFetch.mockResolvedValue(
      new Response(JSON.stringify({ value: [] }), { status: 200 })
    );

    const repo = new SharePointBehaviorRepository({
      sp: mockSp,
    });

    // Act
    await repo.listByUser('I022');

    // Assert: spFetch が呼ばれること（正常系）
    expect(mockSp.spFetch).toHaveBeenCalled();
  });
});

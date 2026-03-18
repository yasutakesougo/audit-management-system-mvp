// ---------------------------------------------------------------------------
// createMonitoringMeetingRepository.spec.ts
//
// テスト観点:
//   1. mode 'local' → localMonitoringMeetingRepository を返す
//   2. mode 未指定 → デフォルトで local を返す
//   3. mode 'sharepoint' + spClient なし → エラー
//   4. mode 'sharepoint' + spClient あり → Port 契約を満たす
//   5. 返却された repository が Port 契約を満たす (local)
// ---------------------------------------------------------------------------

import { describe, it, expect, vi } from 'vitest';

import { createMonitoringMeetingRepository } from '../createMonitoringMeetingRepository';
import { localMonitoringMeetingRepository } from '@/infra/localStorage/localMonitoringMeetingRepository';
import type { UseSP } from '@/lib/spClient';

/** 最小限の UseSP stub */
function createMockSpClient(): UseSP {
  return {
    spFetch: vi.fn(),
    listItems: vi.fn(),
    getListItemsByTitle: vi.fn(),
    addListItemByTitle: vi.fn(),
    addItemByTitle: vi.fn(),
    updateItemByTitle: vi.fn(),
    updateItem: vi.fn(),
    deleteItemByTitle: vi.fn(),
    deleteItem: vi.fn(),
    getItemById: vi.fn(),
    getItemByIdWithEtag: vi.fn(),
    createItem: vi.fn(),
    batch: vi.fn(),
    postBatch: vi.fn(),
    ensureListExists: vi.fn(),
    tryGetListMetadata: vi.fn(),
    getListFieldInternalNames: vi.fn(),
  } as unknown as UseSP;
}

describe('createMonitoringMeetingRepository', () => {
  // ── 1. mode 'local' → local repo ──
  it('returns localMonitoringMeetingRepository when mode is "local"', () => {
    const repo = createMonitoringMeetingRepository('local');
    expect(repo).toBe(localMonitoringMeetingRepository);
  });

  // ── 2. デフォルト → local repo ──
  it('defaults to local mode when no argument is provided', () => {
    const repo = createMonitoringMeetingRepository();
    expect(repo).toBe(localMonitoringMeetingRepository);
  });

  // ── 3. mode 'sharepoint' + spClient なし → エラー ──
  it('throws when sharepoint mode is requested without spClient', () => {
    expect(() => createMonitoringMeetingRepository('sharepoint')).toThrow(
      /sharepoint mode requires options\.spClient/,
    );
  });

  // ── 4. mode 'sharepoint' + spClient あり → Port 契約 ──
  it('returns a repository fulfilling Port when sharepoint mode has spClient', () => {
    const mockClient = createMockSpClient();
    const repo = createMonitoringMeetingRepository('sharepoint', { spClient: mockClient });

    expect(typeof repo.save).toBe('function');
    expect(typeof repo.getAll).toBe('function');
    expect(typeof repo.getById).toBe('function');
    expect(typeof repo.listByUser).toBe('function');
    expect(typeof repo.listByIsp).toBe('function');
    expect(typeof repo.delete).toBe('function');
  });

  // ── 5. Port 契約 (local) ──
  it('returned local repository fulfills MonitoringMeetingRepository interface', () => {
    const repo = createMonitoringMeetingRepository();

    expect(typeof repo.save).toBe('function');
    expect(typeof repo.getAll).toBe('function');
    expect(typeof repo.getById).toBe('function');
    expect(typeof repo.listByUser).toBe('function');
    expect(typeof repo.listByIsp).toBe('function');
    expect(typeof repo.delete).toBe('function');
  });
});


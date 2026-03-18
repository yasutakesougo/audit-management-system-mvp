// ---------------------------------------------------------------------------
// Phase 3 配線検証: createMonitoringMeetingRepository Factory
//
// 検証項目:
//   - mode='sharepoint' + spClient → SP repository が返る
//   - mode='local' → local repository が返る
//   - SP_ENABLED に応じた条件分岐パターンの正当性
// ---------------------------------------------------------------------------

import { describe, expect, it, vi } from 'vitest';

import {
  createMonitoringMeetingRepository,
} from '@/features/monitoring/repositories/createMonitoringMeetingRepository';
import type { MonitoringMeetingRepository } from '@/domain/isp/monitoringMeetingRepository';
import type { UseSP } from '@/lib/spClient';

/** Minimal spClient mock typed to satisfy the factory without `any` leaks. */
const createMockSpClient = () =>
  ({ spFetch: vi.fn() }) as unknown as UseSP;

describe('createMonitoringMeetingRepository — Phase 3 モード切替', () => {
  it('mode=local で repository が返る', () => {
    const repo = createMonitoringMeetingRepository('local');
    expect(repo).toBeDefined();
    expect(typeof repo.getById).toBe('function');
    expect(typeof repo.listByUser).toBe('function');
    expect(typeof repo.listByIsp).toBe('function');
    expect(typeof repo.save).toBe('function');
    expect(typeof repo.delete).toBe('function');
  });

  it('mode=sharepoint + spClient で repository が返る', () => {
    const mockSpClient = createMockSpClient();

    const repo = createMonitoringMeetingRepository('sharepoint', {
      spClient: mockSpClient,
    });

    expect(repo).toBeDefined();
    expect(typeof repo.getById).toBe('function');
    expect(typeof repo.listByUser).toBe('function');
    expect(typeof repo.listByIsp).toBe('function');
    expect(typeof repo.save).toBe('function');
    expect(typeof repo.delete).toBe('function');
  });

  it('UI層の SP_ENABLED 分岐パターン: SP_ENABLED=true → sharepoint mode', () => {
    // UI コンポーネント内のパターンを再現
    const SP_ENABLED = true;
    const spClient = createMockSpClient();

    const repo: MonitoringMeetingRepository = SP_ENABLED
      ? createMonitoringMeetingRepository('sharepoint', { spClient })
      : createMonitoringMeetingRepository('local');

    expect(repo).toBeDefined();
    expect(typeof repo.listByUser).toBe('function');
  });

  it('UI層の SP_ENABLED 分岐パターン: SP_ENABLED=false → local mode', () => {
    const SP_ENABLED = false;
    const spClient = createMockSpClient();

    const repo: MonitoringMeetingRepository = SP_ENABLED
      ? createMonitoringMeetingRepository('sharepoint', { spClient })
      : createMonitoringMeetingRepository('local');

    expect(repo).toBeDefined();
    expect(typeof repo.listByUser).toBe('function');
  });
});


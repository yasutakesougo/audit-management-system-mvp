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
    // spClient の最低限のモック
    const mockSpClient = {
      spFetch: vi.fn(),
    };

    const repo = createMonitoringMeetingRepository('sharepoint', {
      spClient: mockSpClient as any,
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
    const spClient = { spFetch: vi.fn() };

    const repo: MonitoringMeetingRepository = SP_ENABLED
      ? createMonitoringMeetingRepository('sharepoint', { spClient: spClient as any })
      : createMonitoringMeetingRepository('local');

    expect(repo).toBeDefined();
    expect(typeof repo.listByUser).toBe('function');
  });

  it('UI層の SP_ENABLED 分岐パターン: SP_ENABLED=false → local mode', () => {
    const SP_ENABLED = false;
    const spClient = { spFetch: vi.fn() };

    const repo: MonitoringMeetingRepository = SP_ENABLED
      ? createMonitoringMeetingRepository('sharepoint', { spClient: spClient as any })
      : createMonitoringMeetingRepository('local');

    expect(repo).toBeDefined();
    expect(typeof repo.listByUser).toBe('function');
  });
});

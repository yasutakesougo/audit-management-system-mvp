// ---------------------------------------------------------------------------
// createMonitoringMeetingRepository.spec.ts
//
// テスト観点:
//   1. mode 'local' → localMonitoringMeetingRepository を返す
//   2. mode 未指定 → デフォルトで local を返す
//   3. mode 'sharepoint' → 未実装エラーを投げる
//   4. 返却された repository が Port 契約を満たす
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';

import { createMonitoringMeetingRepository } from '../createMonitoringMeetingRepository';
import { localMonitoringMeetingRepository } from '@/infra/localStorage/localMonitoringMeetingRepository';

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

  // ── 3. mode 'sharepoint' → 未実装エラー ──
  it('throws when sharepoint mode is requested (not yet implemented)', () => {
    expect(() => createMonitoringMeetingRepository('sharepoint')).toThrow(
      /sharepoint mode is not yet implemented/,
    );
  });

  // ── 4. Port 契約 ──
  it('returned repository fulfills MonitoringMeetingRepository interface', () => {
    const repo = createMonitoringMeetingRepository();

    expect(typeof repo.save).toBe('function');
    expect(typeof repo.getAll).toBe('function');
    expect(typeof repo.getById).toBe('function');
    expect(typeof repo.listByUser).toBe('function');
    expect(typeof repo.listByIsp).toBe('function');
    expect(typeof repo.delete).toBe('function');
  });
});

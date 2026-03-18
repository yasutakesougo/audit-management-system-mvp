import { describe, it, expect } from 'vitest';
import { worstSignal, signalCounts } from '@/features/support-plan-guide/domain/regulatoryHud';
import type { RegulatoryHudItem } from '@/features/support-plan-guide/domain/regulatoryHud';

describe('worstSignal', () => {
  it('returns ok for empty items', () => {
    expect(worstSignal([])).toBe('ok');
  });

  it('returns danger if any item is danger', () => {
    const items: RegulatoryHudItem[] = [
      { key: '1', label: '', signal: 'ok' },
      { key: '2', label: '', signal: 'warning' },
      { key: '3', label: '', signal: 'danger' },
    ];
    expect(worstSignal(items)).toBe('danger');
  });

  it('returns warning if worst is warning', () => {
    const items: RegulatoryHudItem[] = [
      { key: '1', label: '', signal: 'ok' },
      { key: '2', label: '', signal: 'warning' },
    ];
    expect(worstSignal(items)).toBe('warning');
  });

  it('returns ok if all are ok', () => {
    const items: RegulatoryHudItem[] = [
      { key: '1', label: '', signal: 'ok' },
      { key: '2', label: '', signal: 'ok' },
    ];
    expect(worstSignal(items)).toBe('ok');
  });
});

describe('signalCounts', () => {
  it('counts correctly', () => {
    const items: RegulatoryHudItem[] = [
      { key: '1', label: '', signal: 'ok' },
      { key: '2', label: '', signal: 'warning' },
      { key: '3', label: '', signal: 'danger' },
      { key: '4', label: '', signal: 'danger' },
    ];
    
    expect(signalCounts(items)).toEqual({
      ok: 1,
      warning: 1,
      danger: 2,
    });
  });
});

import { describe, it, expect } from 'vitest';
import { classifyAlertStates } from '../classifyAlertState';
import type { KpiAlert } from '../computeCtaKpiDiff';

// ── helpers ─────────────────────────────────────────────────────────────────

const mkAlert = (id: string, value: number, severity: 'warning' | 'critical' = 'warning'): KpiAlert => ({
  id,
  severity,
  label: `Alert ${id}`,
  message: `value is ${value}`,
  value,
  threshold: id.includes('-high') ? 40 : 70,
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe('classifyAlertStates', () => {
  it('前期間になければ new', () => {
    const current = [mkAlert('hero-rate-low', 60)];
    const result = classifyAlertStates(current, []);
    expect(result).toHaveLength(1);
    expect(result[0].state).toBe('new');
    expect(result[0].previousValue).toBeNull();
    expect(result[0].delta).toBeNull();
  });

  it('同じ値で前期間にあれば continuing', () => {
    const current = [mkAlert('hero-rate-low', 60)];
    const previous = [mkAlert('hero-rate-low', 60)];
    const result = classifyAlertStates(current, previous);
    expect(result[0].state).toBe('continuing');
    expect(result[0].delta).toBe(0);
  });

  it('low 系で値が上がれば improving', () => {
    const current = [mkAlert('hero-rate-low', 65)];
    const previous = [mkAlert('hero-rate-low', 55)];
    const result = classifyAlertStates(current, previous);
    expect(result[0].state).toBe('improving');
    expect(result[0].delta).toBe(10);
  });

  it('low 系で値が下がれば worsening', () => {
    const current = [mkAlert('hero-rate-low', 50)];
    const previous = [mkAlert('hero-rate-low', 60)];
    const result = classifyAlertStates(current, previous);
    expect(result[0].state).toBe('worsening');
    expect(result[0].delta).toBe(-10);
  });

  it('high 系で値が下がれば improving', () => {
    const current = [mkAlert('queue-rate-high', 45)];
    const previous = [mkAlert('queue-rate-high', 55)];
    const result = classifyAlertStates(current, previous);
    expect(result[0].state).toBe('improving');
    expect(result[0].delta).toBe(-10);
  });

  it('high 系で値が上がれば worsening', () => {
    const current = [mkAlert('queue-rate-high', 60)];
    const previous = [mkAlert('queue-rate-high', 50)];
    const result = classifyAlertStates(current, previous);
    expect(result[0].state).toBe('worsening');
    expect(result[0].delta).toBe(10);
  });

  it('role付き ID でも正しく分類', () => {
    const current = [mkAlert('role-hero-rate-low:staff', 55)];
    const previous = [mkAlert('role-hero-rate-low:staff', 65)];
    const result = classifyAlertStates(current, previous);
    expect(result[0].state).toBe('worsening');
  });

  it('unknown-role-share-high が high として処理される', () => {
    const current = [mkAlert('unknown-role-share-high', 30)];
    const previous = [mkAlert('unknown-role-share-high', 40)];
    const result = classifyAlertStates(current, previous);
    expect(result[0].state).toBe('improving');
  });

  it('複数 alerts を同時に分類', () => {
    const current = [
      mkAlert('hero-rate-low', 60),
      mkAlert('queue-rate-high', 55),
      mkAlert('completion-low', 40, 'critical'),
    ];
    const previous = [
      mkAlert('hero-rate-low', 60),   // continuing
      mkAlert('queue-rate-high', 60),  // improving (high: 55<60)
    ];
    const result = classifyAlertStates(current, previous);
    expect(result[0].state).toBe('continuing');
    expect(result[1].state).toBe('improving');
    expect(result[2].state).toBe('new'); // completion-low は前期間なし
  });

  it('空配列では空結果', () => {
    const result = classifyAlertStates([], []);
    expect(result).toHaveLength(0);
  });

  it('previousValue を正しく保持', () => {
    const current = [mkAlert('hero-rate-low', 60)];
    const previous = [mkAlert('hero-rate-low', 65)];
    const result = classifyAlertStates(current, previous);
    expect(result[0].previousValue).toBe(65);
  });
});

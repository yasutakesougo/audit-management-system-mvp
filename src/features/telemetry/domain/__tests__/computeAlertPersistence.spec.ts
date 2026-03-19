import { describe, it, expect } from 'vitest';
import {
  computeAlertPersistence,
  formatPersistenceDuration,
  formatWorseningStreak,
} from '../computeAlertPersistence';
import type { KpiAlert } from '../computeCtaKpiDiff';

const makeAlert = (id: string, value: number, severity: 'warning' | 'critical' = 'warning'): KpiAlert => ({
  id,
  severity,
  label: `テスト: ${id}`,
  message: `テスト alert ${id}`,
  value,
  threshold: 70,
});

describe('computeAlertPersistence', () => {
  it('current のみに存在するアラートは new', () => {
    const result = computeAlertPersistence({
      currentAlerts: [makeAlert('hero-rate-low', 55)],
      previousAlerts: [],
      currentPeriodStart: '2026-03-20',
      previousPeriodStart: '2026-03-13',
    });
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('new');
    expect(result[0].consecutivePeriods).toBe(1);
    expect(result[0].worseningStreak).toBe(0);
    expect(result[0].firstSeenAt).toBe('2026-03-20');
    expect(result[0].previousValue).toBeNull();
    expect(result[0].delta).toBeNull();
  });

  it('current + previous 両方に存在し値が同じ → ongoing', () => {
    const result = computeAlertPersistence({
      currentAlerts: [makeAlert('hero-rate-low', 55)],
      previousAlerts: [makeAlert('hero-rate-low', 55)],
      currentPeriodStart: '2026-03-20',
      previousPeriodStart: '2026-03-13',
    });
    expect(result[0].status).toBe('ongoing');
    expect(result[0].consecutivePeriods).toBe(2);
    expect(result[0].worseningStreak).toBe(0);
    expect(result[0].delta).toBe(0);
  });

  it('low 系: 値が上がる → improving', () => {
    const result = computeAlertPersistence({
      currentAlerts: [makeAlert('hero-rate-low', 65)],
      previousAlerts: [makeAlert('hero-rate-low', 55)],
      currentPeriodStart: '2026-03-20',
      previousPeriodStart: '2026-03-13',
    });
    expect(result[0].status).toBe('improving');
    expect(result[0].delta).toBe(10);
    expect(result[0].worseningStreak).toBe(0);
  });

  it('low 系: 値が下がる → worsening', () => {
    const result = computeAlertPersistence({
      currentAlerts: [makeAlert('hero-rate-low', 45)],
      previousAlerts: [makeAlert('hero-rate-low', 55)],
      currentPeriodStart: '2026-03-20',
      previousPeriodStart: '2026-03-13',
    });
    expect(result[0].status).toBe('worsening');
    expect(result[0].delta).toBe(-10);
    expect(result[0].worseningStreak).toBe(1);
  });

  it('high 系: 値が下がる → improving', () => {
    const result = computeAlertPersistence({
      currentAlerts: [makeAlert('queue-rate-high', 75)],
      previousAlerts: [makeAlert('queue-rate-high', 85)],
      currentPeriodStart: '2026-03-20',
      previousPeriodStart: '2026-03-13',
    });
    expect(result[0].status).toBe('improving');
    expect(result[0].delta).toBe(-10);
  });

  it('high 系: 値が上がる → worsening', () => {
    const result = computeAlertPersistence({
      currentAlerts: [makeAlert('queue-rate-high', 90)],
      previousAlerts: [makeAlert('queue-rate-high', 80)],
      currentPeriodStart: '2026-03-20',
      previousPeriodStart: '2026-03-13',
    });
    expect(result[0].status).toBe('worsening');
    expect(result[0].worseningStreak).toBe(1);
  });

  it('alertKey が role ごとに分かれる', () => {
    const result = computeAlertPersistence({
      currentAlerts: [
        makeAlert('hero-rate-low:staff', 50),
        makeAlert('hero-rate-low:admin', 60),
      ],
      previousAlerts: [makeAlert('hero-rate-low:staff', 55)],
      currentPeriodStart: '2026-03-20',
      previousPeriodStart: '2026-03-13',
    });
    expect(result).toHaveLength(2);
    expect(result[0].status).toBe('worsening'); // staff: 55→50
    expect(result[1].status).toBe('new'); // admin: new
  });

  it('previous なしでも安全に動く', () => {
    const result = computeAlertPersistence({
      currentAlerts: [makeAlert('a', 10), makeAlert('b', 20)],
      previousAlerts: [],
      currentPeriodStart: '2026-03-20',
      previousPeriodStart: '2026-03-13',
    });
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.status === 'new')).toBe(true);
  });

  it('current が空なら空配列を返す', () => {
    const result = computeAlertPersistence({
      currentAlerts: [],
      previousAlerts: [makeAlert('a', 50)],
      currentPeriodStart: '2026-03-20',
      previousPeriodStart: '2026-03-13',
    });
    expect(result).toEqual([]);
  });

  it('firstSeenAt は前期間に存在する場合 previousPeriodStart を設定する', () => {
    const result = computeAlertPersistence({
      currentAlerts: [makeAlert('hero-rate-low', 55)],
      previousAlerts: [makeAlert('hero-rate-low', 55)],
      currentPeriodStart: '2026-03-20',
      previousPeriodStart: '2026-03-13',
    });
    expect(result[0].firstSeenAt).toBe('2026-03-13');
    expect(result[0].lastSeenAt).toBe('2026-03-20');
  });
});

describe('formatPersistenceDuration', () => {
  it('1以下 → 今期のみ', () => {
    expect(formatPersistenceDuration(0)).toBe('今期のみ');
    expect(formatPersistenceDuration(1)).toBe('今期のみ');
  });

  it('2以上 → N期間継続', () => {
    expect(formatPersistenceDuration(2)).toBe('2期間継続');
    expect(formatPersistenceDuration(5)).toBe('5期間継続');
  });
});

describe('formatWorseningStreak', () => {
  it('0以下 → null', () => {
    expect(formatWorseningStreak(0)).toBeNull();
    expect(formatWorseningStreak(-1)).toBeNull();
  });

  it('1以上 → N期間連続悪化', () => {
    expect(formatWorseningStreak(1)).toBe('1期間連続悪化');
    expect(formatWorseningStreak(3)).toBe('3期間連続悪化');
  });
});

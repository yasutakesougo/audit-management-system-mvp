import { describe, expect, it } from 'vitest';

import { TODAY_SIGNAL_DISPLAY_CONFIG } from './todaySignal.constants';
import type { TodaySignalCode } from '../types/todaySignal.types';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends
    (<T>() => T extends B ? 1 : 2)
    ? true
    : false;
type Expect<T extends true> = T;

type _SignalCodeConfigAlignment = Expect<
  Equal<keyof typeof TODAY_SIGNAL_DISPLAY_CONFIG, TodaySignalCode>
>;

const SIGNAL_CODES: TodaySignalCode[] = [
  'daily_record_missing',
  'health_record_missing',
  'handoff_unread',
  'monitoring_overdue',
  'monitoring_due_soon',
  'isp_renew_suggest',
  'risk_health_alert',
];

describe('todaySignal.constants', () => {
  it('TodaySignalCode と display config のキーが一致する', () => {
    const keys = Object.keys(TODAY_SIGNAL_DISPLAY_CONFIG).sort();
    const expected = [...SIGNAL_CODES].sort();
    expect(keys).toEqual(expected);
  });

  it('isp_renew_suggest の契約値が正しい', () => {
    const config = TODAY_SIGNAL_DISPLAY_CONFIG.isp_renew_suggest;
    expect(config.priority).toBe('P2');
    expect(config.audience).toEqual(['admin']);
    expect(config.prefix).toBe('【計画見直し】');
    expect(config.group).toBe('planning');
    expect(config.severity).toBe('info');
  });
});

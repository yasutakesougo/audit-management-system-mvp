import { describe, expect, it } from 'vitest';
import { deriveAnomalyUiStatus } from './AnomalyStatusChip';

describe('deriveAnomalyUiStatus', () => {
  it('totalEvents=0 は unknown を返す', () => {
    expect(deriveAnomalyUiStatus({ totalEvents: 0, warningCount: 0 })).toBe('unknown');
  });

  it('warningCount>0 は warning を返す', () => {
    expect(deriveAnomalyUiStatus({ totalEvents: 10, warningCount: 1 })).toBe('warning');
  });

  it('イベントあり + warning 0 は ok を返す', () => {
    expect(deriveAnomalyUiStatus({ totalEvents: 10, warningCount: 0 })).toBe('ok');
  });
});

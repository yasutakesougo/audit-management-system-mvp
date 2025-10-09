import { describe, expect, it } from 'vitest';
import {
  STATUS_DEFAULT,
  STATUS_LABELS,
  normalizeStatus,
  toSharePointStatus,
} from '@/features/schedule/statusDictionary';
import { SCHEDULE_STATUSES } from '@/features/schedule/types';

describe('statusDictionary', () => {
  it('exposes labels for every schedule status and a default', () => {
    expect(STATUS_DEFAULT).toBe('下書き');
    expect(Object.keys(STATUS_LABELS)).toEqual([...SCHEDULE_STATUSES]);
  });

  it('normalizes common aliases and SharePoint values', () => {
    expect(normalizeStatus('未確定')).toBe('下書き');
    expect(normalizeStatus('draft')).toBe('下書き');
    expect(normalizeStatus('実施中')).toBe('申請中');
    expect(normalizeStatus('in-progress')).toBe('申請中');
    expect(normalizeStatus('確定')).toBe('承認済み');
    expect(normalizeStatus('confirmed')).toBe('承認済み');
    expect(normalizeStatus('完了')).toBe('完了');
    expect(normalizeStatus('completed')).toBe('完了');
  });

  it('falls back to the default when input is empty or unknown', () => {
    expect(normalizeStatus('')).toBe(STATUS_DEFAULT);
    expect(normalizeStatus(null)).toBe(STATUS_DEFAULT);
    expect(normalizeStatus('unexpected')).toBe(STATUS_DEFAULT);
  });

  it('maps canonical statuses to SharePoint values', () => {
    expect(toSharePointStatus('下書き')).toBe('未確定');
    expect(toSharePointStatus('申請中')).toBe('実施中');
    expect(toSharePointStatus('承認済み')).toBe('確定');
    expect(toSharePointStatus('完了')).toBe('完了');
    expect(toSharePointStatus('unknown')).toBe('未確定');
  });
});

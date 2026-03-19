/**
 * callLogFilterPresets — pure function テスト
 */

import { describe, it, expect } from 'vitest';
import { parseFilterPreset, getPresetConfig, buildCallLogFilterUrl } from '../callLogFilterPresets';

describe('parseFilterPreset', () => {
  it('should parse "overdue" as a valid preset', () => {
    expect(parseFilterPreset('overdue')).toBe('overdue');
  });

  it('should parse "urgent" as a valid preset', () => {
    expect(parseFilterPreset('urgent')).toBe('urgent');
  });

  it('should parse "mine" as a valid preset', () => {
    expect(parseFilterPreset('mine')).toBe('mine');
  });

  it('should parse "callback" as a valid preset', () => {
    expect(parseFilterPreset('callback')).toBe('callback');
  });

  it('should parse "open" as a valid preset', () => {
    expect(parseFilterPreset('open')).toBe('open');
  });

  it('should return null for unknown value', () => {
    expect(parseFilterPreset('unknown')).toBeNull();
  });

  it('should return null for null input', () => {
    expect(parseFilterPreset(null)).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(parseFilterPreset('')).toBeNull();
  });

  it('should be case-insensitive', () => {
    expect(parseFilterPreset('OVERDUE')).toBe('overdue');
    expect(parseFilterPreset('Urgent')).toBe('urgent');
  });

  it('should trim whitespace', () => {
    expect(parseFilterPreset('  mine  ')).toBe('mine');
  });
});

describe('getPresetConfig', () => {
  it('should return callback_pending tab for overdue preset', () => {
    const config = getPresetConfig('overdue');
    expect(config.tab).toBe('callback_pending');
    expect(config.label).toBe('期限超過');
  });

  it('should return all tab for urgent preset', () => {
    const config = getPresetConfig('urgent');
    expect(config.tab).toBe('all');
    expect(config.label).toBe('至急');
  });

  it('should return all tab for mine preset', () => {
    const config = getPresetConfig('mine');
    expect(config.tab).toBe('all');
    expect(config.label).toBe('自分宛');
  });

  it('should return new tab for open preset', () => {
    const config = getPresetConfig('open');
    expect(config.tab).toBe('new');
    expect(config.label).toBe('未対応');
  });
});

describe('buildCallLogFilterUrl', () => {
  it('should generate correct URL for overdue', () => {
    expect(buildCallLogFilterUrl('overdue')).toBe('/call-logs?filter=overdue');
  });

  it('should generate correct URL for mine', () => {
    expect(buildCallLogFilterUrl('mine')).toBe('/call-logs?filter=mine');
  });
});

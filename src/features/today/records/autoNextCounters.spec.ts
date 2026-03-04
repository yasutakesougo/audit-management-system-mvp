import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
    getAutoNextCounters,
    recordAutoNextComplete,
    recordAutoNextSave,
    resetAutoNextCounters,
} from './autoNextCounters';

describe('autoNextCounters', () => {
  beforeEach(() => {
    resetAutoNextCounters();
  });

  afterEach(() => {
    resetAutoNextCounters();
  });

  it('starts with zero counters', () => {
    const c = getAutoNextCounters();
    expect(c.totalSaves).toBe(0);
    expect(c.sessionSaves).toBe(0);
    expect(c.completeCount).toBe(0);
    expect(c.lastUsed).toBeNull();
  });

  it('increments save counters on recordAutoNextSave', () => {
    recordAutoNextSave();
    recordAutoNextSave();

    const c = getAutoNextCounters();
    expect(c.totalSaves).toBe(2);
    expect(c.sessionSaves).toBe(2);
    expect(c.lastUsed).toBeTruthy();
  });

  it('increments complete count and resets session saves', () => {
    recordAutoNextSave();
    recordAutoNextSave();
    recordAutoNextSave();
    recordAutoNextComplete();

    const c = getAutoNextCounters();
    expect(c.totalSaves).toBe(3);
    expect(c.sessionSaves).toBe(0); // reset after complete
    expect(c.completeCount).toBe(1);
  });

  it('accumulates across multiple complete cycles', () => {
    // Cycle 1: 3 saves
    recordAutoNextSave();
    recordAutoNextSave();
    recordAutoNextSave();
    recordAutoNextComplete();

    // Cycle 2: 2 saves
    recordAutoNextSave();
    recordAutoNextSave();
    recordAutoNextComplete();

    const c = getAutoNextCounters();
    expect(c.totalSaves).toBe(5);
    expect(c.sessionSaves).toBe(0);
    expect(c.completeCount).toBe(2);
  });

  it('resetAutoNextCounters clears all values', () => {
    recordAutoNextSave();
    recordAutoNextComplete();
    resetAutoNextCounters();

    const c = getAutoNextCounters();
    expect(c.totalSaves).toBe(0);
    expect(c.sessionSaves).toBe(0);
    expect(c.completeCount).toBe(0);
    expect(c.lastUsed).toBeNull();
  });

  it('does not crash when localStorage throws', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('QuotaExceeded');
    };

    // Should not throw
    expect(() => recordAutoNextSave()).not.toThrow();
    expect(() => recordAutoNextComplete()).not.toThrow();

    Storage.prototype.setItem = original;
  });
});

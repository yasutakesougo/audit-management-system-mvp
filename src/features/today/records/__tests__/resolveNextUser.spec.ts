import { describe, expect, it } from 'vitest';
import { resolveNextUser } from '../resolveNextUser';

describe('resolveNextUser', () => {
  it('returns the next user when current user is in the middle of the queue', () => {
    const result = resolveNextUser('U002', ['U001', 'U002', 'U003']);
    expect(result).toBe('U003');
  });

  it('returns the next user when current user is first in the queue', () => {
    const result = resolveNextUser('U001', ['U001', 'U002', 'U003']);
    expect(result).toBe('U002');
  });

  it('returns undefined when current user is the last in the queue (end-of-queue)', () => {
    const result = resolveNextUser('U003', ['U001', 'U002', 'U003']);
    expect(result).toBeUndefined();
  });

  it('returns undefined when pending list is empty', () => {
    const result = resolveNextUser('U001', []);
    expect(result).toBeUndefined();
  });

  it('returns undefined when currentUserId is null and pending list is empty', () => {
    const result = resolveNextUser(null, []);
    expect(result).toBeUndefined();
  });

  it('returns first pending user when currentUserId is null', () => {
    const result = resolveNextUser(null, ['U005', 'U006']);
    expect(result).toBe('U005');
  });

  it('fail-safes to first pending user when current user is NOT in the list (concurrent edit)', () => {
    const result = resolveNextUser('U999', ['U001', 'U002']);
    expect(result).toBe('U001');
  });

  it('returns undefined when only one user and it is the current user', () => {
    const result = resolveNextUser('U001', ['U001']);
    expect(result).toBeUndefined();
  });

  it('handles single pending user when current user is not in list', () => {
    const result = resolveNextUser('U999', ['U001']);
    expect(result).toBe('U001');
  });
});

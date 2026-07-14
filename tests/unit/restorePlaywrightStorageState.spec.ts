import { describe, expect, it } from 'vitest';
import { decodeStorageState } from '../../scripts/ci/restore-playwright-storage-state.mjs';

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64');

describe('decodeStorageState', () => {
  it('rejects an empty secret', () => {
    expect(() => decodeStorageState('')).toThrow('PW_STORAGE_STATE_B64 is empty');
  });

  it('rejects invalid base64 or JSON', () => {
    expect(() => decodeStorageState('not-valid-storage-state')).toThrow('not valid base64-encoded JSON');
  });

  it('rejects storage state without cookies', () => {
    expect(() => decodeStorageState(encode({ cookies: [], origins: [] }))).toThrow('has no cookies');
  });

  it('accepts storage state with cookies', () => {
    const state = { cookies: [{ name: 'FedAuth', value: 'redacted' }], origins: [] };
    expect(decodeStorageState(encode(state))).toEqual(state);
  });
});

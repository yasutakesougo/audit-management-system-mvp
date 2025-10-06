import { describe, test, expect } from 'vitest';

/**
 * Minimal regression test to keep legacy import paths working for vitest's include globs.
 * Real coverage for UsersPanel lives in the smoke and accessibility suites.
 */

describe('UsersPanel legacy placeholder', () => {
	test('provides a sanity assertion for tooling compatibility', () => {
		expect(true).toBe(true);
	});
});

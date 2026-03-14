/**
 * Tests for navigation diagnostics pathUtils
 *
 * Covers: normalizePath, normalizeRouterPath, isDynamicPattern, matchDynamic
 */
import { describe, expect, it } from 'vitest';
import {
  isDynamicPattern,
  matchDynamic,
  normalizePath,
  normalizeRouterPath,
} from '@/app/navigation/diagnostics/pathUtils';

// ─────────────────────────────────────────────────────────────────────────────
// normalizePath
// ─────────────────────────────────────────────────────────────────────────────
describe('normalizePath', () => {
  it('strips query strings', () => {
    expect(normalizePath('/meeting-minutes/new?category=朝会')).toBe('/meeting-minutes/new');
  });

  it('strips hash fragments', () => {
    expect(normalizePath('/page#section')).toBe('/page');
  });

  it('strips trailing slashes', () => {
    expect(normalizePath('/dashboard/')).toBe('/dashboard');
  });

  it('returns / for root with trailing slash', () => {
    expect(normalizePath('/')).toBe('/');
  });

  it('returns empty string for empty input', () => {
    expect(normalizePath('')).toBe('');
  });

  it('handles combined query + hash + trailing slash', () => {
    expect(normalizePath('/foo/?bar=1#baz')).toBe('/foo');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// normalizeRouterPath
// ─────────────────────────────────────────────────────────────────────────────
describe('normalizeRouterPath', () => {
  it('prefixes / for relative paths', () => {
    expect(normalizeRouterPath('dashboard')).toBe('/dashboard');
  });

  it('leaves absolute paths unchanged', () => {
    expect(normalizeRouterPath('/dashboard')).toBe('/dashboard');
  });

  it('returns / for empty input', () => {
    expect(normalizeRouterPath('')).toBe('/');
  });

  it('handles paths with dynamic segments', () => {
    expect(normalizeRouterPath('users/:userId')).toBe('/users/:userId');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isDynamicPattern
// ─────────────────────────────────────────────────────────────────────────────
describe('isDynamicPattern', () => {
  it('returns true for paths with dynamic segments', () => {
    expect(isDynamicPattern('/users/:userId')).toBe(true);
  });

  it('returns true for optional dynamic segments', () => {
    expect(isDynamicPattern('/admin/individual-support/:userCode?')).toBe(true);
  });

  it('returns false for static paths', () => {
    expect(isDynamicPattern('/dashboard')).toBe(false);
  });

  it('returns false for wildcard-only paths', () => {
    expect(isDynamicPattern('/schedule/*')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// matchDynamic
// ─────────────────────────────────────────────────────────────────────────────
describe('matchDynamic', () => {
  it('matches simple dynamic segments', () => {
    expect(matchDynamic('/users/123', '/users/:id')).toBe(true);
  });

  it('matches multi-segment dynamic routes', () => {
    expect(matchDynamic('/meeting-minutes/abc/edit', '/meeting-minutes/:id/edit')).toBe(true);
  });

  it('rejects mismatching static segments', () => {
    expect(matchDynamic('/admin/dashboard', '/users/:id')).toBe(false);
  });

  it('rejects paths with more segments than the pattern', () => {
    expect(matchDynamic('/users/123/extra', '/users/:id')).toBe(false);
  });

  it('rejects paths with fewer segments (non-optional)', () => {
    expect(matchDynamic('/users', '/users/:id')).toBe(false);
  });

  // Optional params
  it('matches optional params when present', () => {
    expect(matchDynamic('/admin/individual-support/U001', '/admin/individual-support/:userCode?')).toBe(true);
  });

  it('matches optional params when omitted', () => {
    expect(matchDynamic('/admin/individual-support', '/admin/individual-support/:userCode?')).toBe(true);
  });

  // Wildcard
  it('matches wildcard routes', () => {
    expect(matchDynamic('/schedule/day/2026-03-14', '/schedule/*')).toBe(true);
  });

  it('matches wildcard for single extra segment', () => {
    expect(matchDynamic('/schedule/week', '/schedule/*')).toBe(true);
  });

  // Edge case: concrete value for dynamic param
  it('matches nav href with concrete value against dynamic route', () => {
    expect(matchDynamic('/support-planning-sheet/new', '/support-planning-sheet/:planningSheetId')).toBe(true);
  });
});

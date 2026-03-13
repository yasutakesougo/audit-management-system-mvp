/**
 * RBAC Defense Layer Tests
 *
 * Exercises the 3-layer defence: roles ➔ isNavVisible ➔ canAccess
 * These tests run purely as unit tests (no hook / no React render).
 *
 * @see docs/operations/rbac-operations-guide.md
 */

import { describe, expect, it } from 'vitest';
import { canAccess, type Role } from '../roles';
import { isNavVisible } from '@/app/config/navigationConfig.helpers';
import type { NavItem } from '@/app/config/navigationConfig.types';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
const makeNavItem = (overrides: Partial<NavItem> = {}): NavItem => ({
  label: 'Test Item',
  to: '/test',
  isActive: () => false,
  ...overrides,
});

describe('RBAC Defense Layer', () => {
  // -----------------------------------------------------------------------
  // Layer 0: role hierarchy
  // -----------------------------------------------------------------------
  describe('canAccess – role hierarchy invariants', () => {
    it('admin can access all three levels', () => {
      expect(canAccess('admin', 'admin')).toBe(true);
      expect(canAccess('admin', 'reception')).toBe(true);
      expect(canAccess('admin', 'viewer')).toBe(true);
    });

    it('reception cannot access admin, but can access self and viewer', () => {
      expect(canAccess('reception', 'admin')).toBe(false);
      expect(canAccess('reception', 'reception')).toBe(true);
      expect(canAccess('reception', 'viewer')).toBe(true);
    });

    it('viewer cannot access admin or reception', () => {
      expect(canAccess('viewer', 'admin')).toBe(false);
      expect(canAccess('viewer', 'reception')).toBe(false);
      expect(canAccess('viewer', 'viewer')).toBe(true);
    });

    it('hierarchy is strictly transitive (admin > reception > viewer)', () => {
      const roles: Role[] = ['viewer', 'reception', 'admin'];
      for (let i = 0; i < roles.length; i++) {
        for (let j = 0; j < roles.length; j++) {
          expect(canAccess(roles[i], roles[j])).toBe(i >= j);
        }
      }
    });
  });

  // -----------------------------------------------------------------------
  // Layer 1: navigation visibility
  // -----------------------------------------------------------------------
  describe('isNavVisible – audience filtering', () => {
    it('audience "all" is visible to every navAudience', () => {
      const item = makeNavItem({ audience: 'all' });
      expect(isNavVisible(item, 'all')).toBe(true);
      expect(isNavVisible(item, 'staff')).toBe(true);
      expect(isNavVisible(item, 'admin')).toBe(true);
    });

    it('audience "admin" is hidden from staff / all', () => {
      const item = makeNavItem({ audience: 'admin' });
      expect(isNavVisible(item, 'admin')).toBe(true);
      expect(isNavVisible(item, 'staff')).toBe(false);
      expect(isNavVisible(item, 'all')).toBe(false);
    });

    it('audience "staff" is hidden from "all" but visible to admin', () => {
      const item = makeNavItem({ audience: 'staff' });
      expect(isNavVisible(item, 'staff')).toBe(true);
      expect(isNavVisible(item, 'admin')).toBe(true); // admin sees everything
      expect(isNavVisible(item, 'all')).toBe(false);
    });

    it('audience array ["reception", "admin"] is visible to admin', () => {
      const item = makeNavItem({ audience: ['reception', 'admin'] });
      // isNavVisible handles Array.isArray – verify both included audiences
      expect(isNavVisible(item, 'admin')).toBe(true);
    });

    it('item with no audience defaults to "all"', () => {
      const item = makeNavItem({ audience: undefined });
      expect(isNavVisible(item, 'staff')).toBe(true);
      expect(isNavVisible(item, 'admin')).toBe(true);
      expect(isNavVisible(item, 'all')).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Composite: admin-only routes are doubly protected
  // -----------------------------------------------------------------------
  describe('composite: admin-only routes are doubly protected', () => {
    const adminOnlyItem = makeNavItem({
      label: '自己点検',
      to: '/checklist',
      audience: 'admin',
    });

    it('viewer cannot see admin nav AND cannot access admin route', () => {
      expect(isNavVisible(adminOnlyItem, 'staff')).toBe(false);
      expect(canAccess('viewer', 'admin')).toBe(false);
    });

    it('reception cannot see admin nav AND cannot access admin route', () => {
      expect(isNavVisible(adminOnlyItem, 'staff')).toBe(false);
      expect(canAccess('reception', 'admin')).toBe(false);
    });

    it('admin can see admin nav AND can access admin route', () => {
      expect(isNavVisible(adminOnlyItem, 'admin')).toBe(true);
      expect(canAccess('admin', 'admin')).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Fail-closed: unknown role value cannot escalate (type-level guard)
  // -----------------------------------------------------------------------
  describe('fail-closed safety', () => {
    it('invalid role string defaults to denied (canAccess returns false)', () => {
      // TypeScript prevents this at compile time, but we verify runtime safety
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(canAccess('unknown' as any, 'admin')).toBe(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(canAccess('unknown' as any, 'reception')).toBe(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(canAccess('unknown' as any, 'viewer')).toBe(false);
    });
  });
});

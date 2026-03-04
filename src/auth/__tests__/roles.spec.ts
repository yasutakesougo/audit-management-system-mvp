import { describe, expect, it } from 'vitest';
import { canAccess, type Role } from '../roles';

describe('canAccess', () => {
  const cases: Array<[Role, Role, boolean]> = [
    // [user role, required role, expected]
    ['admin', 'admin', true],
    ['admin', 'reception', true],
    ['admin', 'viewer', true],
    ['reception', 'admin', false],
    ['reception', 'reception', true],
    ['reception', 'viewer', true],
    ['viewer', 'admin', false],
    ['viewer', 'reception', false],
    ['viewer', 'viewer', true],
  ];

  it.each(cases)(
    'canAccess(%s, %s) should be %s',
    (role, required, expected) => {
      expect(canAccess(role, required)).toBe(expected);
    },
  );

  it('should enforce strict hierarchy: admin > reception > viewer', () => {
    expect(canAccess('admin', 'viewer')).toBe(true);
    expect(canAccess('viewer', 'admin')).toBe(false);
  });
});

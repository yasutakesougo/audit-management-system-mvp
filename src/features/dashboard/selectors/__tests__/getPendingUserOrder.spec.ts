import { getPendingUserOrder } from '../getPendingUserOrder';

describe('getPendingUserOrder', () => {
  const users = [
    { UserID: 'U-001' },
    { UserID: 'U-002' },
    { UserID: 'U-003' },
    { UserID: 'U-004' },
  ];

  it('sorts by userId policy', () => {
    const pendingUserIds = ['U-003', 'U-001', 'U-002'];
    const result = getPendingUserOrder({
      users,
      pendingUserIds,
      policy: 'userId'
    });
    expect(result).toEqual(['U-001', 'U-002', 'U-003']);
  });

  it('sorts by attendanceToday policy, preserving attendance order', () => {
    const pendingUserIds = ['U-003', 'U-001', 'U-002'];
    const attendanceOrderUserIds = ['U-002', 'U-003', 'U-001'];

    // Test that it follows attendanceOrderUserIds exactly
    const result = getPendingUserOrder({
      users,
      pendingUserIds,
      policy: 'attendanceToday',
      attendanceOrderUserIds
    });

    expect(result).toEqual(['U-002', 'U-003', 'U-001']);
  });

  it('sorts by attendanceToday policy, placing missing attendance users at the end sorted by ID', () => {
    const pendingUserIds = ['U-003', 'U-001', 'U-002', 'U-004'];
    const attendanceOrderUserIds = ['U-003', 'U-001']; // U-002 and U-004 missing from attendance

    const result = getPendingUserOrder({
      users,
      pendingUserIds,
      policy: 'attendanceToday',
      attendanceOrderUserIds
    });

    expect(result).toEqual(['U-003', 'U-001', 'U-002', 'U-004']);
  });

  it('falls back to userId sort when attendanceToday policy is used but no attendance order is provided', () => {
    const pendingUserIds = ['U-003', 'U-001', 'U-002'];
    const result = getPendingUserOrder({
      users,
      pendingUserIds,
      policy: 'attendanceToday'
    });

    expect(result).toEqual(['U-001', 'U-002', 'U-003']);
  });

  // =========================================================================
  // #630: UserID format normalization tests
  // =========================================================================

  it('matches UserIDs across format variants (U-001 vs U001)', () => {
    // pendingUserIds use hyphenated format (from user master)
    const pendingUserIds = ['U-003', 'U-001', 'U-002'];
    // attendanceOrderUserIds use non-hyphenated format (from attendance system)
    const attendanceOrderUserIds = ['U002', 'U003', 'U001'];

    const result = getPendingUserOrder({
      users,
      pendingUserIds,
      policy: 'attendanceToday',
      attendanceOrderUserIds
    });

    // Should match despite format difference: attendance order preserved, original IDs returned
    expect(result).toEqual(['U-002', 'U-003', 'U-001']);
  });

  it('handles mixed format variants in attendance order (some hyphenated, some not)', () => {
    const pendingUserIds = ['U-003', 'U-001', 'U-002', 'U-004'];
    const attendanceOrderUserIds = ['U003', 'U-001']; // Mixed formats

    const result = getPendingUserOrder({
      users,
      pendingUserIds,
      policy: 'attendanceToday',
      attendanceOrderUserIds
    });

    // U-003 and U-001 matched, U-002 and U-004 as sorted leftovers
    expect(result).toEqual(['U-003', 'U-001', 'U-002', 'U-004']);
  });

  it('handles lowercase format variants', () => {
    const pendingUserIds = ['U-001', 'U-002'];
    const attendanceOrderUserIds = ['u002', 'u001']; // Lowercase

    const result = getPendingUserOrder({
      users,
      pendingUserIds,
      policy: 'attendanceToday',
      attendanceOrderUserIds
    });

    expect(result).toEqual(['U-002', 'U-001']);
  });

  it('returns original pending IDs (not normalized) in the result', () => {
    const pendingUserIds = ['U-001', 'U-002'];
    const attendanceOrderUserIds = ['U001'];

    const result = getPendingUserOrder({
      users,
      pendingUserIds,
      policy: 'attendanceToday',
      attendanceOrderUserIds
    });

    // Should return "U-001" (original), not "U001" (normalized)
    expect(result).toEqual(['U-001', 'U-002']);
    expect(result[0]).toBe('U-001');
  });
});

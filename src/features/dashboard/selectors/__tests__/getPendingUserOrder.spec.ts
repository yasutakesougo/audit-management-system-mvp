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
});

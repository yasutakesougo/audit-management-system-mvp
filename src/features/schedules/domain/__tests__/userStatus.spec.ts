/**
 * userStatus.spec.ts — Phase 8-A Step 1: 利用者状態ドメインモデルのテスト
 *
 * Pure function のみのモジュールなので、全関数を網羅的にテストする。
 */
import { describe, expect, it } from 'vitest';

import {
  USER_STATUS_LABELS,
  USER_STATUS_TYPES,
  buildUserStatusKey,
  findExistingUserStatus,
  isUserStatusServiceType,
  shouldReplaceExistingStatus,
  suggestStatusFromHandoffCategory,
  toScheduleDraft,
  toUserStatusRecord,
  type UserStatusRecord,
} from '../userStatus';

// ── Fixtures ──────────────────────────────────────────────────────────────

const makeRecord = (
  overrides?: Partial<UserStatusRecord>,
): UserStatusRecord => ({
  userId: 'user-1',
  userName: '田中太郎',
  date: '2026-03-20',
  statusType: 'absence',
  source: 'today',
  ...overrides,
});

const makeScheduleItem = (
  overrides?: Record<string, unknown>,
) => ({
  id: 'sched-1',
  title: '田中太郎 - 欠席',
  start: '2026-03-20T00:00:00',
  end: '2026-03-20T23:59:59',
  category: 'User' as const,
  serviceType: 'absence',
  userId: 'user-1',
  userName: '田中太郎',
  notes: '体調不良\n[source:today]',
  etag: '1',
  ...overrides,
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// isUserStatusServiceType
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('isUserStatusServiceType', () => {
  it.each(USER_STATUS_TYPES)(
    'returns true for "%s"',
    (type) => {
      expect(isUserStatusServiceType(type)).toBe(true);
    },
  );

  it.each(['normal', 'transport', 'respite', 'shortStay', 'meeting'])(
    'returns false for non-status type "%s"',
    (type) => {
      expect(isUserStatusServiceType(type)).toBe(false);
    },
  );

  it('returns false for null', () => {
    expect(isUserStatusServiceType(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isUserStatusServiceType(undefined)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isUserStatusServiceType('')).toBe(false);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// toUserStatusRecord
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('toUserStatusRecord', () => {
  it('converts a schedule item with absence serviceType', () => {
    const result = toUserStatusRecord(makeScheduleItem());

    expect(result).not.toBeNull();
    expect(result!.userId).toBe('user-1');
    expect(result!.userName).toBe('田中太郎');
    expect(result!.date).toBe('2026-03-20');
    expect(result!.statusType).toBe('absence');
    expect(result!.source).toBe('schedule');
    expect(result!.scheduleId).toBe('sched-1');
  });

  it('converts late serviceType', () => {
    const result = toUserStatusRecord(
      makeScheduleItem({ serviceType: 'late' }),
    );
    expect(result!.statusType).toBe('late');
  });

  it('converts earlyLeave serviceType', () => {
    const result = toUserStatusRecord(
      makeScheduleItem({ serviceType: 'earlyLeave' }),
    );
    expect(result!.statusType).toBe('earlyLeave');
  });

  it('converts preAbsence serviceType', () => {
    const result = toUserStatusRecord(
      makeScheduleItem({ serviceType: 'preAbsence' }),
    );
    expect(result!.statusType).toBe('preAbsence');
  });

  it('returns null for non-status serviceType', () => {
    const result = toUserStatusRecord(
      makeScheduleItem({ serviceType: 'normal' }),
    );
    expect(result).toBeNull();
  });

  it('returns null when serviceType is null', () => {
    const result = toUserStatusRecord(
      makeScheduleItem({ serviceType: null }),
    );
    expect(result).toBeNull();
  });

  it('returns null when userId is missing', () => {
    const result = toUserStatusRecord(
      makeScheduleItem({ userId: undefined }),
    );
    expect(result).toBeNull();
  });

  it('extracts date from ISO datetime start field', () => {
    const result = toUserStatusRecord(
      makeScheduleItem({ start: '2026-04-15T09:30:00' }),
    );
    expect(result!.date).toBe('2026-04-15');
  });

  it('preserves notes as note field', () => {
    const result = toUserStatusRecord(
      makeScheduleItem({ notes: '保護者連絡あり' }),
    );
    expect(result!.note).toBe('保護者連絡あり');
  });

  it('handles missing userName gracefully', () => {
    const result = toUserStatusRecord(
      makeScheduleItem({ userName: undefined }),
    );
    expect(result!.userName).toBe('');
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// toScheduleDraft
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('toScheduleDraft', () => {
  it('creates a schedule draft from absence record', () => {
    const record = makeRecord({ statusType: 'absence' });
    const draft = toScheduleDraft(record);

    expect(draft.title).toBe('田中太郎 - 欠席');
    expect(draft.category).toBe('User');
    expect(draft.serviceType).toBe('absence');
    expect(draft.startLocal).toBe('2026-03-20T00:00:00');
    expect(draft.endLocal).toBe('2026-03-20T23:59:59');
    expect(draft.userId).toBe('user-1');
    expect(draft.userName).toBe('田中太郎');
    expect(draft.status).toBe('Cancelled');
    expect(draft.statusReason).toBe('欠席（todayから登録）');
  });

  it('creates a schedule draft from late record', () => {
    const draft = toScheduleDraft(makeRecord({ statusType: 'late' }));

    expect(draft.title).toBe('田中太郎 - 遅刻');
    expect(draft.serviceType).toBe('late');
    expect(draft.status).toBe('Planned'); // 遅刻は Cancelled ではない
  });

  it('creates a schedule draft from earlyLeave record', () => {
    const draft = toScheduleDraft(makeRecord({ statusType: 'earlyLeave' }));

    expect(draft.title).toBe('田中太郎 - 早退');
    expect(draft.serviceType).toBe('earlyLeave');
    expect(draft.status).toBe('Planned');
  });

  it('creates a schedule draft from preAbsence record', () => {
    const draft = toScheduleDraft(makeRecord({ statusType: 'preAbsence' }));

    expect(draft.title).toBe('田中太郎 - 事前欠席');
    expect(draft.serviceType).toBe('preAbsence');
    expect(draft.status).toBe('Cancelled'); // 事前欠席も Cancelled
  });

  it('includes source in notes', () => {
    const draft = toScheduleDraft(makeRecord({ source: 'handoff' }));
    expect(draft.notes).toContain('[source:handoff]');
  });

  it('includes handoffId in notes when present', () => {
    const draft = toScheduleDraft(makeRecord({ handoffId: 42 }));
    expect(draft.notes).toContain('[handoff:42]');
  });

  it('includes time in notes when present', () => {
    const draft = toScheduleDraft(makeRecord({ time: '10:30' }));
    expect(draft.notes).toContain('[time:10:30]');
  });

  it('includes user note in notes', () => {
    const draft = toScheduleDraft(
      makeRecord({ note: '保護者から電話連絡' }),
    );
    expect(draft.notes).toContain('保護者から電話連絡');
  });

  it('statusReason contains source info', () => {
    const draft = toScheduleDraft(makeRecord({ source: 'handoff' }));
    expect(draft.statusReason).toBe('欠席（handoffから登録）');
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// buildUserStatusKey
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('buildUserStatusKey', () => {
  it('generates a unique key from userId and date', () => {
    expect(buildUserStatusKey('user-1', '2026-03-20')).toBe(
      'user-1::2026-03-20',
    );
  });

  it('generates different keys for different users', () => {
    const key1 = buildUserStatusKey('user-1', '2026-03-20');
    const key2 = buildUserStatusKey('user-2', '2026-03-20');
    expect(key1).not.toBe(key2);
  });

  it('generates different keys for different dates', () => {
    const key1 = buildUserStatusKey('user-1', '2026-03-20');
    const key2 = buildUserStatusKey('user-1', '2026-03-21');
    expect(key1).not.toBe(key2);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// shouldReplaceExistingStatus
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('shouldReplaceExistingStatus', () => {
  it('returns true for same user and same date (same status)', () => {
    const existing = makeRecord({ statusType: 'absence' });
    const incoming = makeRecord({ statusType: 'absence', note: '更新' });
    expect(shouldReplaceExistingStatus(existing, incoming)).toBe(true);
  });

  it('returns true for same user and same date (different status)', () => {
    const existing = makeRecord({ statusType: 'late' });
    const incoming = makeRecord({ statusType: 'absence' });
    expect(shouldReplaceExistingStatus(existing, incoming)).toBe(true);
  });

  it('returns false for different user', () => {
    const existing = makeRecord({ userId: 'user-1' });
    const incoming = makeRecord({ userId: 'user-2' });
    expect(shouldReplaceExistingStatus(existing, incoming)).toBe(false);
  });

  it('returns false for different date', () => {
    const existing = makeRecord({ date: '2026-03-20' });
    const incoming = makeRecord({ date: '2026-03-21' });
    expect(shouldReplaceExistingStatus(existing, incoming)).toBe(false);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// findExistingUserStatus
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('findExistingUserStatus', () => {
  const items = [
    makeScheduleItem({ id: 'sched-1', userId: 'user-1', serviceType: 'absence' }),
    makeScheduleItem({ id: 'sched-2', userId: 'user-2', serviceType: 'late', start: '2026-03-20T00:00:00' }),
    makeScheduleItem({ id: 'sched-3', userId: 'user-1', serviceType: 'normal' }), // not a status item
    makeScheduleItem({ id: 'sched-4', userId: 'user-1', serviceType: 'absence', start: '2026-03-21T00:00:00' }),
  ];

  it('finds existing status for matching user and date', () => {
    const result = findExistingUserStatus(items, 'user-1', '2026-03-20');
    expect(result).toBeDefined();
    expect(result!.id).toBe('sched-1');
  });

  it('returns undefined when no status exists for user on date', () => {
    const result = findExistingUserStatus(items, 'user-3', '2026-03-20');
    expect(result).toBeUndefined();
  });

  it('ignores non-status serviceTypes', () => {
    const normalOnly = [
      makeScheduleItem({ userId: 'user-1', serviceType: 'normal' }),
    ];
    const result = findExistingUserStatus(normalOnly, 'user-1', '2026-03-20');
    expect(result).toBeUndefined();
  });

  it('matches by date prefix', () => {
    const result = findExistingUserStatus(items, 'user-1', '2026-03-21');
    expect(result).toBeDefined();
    expect(result!.id).toBe('sched-4');
  });

  it('finds late status for different user', () => {
    const result = findExistingUserStatus(items, 'user-2', '2026-03-20');
    expect(result).toBeDefined();
    expect(result!.id).toBe('sched-2');
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// suggestStatusFromHandoffCategory
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('suggestStatusFromHandoffCategory', () => {
  it('suggests absence for 体調 category', () => {
    expect(suggestStatusFromHandoffCategory('体調')).toBe('absence');
  });

  it('suggests absence for 家族連絡 category', () => {
    expect(suggestStatusFromHandoffCategory('家族連絡')).toBe('absence');
  });

  it('defaults to late for other categories', () => {
    expect(suggestStatusFromHandoffCategory('行動面')).toBe('late');
    expect(suggestStatusFromHandoffCategory('支援の工夫')).toBe('late');
    expect(suggestStatusFromHandoffCategory('その他')).toBe('late');
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// USER_STATUS_LABELS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('USER_STATUS_LABELS', () => {
  it('has labels for all status types', () => {
    for (const type of USER_STATUS_TYPES) {
      expect(USER_STATUS_LABELS[type]).toBeDefined();
      expect(USER_STATUS_LABELS[type].length).toBeGreaterThan(0);
    }
  });

  it('has expected Japanese labels', () => {
    expect(USER_STATUS_LABELS.absence).toBe('欠席');
    expect(USER_STATUS_LABELS.late).toBe('遅刻');
    expect(USER_STATUS_LABELS.earlyLeave).toBe('早退');
    expect(USER_STATUS_LABELS.preAbsence).toBe('事前欠席');
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Round-trip: UserStatusRecord → Schedule → UserStatusRecord
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('round-trip conversion', () => {
  it.each(USER_STATUS_TYPES)(
    'preserves essential fields through convert cycle for "%s"',
    (statusType) => {
      const original = makeRecord({ statusType });
      const draft = toScheduleDraft(original);

      // Simulate what comes back from the API
      const apiResult = {
        id: 'new-sched-1',
        userId: draft.userId!,
        userName: draft.userName!,
        start: draft.startLocal!,
        serviceType: draft.serviceType!,
        notes: draft.notes!,
      };

      const recovered = toUserStatusRecord(apiResult);
      expect(recovered).not.toBeNull();
      expect(recovered!.userId).toBe(original.userId);
      expect(recovered!.date).toBe(original.date);
      expect(recovered!.statusType).toBe(original.statusType);
    },
  );
});

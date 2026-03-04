import { describe, expect, it, vi } from 'vitest';
import {
    fromSpHandoffItem,
    toSpHandoffCreatePayload,
    toSpHandoffUpdatePayload,
} from '../handoffMappers';
import type {
    NewHandoffInput,
    SpHandoffItem,
} from '../handoffTypes';

// ────────────────────────────────────────────────────────────
// Fixtures
// ────────────────────────────────────────────────────────────

/** Complete SP item – every field populated */
const fullSpItem: SpHandoffItem = {
  Id: 101,
  Title: '夜間帯の転倒リスク確認',
  Message: '<p>22時頃、Aさんがトイレに向かう際にふらつきあり。</p>',
  UserCode: 'U001',
  UserDisplayName: '佐藤 一郎',
  Category: '事故・ヒヤリ',
  Severity: '要注意',
  Status: '対応中',
  TimeBand: '夕方',
  MeetingSessionKey: '2026-03-03_evening',
  SourceType: 'daily',
  SourceId: 55,
  SourceUrl: '/daily/55',
  SourceKey: 'daily-55',
  SourceLabel: '日報 #55',
  CreatedAt: '2026-03-03T22:10:00Z',
  CreatedByName: '山田 花子',
  IsDraft: false,
  CarryOverDate: '2026-03-04',
  Created: '2026-03-03T22:10:00Z',
  Modified: '2026-03-03T23:00:00Z',
  AuthorId: 7,
  EditorId: 7,
};

const newInput: NewHandoffInput = {
  userCode: 'U002',
  userDisplayName: '鈴木 次郎',
  category: '体調',
  severity: '通常',
  timeBand: '午前',
  message: '朝の体温は36.5℃で平常。食欲良好。',
  title: 'Bさん体温報告',
  meetingSessionKey: '2026-03-04_morning',
};

// ────────────────────────────────────────────────────────────
// fromSpHandoffItem
// ────────────────────────────────────────────────────────────

describe('fromSpHandoffItem', () => {
  it('maps a complete SP item to HandoffRecord with correct field names', () => {
    const record = fromSpHandoffItem(fullSpItem);

    expect(record).toEqual({
      id: 101,
      title: '夜間帯の転倒リスク確認',
      message: '<p>22時頃、Aさんがトイレに向かう際にふらつきあり。</p>',
      userCode: 'U001',
      userDisplayName: '佐藤 一郎',
      category: '事故・ヒヤリ',
      severity: '要注意',
      status: '対応中',
      timeBand: '夕方',
      meetingSessionKey: '2026-03-03_evening',
      sourceType: 'daily',
      sourceId: 55,
      sourceUrl: '/daily/55',
      sourceKey: 'daily-55',
      sourceLabel: '日報 #55',
      createdAt: '2026-03-03T22:10:00Z',
      createdByName: '山田 花子',
      isDraft: false,
      carryOverDate: '2026-03-04',
    });
  });

  // ── Date fallback chain ─────────────────────────────────

  it('prefers CreatedAt over Created for createdAt', () => {
    const item: SpHandoffItem = {
      ...fullSpItem,
      CreatedAt: '2026-01-01T00:00:00Z',
      Created: '2026-12-31T23:59:59Z',
    };
    expect(fromSpHandoffItem(item).createdAt).toBe('2026-01-01T00:00:00Z');
  });

  it('falls back to Created when CreatedAt is undefined', () => {
    const item: SpHandoffItem = {
      ...fullSpItem,
      CreatedAt: undefined,
      Created: '2026-06-15T10:00:00Z',
    };
    expect(fromSpHandoffItem(item).createdAt).toBe('2026-06-15T10:00:00Z');
  });

  it('falls back to now() when both CreatedAt and Created are missing', () => {
    const fakeNow = '2026-03-04T12:00:00.000Z';
    vi.useFakeTimers();
    vi.setSystemTime(new Date(fakeNow));

    const item: SpHandoffItem = {
      ...fullSpItem,
      CreatedAt: undefined,
      Created: undefined,
    };
    expect(fromSpHandoffItem(item).createdAt).toBe(fakeNow);

    vi.useRealTimers();
  });

  // ── Status fallback ─────────────────────────────────────

  it.each([
    '未対応', '対応中', '対応済', '確認済', '明日へ持越', '完了',
  ] as const)('preserves valid status: %s', (validStatus) => {
    const item: SpHandoffItem = { ...fullSpItem, Status: validStatus };
    expect(fromSpHandoffItem(item).status).toBe(validStatus);
  });

  it('falls back to 未対応 for unknown Status values (forward-compat)', () => {
    const item: SpHandoffItem = { ...fullSpItem, Status: '新規ステータスv99' };
    expect(fromSpHandoffItem(item).status).toBe('未対応');
  });

  it('falls back to 未対応 for empty string Status', () => {
    const item: SpHandoffItem = { ...fullSpItem, Status: '' };
    expect(fromSpHandoffItem(item).status).toBe('未対応');
  });

  // ── Optional fields ─────────────────────────────────────

  it('maps undefined optional fields as undefined (no crash)', () => {
    const minimalItem: SpHandoffItem = {
      Id: 1,
      Title: 'テスト',
      Message: '本文',
      UserCode: 'U999',
      UserDisplayName: 'テストユーザー',
      Category: 'その他',
      Severity: '通常',
      Status: '未対応',
      TimeBand: '朝',
      CreatedByName: 'システム',
      IsDraft: false,
    };
    const record = fromSpHandoffItem(minimalItem);

    expect(record.meetingSessionKey).toBeUndefined();
    expect(record.sourceType).toBeUndefined();
    expect(record.sourceId).toBeUndefined();
    expect(record.sourceUrl).toBeUndefined();
    expect(record.sourceKey).toBeUndefined();
    expect(record.sourceLabel).toBeUndefined();
    expect(record.carryOverDate).toBeUndefined();
  });

  it('preserves numeric id without coercion', () => {
    expect(typeof fromSpHandoffItem(fullSpItem).id).toBe('number');
  });
});

// ────────────────────────────────────────────────────────────
// toSpHandoffCreatePayload
// ────────────────────────────────────────────────────────────

describe('toSpHandoffCreatePayload', () => {
  it('maps NewHandoffInput to PascalCase SP payload', () => {
    const payload = toSpHandoffCreatePayload({
      ...newInput,
      createdAt: '2026-03-04T09:00:00Z',
      createdByName: '鈴木 次郎',
    });

    expect(payload).toEqual({
      Title: 'Bさん体温報告',
      Message: '朝の体温は36.5℃で平常。食欲良好。',
      UserCode: 'U002',
      UserDisplayName: '鈴木 次郎',
      Category: '体調',
      Severity: '通常',
      Status: '未対応', // always 未対応 on create
      TimeBand: '午前',
      MeetingSessionKey: '2026-03-04_morning',
      SourceType: undefined,
      SourceId: undefined,
      SourceUrl: undefined,
      SourceKey: undefined,
      SourceLabel: undefined,
      CreatedAt: '2026-03-04T09:00:00Z',
      CreatedByName: '鈴木 次郎',
      IsDraft: false,
    });
  });

  it('always sets Status to 未対応 regardless of input', () => {
    const payload = toSpHandoffCreatePayload(newInput);
    expect(payload.Status).toBe('未対応');
  });

  it('omits server-generated fields: Id, Created, Modified, AuthorId, EditorId', () => {
    const payload = toSpHandoffCreatePayload(newInput);

    expect(payload).not.toHaveProperty('Id');
    expect(payload).not.toHaveProperty('Created');
    expect(payload).not.toHaveProperty('Modified');
    expect(payload).not.toHaveProperty('AuthorId');
    expect(payload).not.toHaveProperty('EditorId');
  });

  it('auto-generates Title from message when title is omitted', () => {
    const inputWithoutTitle: NewHandoffInput = {
      ...newInput,
      title: undefined,
    };
    const payload = toSpHandoffCreatePayload(inputWithoutTitle);

    // generateTitleFromMessage('朝の体温は36.5℃で平常。食欲良好。')
    // → short enough (< 50 chars) → returns the trimmed message itself
    expect(payload.Title).toBe('朝の体温は36.5℃で平常。食欲良好。');
  });

  it('defaults CreatedByName to システム利用者 when omitted', () => {
    const payload = toSpHandoffCreatePayload(newInput);
    expect(payload.CreatedByName).toBe('システム利用者');
  });

  it('defaults IsDraft to false when omitted', () => {
    const payload = toSpHandoffCreatePayload(newInput);
    expect(payload.IsDraft).toBe(false);
  });

  it('falls back to now() for CreatedAt when omitted', () => {
    const fakeNow = '2026-03-04T12:00:00.000Z';
    vi.useFakeTimers();
    vi.setSystemTime(new Date(fakeNow));

    const payload = toSpHandoffCreatePayload(newInput);
    expect(payload.CreatedAt).toBe(fakeNow);

    vi.useRealTimers();
  });

  // ── Round-trip ──────────────────────────────────────────

  it('round-trips: create payload → simulated SP response → fromSpHandoffItem', () => {
    const payload = toSpHandoffCreatePayload({
      ...newInput,
      createdAt: '2026-03-04T09:00:00Z',
      createdByName: '鈴木 次郎',
    });

    // Simulate what SharePoint returns after insertion
    const spResponse: SpHandoffItem = {
      ...payload,
      Id: 200,
      Created: '2026-03-04T09:00:01Z',
      Modified: '2026-03-04T09:00:01Z',
      AuthorId: 3,
      EditorId: 3,
    };

    const record = fromSpHandoffItem(spResponse);

    expect(record.id).toBe(200);
    expect(record.userCode).toBe(newInput.userCode);
    expect(record.category).toBe(newInput.category);
    expect(record.status).toBe('未対応');
    expect(record.createdByName).toBe('鈴木 次郎');
  });
});

// ────────────────────────────────────────────────────────────
// toSpHandoffUpdatePayload
// ────────────────────────────────────────────────────────────

describe('toSpHandoffUpdatePayload', () => {
  it('maps single field update: status', () => {
    const payload = toSpHandoffUpdatePayload({ status: '対応済' });
    expect(payload).toEqual({ Status: '対応済' });
  });

  it('maps single field update: severity', () => {
    const payload = toSpHandoffUpdatePayload({ severity: '重要' });
    expect(payload).toEqual({ Severity: '重要' });
  });

  it('maps single field update: category', () => {
    const payload = toSpHandoffUpdatePayload({ category: '家族連絡' });
    expect(payload).toEqual({ Category: '家族連絡' });
  });

  it('maps single field update: message', () => {
    const payload = toSpHandoffUpdatePayload({ message: '更新内容' });
    expect(payload).toEqual({ Message: '更新内容' });
  });

  it('maps single field update: title', () => {
    const payload = toSpHandoffUpdatePayload({ title: '新タイトル' });
    expect(payload).toEqual({ Title: '新タイトル' });
  });

  it('maps single field update: carryOverDate', () => {
    const payload = toSpHandoffUpdatePayload({ carryOverDate: '2026-03-05' });
    expect(payload).toEqual({ CarryOverDate: '2026-03-05' });
  });

  it('maps multiple fields at once', () => {
    const payload = toSpHandoffUpdatePayload({
      status: '確認済',
      severity: '要注意',
      carryOverDate: '2026-03-05',
    });
    expect(payload).toEqual({
      Status: '確認済',
      Severity: '要注意',
      CarryOverDate: '2026-03-05',
    });
  });

  it('returns empty object when no fields provided', () => {
    const payload = toSpHandoffUpdatePayload({});
    expect(payload).toEqual({});
    expect(Object.keys(payload)).toHaveLength(0);
  });

  it('does not include fields not present in the input', () => {
    const payload = toSpHandoffUpdatePayload({ status: '完了' });

    expect(Object.keys(payload)).toEqual(['Status']);
    expect(payload).not.toHaveProperty('Severity');
    expect(payload).not.toHaveProperty('Category');
    expect(payload).not.toHaveProperty('Message');
    expect(payload).not.toHaveProperty('Title');
    expect(payload).not.toHaveProperty('CarryOverDate');
  });

  it('does not leak disallowed fields (id, createdAt, etc.)', () => {
    // Simulate runtime data that might contain extra keys
    const dirtyInput: Record<string, unknown> = {
      status: '対応中',
      id: 999,
      createdAt: '2026-01-01',
    };
    const payload = toSpHandoffUpdatePayload(
      dirtyInput as Partial<Pick<import('../handoffTypes').HandoffRecord, 'status' | 'severity' | 'category' | 'message' | 'title' | 'carryOverDate'>>
    );

    expect(payload).not.toHaveProperty('Id');
    expect(payload).not.toHaveProperty('CreatedAt');
    expect(payload).not.toHaveProperty('Created');
  });
});

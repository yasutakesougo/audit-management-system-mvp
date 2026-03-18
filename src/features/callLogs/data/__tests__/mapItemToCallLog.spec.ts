/**
 * mapItemToCallLog — SharePoint アイテムマッパーテスト
 *
 * 対象:
 *   - mapItemToCallLog  SP 行 → CallLog ドメイン変換
 *
 * 観点:
 *   - 正常系: 全フィールドが揃った場合
 *   - フォールバック: null / undefined / 欠損フィールド
 *   - status / urgency の不正値
 */

import { describe, it, expect } from 'vitest';
import { mapItemToCallLog } from '../mapItemToCallLog';
import { CALL_LOG_FIELDS as F } from '../callLogFieldMap';

// ─── ベースアイテムビルダー ───────────────────────────────────────────────────

function makeSpItem(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    Id: 1,
    Title: 'テスト件名 (田中太郎)',
    [F.receivedAt]: '2026-03-18T09:00:00.000Z',
    [F.callerName]: '田中太郎',
    [F.callerOrg]: 'テスト機関',
    [F.targetStaffName]: '山田スタッフ',
    [F.receivedByName]: '受付者',
    [F.message]: '折返しください',
    [F.needCallback]: true,
    [F.urgency]: 'urgent',
    [F.status]: 'new',
    [F.relatedUserId]: 'U001',
    [F.relatedUserName]: '利用者A',
    [F.callbackDueAt]: '2026-03-18T17:00:00.000Z',
    [F.completedAt]: null,
    [F.created]: '2026-03-18T09:00:00.000Z',
    [F.modified]: '2026-03-18T09:00:00.000Z',
    ...overrides,
  };
}

// ─── 正常系 ─────────────────────────────────────────────────────────────────

describe('mapItemToCallLog — 正常系', () => {
  it('should map all fields correctly from a full SP item', () => {
    const item = makeSpItem();
    const log = mapItemToCallLog(item);

    expect(log.id).toBe('1');
    expect(log.callerName).toBe('田中太郎');
    expect(log.callerOrg).toBe('テスト機関');
    expect(log.targetStaffName).toBe('山田スタッフ');
    expect(log.receivedByName).toBe('受付者');
    expect(log.subject).toBe('テスト件名 (田中太郎)');
    expect(log.message).toBe('折返しください');
    expect(log.needCallback).toBe(true);
    expect(log.urgency).toBe('urgent');
    expect(log.status).toBe('new');
    expect(log.relatedUserId).toBe('U001');
    expect(log.relatedUserName).toBe('利用者A');
    expect(log.callbackDueAt).toBe('2026-03-18T17:00:00.000Z');
    expect(log.completedAt).toBeUndefined();
    expect(log.receivedAt).toBe('2026-03-18T09:00:00.000Z');
    expect(log.createdAt).toBe('2026-03-18T09:00:00.000Z');
    expect(log.updatedAt).toBe('2026-03-18T09:00:00.000Z');
  });

  it('should set needCallback to false when field is false', () => {
    const log = mapItemToCallLog(makeSpItem({ [F.needCallback]: false }));
    expect(log.needCallback).toBe(false);
  });

  it('should handle all valid status values', () => {
    expect(mapItemToCallLog(makeSpItem({ [F.status]: 'new' })).status).toBe('new');
    expect(mapItemToCallLog(makeSpItem({ [F.status]: 'callback_pending' })).status).toBe('callback_pending');
    expect(mapItemToCallLog(makeSpItem({ [F.status]: 'done' })).status).toBe('done');
  });

  it('should handle all valid urgency values', () => {
    expect(mapItemToCallLog(makeSpItem({ [F.urgency]: 'normal' })).urgency).toBe('normal');
    expect(mapItemToCallLog(makeSpItem({ [F.urgency]: 'today' })).urgency).toBe('today');
    expect(mapItemToCallLog(makeSpItem({ [F.urgency]: 'urgent' })).urgency).toBe('urgent');
  });
});

// ─── フォールバック ──────────────────────────────────────────────────────────

describe('mapItemToCallLog — フォールバック', () => {
  it('should use fallback callerName "(不明)" when field is missing', () => {
    const log = mapItemToCallLog(makeSpItem({ [F.callerName]: undefined }));
    expect(log.callerName).toBe('(不明)');
  });

  it('should return undefined callerOrg when field is null', () => {
    const log = mapItemToCallLog(makeSpItem({ [F.callerOrg]: null }));
    expect(log.callerOrg).toBeUndefined();
  });

  it('should return undefined relatedUserId when field is null', () => {
    const log = mapItemToCallLog(makeSpItem({ [F.relatedUserId]: null }));
    expect(log.relatedUserId).toBeUndefined();
  });

  it('should return undefined completedAt when field is null', () => {
    const log = mapItemToCallLog(makeSpItem({ [F.completedAt]: null }));
    expect(log.completedAt).toBeUndefined();
  });

  it('should default needCallback to false when field is undefined', () => {
    const log = mapItemToCallLog(makeSpItem({ [F.needCallback]: undefined }));
    expect(log.needCallback).toBe(false);
  });

  it('should fallback status to "new" when value is invalid', () => {
    const log = mapItemToCallLog(makeSpItem({ [F.status]: 'INVALID_VALUE' }));
    expect(log.status).toBe('new');
  });

  it('should fallback urgency to "normal" when value is invalid', () => {
    const log = mapItemToCallLog(makeSpItem({ [F.urgency]: 'INVALID_VALUE' }));
    expect(log.urgency).toBe('normal');
  });
});

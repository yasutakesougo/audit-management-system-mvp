/**
 * buildCallLogCreateBody — SP 作成ボディ変換テスト
 *
 * 対象:
 *   - buildCallLogCreateBody  CreateCallLogInput → SP ペイロード変換
 *
 * 観点:
 *   - status が折返し要件に応じて決まること
 *   - receivedByName が正しく注入されること
 *   - receivedAt の省略時にデフォルト日時が使われること
 *   - urgency 省略時に 'normal' になること
 *   - Title が "件名 (発信者名)" の複合形式であること
 *   - optional フィールドが null で送られること
 */

import { describe, it, expect } from 'vitest';
import { buildCallLogCreateBody } from '../buildCallLogCreateBody';
import { CALL_LOG_FIELDS as F } from '../callLogFieldMap';
import type { CreateCallLogInput } from '@/domain/callLogs/schema';

// ─── ベース入力ビルダー ───────────────────────────────────────────────────────

function makeInput(overrides?: Partial<CreateCallLogInput>): CreateCallLogInput {
  return {
    callerName: '田中太郎',
    callerOrg: 'テスト機関',
    targetStaffName: '山田スタッフ',
    subject: 'ご連絡の件',
    message: '折り返しお願いします',
    needCallback: true,
    urgency: 'urgent',
    ...overrides,
  };
}

const FIXED_NOW = new Date('2026-03-18T09:00:00.000Z');

// ─── status 決定 ──────────────────────────────────────────────────────────────

describe('buildCallLogCreateBody — status', () => {
  it('should set status to "callback_pending" when needCallback=true', () => {
    const body = buildCallLogCreateBody(makeInput(), '受付者', FIXED_NOW);
    expect(body[F.status]).toBe('callback_pending');
  });

  it('should set status to "callback_pending" when callbackDueAt exists', () => {
    const body = buildCallLogCreateBody(
      makeInput({
        needCallback: false,
        callbackDueAt: '2026-03-18T17:00:00.000Z',
      }),
      '受付者',
      FIXED_NOW,
    );
    expect(body[F.status]).toBe('callback_pending');
  });

  it('should set status to "new" when callback requirement is absent', () => {
    const body = buildCallLogCreateBody(
      makeInput({
        needCallback: false,
        callbackDueAt: undefined,
      }),
      '受付者',
      FIXED_NOW,
    );
    expect(body[F.status]).toBe('new');
  });
});

// ─── receivedByName 注入 ──────────────────────────────────────────────────────

describe('buildCallLogCreateBody — receivedByName', () => {
  it('should inject the receivedByName parameter into the body', () => {
    const body = buildCallLogCreateBody(makeInput(), '別の受付者', FIXED_NOW);
    expect(body[F.receivedByName]).toBe('別の受付者');
  });
});

// ─── receivedAt ──────────────────────────────────────────────────────────────

describe('buildCallLogCreateBody — receivedAt', () => {
  it('should use provided receivedAt when set', () => {
    const input = makeInput({ receivedAt: '2026-03-18T10:00:00.000Z' });
    const body = buildCallLogCreateBody(input, '受付者', FIXED_NOW);
    expect(body[F.receivedAt]).toBe('2026-03-18T10:00:00.000Z');
  });

  it('should use now.toISOString() when receivedAt is omitted', () => {
    const input = makeInput({ receivedAt: undefined });
    const body = buildCallLogCreateBody(input, '受付者', FIXED_NOW);
    expect(body[F.receivedAt]).toBe(FIXED_NOW.toISOString());
  });
});

// ─── urgency ──────────────────────────────────────────────────────────────────

describe('buildCallLogCreateBody — urgency', () => {
  it('should use provided urgency when set', () => {
    const body = buildCallLogCreateBody(makeInput({ urgency: 'today' }), '受付者', FIXED_NOW);
    expect(body[F.urgency]).toBe('today');
  });

  it('should default urgency to "normal" when omitted', () => {
    const body = buildCallLogCreateBody(makeInput({ urgency: undefined }), '受付者', FIXED_NOW);
    expect(body[F.urgency]).toBe('normal');
  });
});

// ─── Title 複合形式 ───────────────────────────────────────────────────────────

describe('buildCallLogCreateBody — Title', () => {
  it('should generate Title as "subject (callerName)"', () => {
    const body = buildCallLogCreateBody(makeInput(), '受付者', FIXED_NOW);
    expect(body['Title']).toBe('ご連絡の件 (田中太郎)');
  });
});

// ─── optional フィールド ──────────────────────────────────────────────────────

describe('buildCallLogCreateBody — optional fields', () => {
  it('should set callerOrg to null when omitted', () => {
    const body = buildCallLogCreateBody(makeInput({ callerOrg: undefined }), '受付者', FIXED_NOW);
    expect(body[F.callerOrg]).toBeNull();
  });

  it('should set relatedUserId to null when omitted', () => {
    const body = buildCallLogCreateBody(makeInput({ relatedUserId: undefined }), '受付者', FIXED_NOW);
    expect(body[F.relatedUserId]).toBeNull();
  });

  it('should set callbackDueAt to null when omitted', () => {
    const body = buildCallLogCreateBody(makeInput({ callbackDueAt: undefined }), '受付者', FIXED_NOW);
    expect(body[F.callbackDueAt]).toBeNull();
  });

  it('should include callerOrg when provided', () => {
    const body = buildCallLogCreateBody(makeInput({ callerOrg: '○○病院' }), '受付者', FIXED_NOW);
    expect(body[F.callerOrg]).toBe('○○病院');
  });

  it('should include callbackDueAt when provided', () => {
    const body = buildCallLogCreateBody(
      makeInput({ callbackDueAt: '2026-03-18T17:00:00.000Z' }),
      '受付者',
      FIXED_NOW,
    );
    expect(body[F.callbackDueAt]).toBe('2026-03-18T17:00:00.000Z');
  });
});

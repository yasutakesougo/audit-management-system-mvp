import { describe, expect, it, vi } from 'vitest';
import {
    fromSpCommentItem,
    toSpCommentCreatePayload,
    type NewCommentInput,
    type SpHandoffCommentItem,
} from '../handoffCommentTypes';

// ────────────────────────────────────────────────────────────
// Fixtures
// ────────────────────────────────────────────────────────────

const fullSpItem: SpHandoffCommentItem = {
  Id: 42,
  HandoffId: 7,
  Body: '夜間の状態変化を確認しました',
  AuthorName: '田中 太郎',
  AuthorAccount: 'tanaka@example.com',
  Created: '2026-03-03T22:15:00Z',
};

const newCommentInput: NewCommentInput = {
  handoffId: 7,
  body: '了解しました。引き続き観察します。',
  authorName: '鈴木 花子',
  authorAccount: 'suzuki@example.com',
};

// ────────────────────────────────────────────────────────────
// fromSpCommentItem
// ────────────────────────────────────────────────────────────

describe('fromSpCommentItem', () => {
  it('maps all SharePoint fields to the frontend HandoffComment shape', () => {
    const result = fromSpCommentItem(fullSpItem);

    expect(result).toEqual({
      id: 42,
      handoffId: 7,
      body: '夜間の状態変化を確認しました',
      authorName: '田中 太郎',
      authorAccount: 'tanaka@example.com',
      createdAt: '2026-03-03T22:15:00Z',
    });
  });

  it('uses Created timestamp verbatim as createdAt', () => {
    const result = fromSpCommentItem(fullSpItem);
    expect(result.createdAt).toBe('2026-03-03T22:15:00Z');
  });

  it('falls back to current ISO timestamp when Created is undefined', () => {
    const fakeNow = '2026-03-04T00:00:00.000Z';
    vi.useFakeTimers();
    vi.setSystemTime(new Date(fakeNow));

    const itemWithoutCreated: SpHandoffCommentItem = {
      ...fullSpItem,
      Created: undefined,
    };
    const result = fromSpCommentItem(itemWithoutCreated);

    expect(result.createdAt).toBe(fakeNow);

    vi.useRealTimers();
  });

  it('falls back to current ISO timestamp when Created is empty string', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T09:30:00.000Z'));

    const itemWithEmptyCreated: SpHandoffCommentItem = {
      ...fullSpItem,
      Created: '',
    };
    const result = fromSpCommentItem(itemWithEmptyCreated);

    expect(result.createdAt).toBe('2026-01-15T09:30:00.000Z');

    vi.useRealTimers();
  });

  it('preserves numeric id and handoffId without coercion', () => {
    const result = fromSpCommentItem(fullSpItem);
    expect(typeof result.id).toBe('number');
    expect(typeof result.handoffId).toBe('number');
  });
});

// ────────────────────────────────────────────────────────────
// toSpCommentCreatePayload
// ────────────────────────────────────────────────────────────

describe('toSpCommentCreatePayload', () => {
  it('maps NewCommentInput to SP create payload with PascalCase keys', () => {
    const payload = toSpCommentCreatePayload(newCommentInput);

    expect(payload).toEqual({
      HandoffId: 7,
      Body: '了解しました。引き続き観察します。',
      AuthorName: '鈴木 花子',
      AuthorAccount: 'suzuki@example.com',
    });
  });

  it('omits Id and Created (server-generated fields)', () => {
    const payload = toSpCommentCreatePayload(newCommentInput);

    expect(payload).not.toHaveProperty('Id');
    expect(payload).not.toHaveProperty('Created');
  });

  it('produces exactly 4 keys — no extras leak through', () => {
    const payload = toSpCommentCreatePayload(newCommentInput);
    expect(Object.keys(payload)).toHaveLength(4);
  });

  it('round-trips correctly: create → SP → fromSpCommentItem', () => {
    const payload = toSpCommentCreatePayload(newCommentInput);

    // Simulate what SharePoint returns after insertion
    const spResponse: SpHandoffCommentItem = {
      ...payload,
      Id: 99,
      Created: '2026-03-04T12:00:00Z',
    };

    const comment = fromSpCommentItem(spResponse);

    expect(comment.handoffId).toBe(newCommentInput.handoffId);
    expect(comment.body).toBe(newCommentInput.body);
    expect(comment.authorName).toBe(newCommentInput.authorName);
    expect(comment.authorAccount).toBe(newCommentInput.authorAccount);
    expect(comment.id).toBe(99);
    expect(comment.createdAt).toBe('2026-03-04T12:00:00Z');
  });
});

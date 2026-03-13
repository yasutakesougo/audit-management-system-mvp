/**
 * handoffAuditTypes のユニットテスト
 *
 * changedBy（表示名）と changedByAccount（UPN）の分離が正しく機能することを検証。
 * Issue #804
 */

import { describe, expect, it } from 'vitest';
import type { HandoffAuditLog, NewAuditLogInput, SpHandoffAuditLogItem } from '../handoffAuditTypes';
import {
  formatAuditDescription,
  formatStatusTransition,
  fromSpAuditLogItem,
  toSpAuditLogCreatePayload,
} from '../handoffAuditTypes';

// ── helpers ──

const makeAuditLog = (overrides: Partial<HandoffAuditLog> = {}): HandoffAuditLog => ({
  id: 1,
  handoffId: 100,
  action: 'created',
  changedBy: '田中太郎',
  changedByAccount: 'tanaka@example.com',
  changedAt: '2026-03-13T10:00:00.000Z',
  ...overrides,
});

// ────────────────────────────────────────────────────────────
// formatAuditDescription
// ────────────────────────────────────────────────────────────

describe('formatAuditDescription', () => {
  it('created アクションで changedBy（表示名）を使う', () => {
    const log = makeAuditLog({ action: 'created', changedBy: '田中太郎' });
    const description = formatAuditDescription(log);

    expect(description).toContain('田中太郎');
    expect(description).not.toContain('tanaka@example.com');
    expect(description).toContain('作成しました');
  });

  it('status_changed アクションで changedBy（表示名）を使う', () => {
    const log = makeAuditLog({
      action: 'status_changed',
      changedBy: '佐藤花子',
      changedByAccount: 'sato@example.com',
      fieldName: 'status',
      oldValue: '未対応',
      newValue: '対応中',
    });
    const description = formatAuditDescription(log);

    expect(description).toContain('佐藤花子');
    expect(description).not.toContain('sato@example.com');
    expect(description).toContain('ステータス');
    expect(description).toContain('未対応');
    expect(description).toContain('対応中');
  });

  it('field_updated アクションで changedBy（表示名）を使う', () => {
    const log = makeAuditLog({
      action: 'field_updated',
      changedBy: '鈴木一郎',
      fieldName: 'message',
    });
    const description = formatAuditDescription(log);

    expect(description).toContain('鈴木一郎');
    expect(description).toContain('本文');
  });

  it('comment_added アクションで changedBy（表示名）を使う', () => {
    const log = makeAuditLog({
      action: 'comment_added',
      changedBy: '高橋次郎',
    });
    const description = formatAuditDescription(log);

    expect(description).toContain('高橋次郎');
    expect(description).toContain('コメント');
  });

  it('changedByAccount は formatAuditDescription には含まれない', () => {
    const log = makeAuditLog({
      changedBy: '田中太郎',
      changedByAccount: 'tanaka@example.com',
    });
    const description = formatAuditDescription(log);

    expect(description).not.toContain('tanaka@example.com');
  });
});

// ────────────────────────────────────────────────────────────
// fromSpAuditLogItem
// ────────────────────────────────────────────────────────────

describe('fromSpAuditLogItem', () => {
  it('ChangedBy と ChangedByAccount を正しくマッピングする', () => {
    const spItem: SpHandoffAuditLogItem = {
      Id: 42,
      HandoffId: 100,
      Action: 'status_changed',
      FieldName: 'status',
      OldValue: '未対応',
      NewValue: '対応中',
      ChangedBy: '山田太郎',
      ChangedByAccount: 'yamada@example.com',
      Created: '2026-03-13T12:00:00.000Z',
    };

    const result = fromSpAuditLogItem(spItem);

    expect(result.changedBy).toBe('山田太郎');
    expect(result.changedByAccount).toBe('yamada@example.com');
    expect(result.id).toBe(42);
    expect(result.action).toBe('status_changed');
  });
});

// ────────────────────────────────────────────────────────────
// toSpAuditLogCreatePayload
// ────────────────────────────────────────────────────────────

describe('toSpAuditLogCreatePayload', () => {
  it('changedBy と changedByAccount を SP フィールドに変換する', () => {
    const input: NewAuditLogInput = {
      handoffId: 200,
      action: 'created',
      changedBy: '佐藤花子',
      changedByAccount: 'sato@example.com',
    };

    const payload = toSpAuditLogCreatePayload(input);

    expect(payload.ChangedBy).toBe('佐藤花子');
    expect(payload.ChangedByAccount).toBe('sato@example.com');
  });
});

// ────────────────────────────────────────────────────────────
// formatStatusTransition
// ────────────────────────────────────────────────────────────

describe('formatStatusTransition', () => {
  it('両方指定: old → new', () => {
    expect(formatStatusTransition('未対応', '対応中')).toBe('未対応 → 対応中');
  });

  it('old のみ: old →', () => {
    expect(formatStatusTransition('未対応', undefined)).toBe('未対応 →');
  });

  it('new のみ: → new', () => {
    expect(formatStatusTransition(undefined, '対応中')).toBe('→ 対応中');
  });
});

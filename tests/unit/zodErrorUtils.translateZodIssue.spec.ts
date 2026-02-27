import {
    FIELD_LABEL_MAP,
    getHumanErrorSummary,
    translatePath,
    translateZodIssue,
} from '@/lib/zodErrorUtils';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Helper: ZodError を安全に取得するユーティリティ
// ---------------------------------------------------------------------------
const getIssues = (schema: z.ZodType, data: unknown) => {
  const result = schema.safeParse(data);
  if (result.success) throw new Error('Expected schema validation to fail');
  return result.error.issues;
};

// ===========================================================================
// translatePath
// ===========================================================================
describe('translatePath', () => {
  it('returns (ルート) for empty path', () => {
    expect(translatePath([])).toBe('(ルート)');
  });

  it('translates a known field name', () => {
    expect(translatePath(['Title'])).toBe('「氏名」');
  });

  it('preserves unknown field names as-is', () => {
    expect(translatePath(['SomeUnknownField'])).toBe('「SomeUnknownField」');
  });

  it('translates nested paths with > separator', () => {
    expect(translatePath(['problemBehavior', 'selfHarm'])).toBe('「行動記録 > 自傷」');
  });

  it('handles array indices', () => {
    expect(translatePath(['userRows', 0, 'userName'])).toBe('「利用者行データ > [0] > 利用者名」');
  });
});

// ===========================================================================
// translateZodIssue — invalid_type
// ===========================================================================
describe('translateZodIssue', () => {
  it('translates invalid_type with field label', () => {
    const schema = z.object({ Title: z.string() });
    const [issue] = getIssues(schema, { Title: 123 });
    const msg = translateZodIssue(issue);

    expect(msg).toContain('「氏名」');
    expect(msg).toContain('想定外の値');
    expect(msg).toContain('string');
  });

  it('translates invalid_type for undefined (missing required field)', () => {
    const schema = z.object({ FullName: z.string() });
    const [issue] = getIssues(schema, {});
    const msg = translateZodIssue(issue);

    expect(msg).toContain('「氏名（フル）」');
    expect(msg).toContain('undefined');
  });

  // ===========================================================================
  // too_small — 必須チェック (min(1))
  // ===========================================================================
  it('translates too_small with min(1) as 必須項目', () => {
    const schema = z.object({ actor: z.string().min(1) });
    const [issue] = getIssues(schema, { actor: '' });
    const msg = translateZodIssue(issue);

    expect(msg).toContain('「操作者」');
    expect(msg).toContain('必須項目');
  });

  it('translates too_small with min(N>1) as 短すぎます', () => {
    const schema = z.object({ Title: z.string().min(3) });
    const [issue] = getIssues(schema, { Title: 'AB' });
    const msg = translateZodIssue(issue);

    expect(msg).toContain('「氏名」');
    expect(msg).toContain('短すぎます');
    expect(msg).toContain('3');
  });

  // ===========================================================================
  // too_big
  // ===========================================================================
  it('translates too_big for strings', () => {
    const schema = z.object({ specialNotes: z.string().max(5) });
    const [issue] = getIssues(schema, { specialNotes: 'toolong' });
    const msg = translateZodIssue(issue);

    expect(msg).toContain('「特記事項」');
    expect(msg).toContain('長すぎます');
    expect(msg).toContain('5');
  });

  // ===========================================================================
  // invalid_enum_value
  // ===========================================================================
  it('translates invalid_enum_value with options', () => {
    const schema = z.object({
      channel: z.enum(['system', 'user', 'auto']),
    });
    const [issue] = getIssues(schema, { channel: 'invalid' });
    const msg = translateZodIssue(issue);

    expect(msg).toContain('「チャネル」');
    expect(msg).toContain('許可されていない値');
  });

  // ===========================================================================
  // nested path
  // ===========================================================================
  it('translates nested path correctly', () => {
    const schema = z.object({
      problemBehavior: z.object({
        selfHarm: z.boolean(),
      }),
    });
    const [issue] = getIssues(schema, { problemBehavior: { selfHarm: 'yes' } });
    const msg = translateZodIssue(issue);

    expect(msg).toContain('「行動記録 > 自傷」');
  });

  // ===========================================================================
  // unknown field (not in FIELD_LABEL_MAP)
  // ===========================================================================
  it('preserves unknown field names', () => {
    const schema = z.object({ FutureField: z.string() });
    const [issue] = getIssues(schema, { FutureField: 123 });
    const msg = translateZodIssue(issue);

    expect(msg).toContain('「FutureField」');
  });

  // ===========================================================================
  // default fallback
  // ===========================================================================
  it('produces a fallback message for unrecognized issue codes', () => {
    // Simulate an unknown code via cast
    const fakeIssue = {
      code: 'some_future_code',
      path: ['Title'],
      message: 'Something went wrong',
    } as unknown as z.ZodIssue;

    const msg = translateZodIssue(fakeIssue);
    expect(msg).toContain('「氏名」');
    expect(msg).toContain('問題があります');
  });
});

// ===========================================================================
// getHumanErrorSummary
// ===========================================================================
describe('getHumanErrorSummary', () => {
  it('produces a Japanese summary from a ZodError', () => {
    const schema = z.object({
      Title: z.string(),
      Email: z.string(),
    });
    const result = schema.safeParse({ Title: 123, Email: null });
    if (result.success) throw new Error('Expected failure');

    const summary = getHumanErrorSummary(result.error);
    expect(summary).toContain('データ検証エラー');
    expect(summary).toContain('「氏名」');
    expect(summary).toContain('「メールアドレス」');
  });

  it('falls back to message for regular Error', () => {
    expect(getHumanErrorSummary(new Error('test'))).toBe('test');
  });

  it('falls back to String for non-Error', () => {
    expect(getHumanErrorSummary(42)).toBe('42');
  });
});

// ===========================================================================
// FIELD_LABEL_MAP coverage check
// ===========================================================================
describe('FIELD_LABEL_MAP', () => {
  it('has entries for key domain fields', () => {
    // Users
    expect(FIELD_LABEL_MAP.Title).toBe('氏名');
    expect(FIELD_LABEL_MAP.UserID).toBe('利用者ID');
    // Daily
    expect(FIELD_LABEL_MAP.amActivity).toBe('午前活動');
    expect(FIELD_LABEL_MAP.problemBehavior).toBe('行動記録');
    // Audit
    expect(FIELD_LABEL_MAP.actor).toBe('操作者');
    // Env
    expect(FIELD_LABEL_MAP.VITE_SP_RESOURCE).toBe('SharePointリソースURL');
  });
});

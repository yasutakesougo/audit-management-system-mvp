import { describe, expect, it } from 'vitest';
import {
  appendSuggestionMemo,
  buildSuggestionMemoText,
  createSuggestionAction,
  isAlreadyAccepted,
  isAlreadyActioned,
  type SuggestionAction,
} from '../suggestionAction';
import type { PatternSuggestion } from '../behaviorPatternSuggestions';

// ─── ヘルパー ────────────────────────────────────────────

const makeSuggestion = (overrides?: Partial<PatternSuggestion>): PatternSuggestion => ({
  ruleId: 'highCoOccurrence:anxiety',
  category: 'co-occurrence',
  severity: 'notice',
  message: '「不安傾向」が記録されている場面の 60% で問題行動が見られます。環境や状況の確認を検討してみてください',
  relatedTags: ['anxiety'],
  evidence: '不安傾向: 3/5件 (60%)',
  ...overrides,
});

const makeAction = (overrides?: Partial<SuggestionAction>): SuggestionAction => ({
  action: 'accept',
  ruleId: 'highCoOccurrence:anxiety',
  category: 'co-occurrence',
  message: '「不安傾向」が記録されている場面の 60% で問題行動が見られます。環境や状況の確認を検討してみてください',
  evidence: '不安傾向: 3/5件 (60%)',
  timestamp: '2026-03-14T10:00:00.000Z',
  userId: 'user-1',
  ...overrides,
});

// ─── buildSuggestionMemoText ─────────────────────────────

describe('buildSuggestionMemoText', () => {
  it('メッセージ + 日付 + 根拠を含むテキストを返す', () => {
    const result = buildSuggestionMemoText(makeSuggestion(), '2026-03-14');

    expect(result).toContain('【気づきメモ】');
    expect(result).toContain('不安傾向');
    expect(result).toContain('2026-03-14');
    expect(result).toContain('根拠: 不安傾向: 3/5件 (60%)');
  });

  it('evidence の要約が2行目に含まれる', () => {
    const result = buildSuggestionMemoText(makeSuggestion(), '2026-03-14');
    const lines = result.split('\n');

    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^【気づきメモ】/);
    expect(lines[1]).toMatch(/^根拠: /);
  });
});

// ─── appendSuggestionMemo ────────────────────────────────

describe('appendSuggestionMemo', () => {
  it('空の specialNotes にはセパレータなしで追記する', () => {
    const result = appendSuggestionMemo('', makeSuggestion(), '2026-03-14');

    expect(result).not.toContain('---');
    expect(result).toContain('【気づきメモ】');
  });

  it('既存メモがあれば --- セパレータで区切って追記する', () => {
    const result = appendSuggestionMemo(
      '午後から少し疲れている様子',
      makeSuggestion(),
      '2026-03-14',
    );

    expect(result).toBe(
      '午後から少し疲れている様子\n---\n' +
      '【気づきメモ】「不安傾向」が記録されている場面の 60% で問題行動が見られます。環境や状況の確認を検討してみてください（2026-03-14）\n' +
      '根拠: 不安傾向: 3/5件 (60%)',
    );
  });

  it('既存メモの末尾空白はトリムされる', () => {
    const result = appendSuggestionMemo('  メモ  ', makeSuggestion(), '2026-03-14');

    expect(result).toMatch(/^メモ\n---\n【気づきメモ】/);
  });
});

// ─── createSuggestionAction ──────────────────────────────

describe('createSuggestionAction', () => {
  it('accept のアクション記録を生成する', () => {
    const result = createSuggestionAction(makeSuggestion(), 'accept', 'user-1');

    expect(result.action).toBe('accept');
    expect(result.ruleId).toBe('highCoOccurrence:anxiety');
    expect(result.category).toBe('co-occurrence');
    expect(result.message).toContain('不安傾向');
    expect(result.evidence).toContain('3/5件');
    expect(result.userId).toBe('user-1');
    expect(result.timestamp).toBeTruthy();
  });

  it('dismiss のアクション記録を生成する', () => {
    const result = createSuggestionAction(makeSuggestion(), 'dismiss', 'user-2');

    expect(result.action).toBe('dismiss');
    expect(result.userId).toBe('user-2');
  });
});

// ─── isAlreadyAccepted ──────────────────────────────────

describe('isAlreadyAccepted', () => {
  it('未採用の場合 false を返す', () => {
    expect(isAlreadyAccepted([], 'highCoOccurrence:anxiety', 'msg')).toBe(false);
  });

  it('undefined でも安全に false を返す', () => {
    expect(isAlreadyAccepted(undefined, 'highCoOccurrence:anxiety', 'msg')).toBe(false);
  });

  it('accept 済みの ruleId + message で true を返す', () => {
    const actions = [makeAction()];
    expect(isAlreadyAccepted(actions, 'highCoOccurrence:anxiety', makeAction().message)).toBe(true);
  });

  it('dismiss だけでは false を返す', () => {
    const actions = [makeAction({ action: 'dismiss' })];
    expect(isAlreadyAccepted(actions, 'highCoOccurrence:anxiety', makeAction().message)).toBe(false);
  });

  it('ruleId が同じでも message が違えば false', () => {
    const actions = [makeAction()];
    expect(isAlreadyAccepted(actions, 'highCoOccurrence:anxiety', '別のメッセージ')).toBe(false);
  });
});

// ─── isAlreadyActioned ──────────────────────────────────

describe('isAlreadyActioned', () => {
  it('accept 済みなら true', () => {
    const actions = [makeAction()];
    expect(isAlreadyActioned(actions, 'highCoOccurrence:anxiety', makeAction().message)).toBe(true);
  });

  it('dismiss 済みでも true', () => {
    const actions = [makeAction({ action: 'dismiss' })];
    expect(isAlreadyActioned(actions, 'highCoOccurrence:anxiety', makeAction().message)).toBe(true);
  });

  it('未アクションなら false', () => {
    expect(isAlreadyActioned([], 'highCoOccurrence:anxiety', 'msg')).toBe(false);
  });

  it('undefined でも安全に false', () => {
    expect(isAlreadyActioned(undefined, 'rule', 'msg')).toBe(false);
  });
});

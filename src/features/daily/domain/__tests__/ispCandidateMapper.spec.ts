/**
 * @fileoverview ISP Candidate Mapper テスト
 * @description
 * Issue #10: Suggestion → ISP Candidate Bridge
 * pure function の振る舞いを検証する。
 */

import { describe, it, expect, vi } from 'vitest';
import type { SuggestionAction } from '../suggestionAction';
import {
  mapAcceptedToCandidate,
  collectISPCandidates,
  buildCandidateText,
  appendCandidateToImprovementIdeas,
  isAlreadyCandidated,
  isAlreadyInImprovementIdeas,
  type ISPCandidate,
} from '../ispCandidateMapper';

// ─── ヘルパー ─────────────────────────────────────────────

function makeAction(overrides: Partial<SuggestionAction> = {}): SuggestionAction {
  return {
    action: 'accept',
    ruleId: 'high-cooccurrence',
    category: 'co-occurrence',
    message: '不安とpanicの併発率が高い傾向があるかもしれません',
    evidence: 'anxiety: 3/5件 (60%)',
    timestamp: '2026-03-14T10:00:00.000Z',
    userId: 'U123',
    ...overrides,
  };
}

function makeCandidate(overrides: Partial<ISPCandidate> = {}): ISPCandidate {
  return {
    id: 'cand-test-1',
    userId: 'U123',
    text: '不安とpanicの併発率が高い傾向があるかもしれません',
    category: 'co-occurrence',
    source: 'behavior-pattern-suggestion',
    sourceRuleId: 'high-cooccurrence',
    sourceEvidence: 'anxiety: 3/5件 (60%)',
    status: 'pending',
    createdAt: '2026-03-14T10:00:00.000Z',
    suggestedGoalType: 'support',
    domainHints: ['cognitive'],
    ...overrides,
  };
}

// ─── mapAcceptedToCandidate ────────────────────────────────

describe('mapAcceptedToCandidate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-14T10:00:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('accept アクションから ISPCandidate が正しく生成される', () => {
    const result = mapAcceptedToCandidate(makeAction(), []);
    expect(result).not.toBeNull();
    expect(result!.userId).toBe('U123');
    expect(result!.sourceRuleId).toBe('high-cooccurrence');
    expect(result!.category).toBe('co-occurrence');
    expect(result!.source).toBe('behavior-pattern-suggestion');
    expect(result!.status).toBe('pending');
  });

  it('dismiss アクションは null を返す', () => {
    const result = mapAcceptedToCandidate(makeAction({ action: 'dismiss' }), []);
    expect(result).toBeNull();
  });

  it('positive-signal カテゴリは null を返す', () => {
    const result = mapAcceptedToCandidate(
      makeAction({ category: 'positive-signal', ruleId: 'positive-signal-cooperation' }),
      [],
    );
    expect(result).toBeNull();
  });

  it('既存候補と同じ ruleId+userId+message は null を返す（重複防止）', () => {
    const existing = [makeCandidate()];
    const result = mapAcceptedToCandidate(makeAction(), existing);
    expect(result).toBeNull();
  });

  it('co-occurrence → suggestedGoalType: support', () => {
    const result = mapAcceptedToCandidate(makeAction({ category: 'co-occurrence' }), []);
    expect(result!.suggestedGoalType).toBe('support');
  });

  it('slot-bias → suggestedGoalType: short', () => {
    const result = mapAcceptedToCandidate(makeAction({ category: 'slot-bias', ruleId: 'slot-bias-1' }), []);
    expect(result!.suggestedGoalType).toBe('short');
  });

  it('tag-density → suggestedGoalType: support', () => {
    const result = mapAcceptedToCandidate(makeAction({ category: 'tag-density', ruleId: 'tag-density-1' }), []);
    expect(result!.suggestedGoalType).toBe('support');
  });

  it('メッセージに panic 関連キーワードがあれば cognitive を含む domainHints', () => {
    const result = mapAcceptedToCandidate(
      makeAction({ message: 'パニックが午前に集中する傾向があるかもしれません' }),
      [],
    );
    expect(result!.domainHints).toContain('cognitive');
  });
});

// ─── collectISPCandidates ──────────────────────────────────

describe('collectISPCandidates', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-14T10:00:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('複数の accept アクションから候補を収集する', () => {
    const actions = [
      makeAction({ ruleId: 'rule-1', message: 'msg-1' }),
      makeAction({ ruleId: 'rule-2', message: 'msg-2', category: 'slot-bias' }),
    ];
    const result = collectISPCandidates(actions);
    expect(result).toHaveLength(2);
  });

  it('dismiss を含む場合は候補化しない', () => {
    const actions = [
      makeAction({ ruleId: 'rule-1', message: 'msg-1' }),
      makeAction({ ruleId: 'rule-2', message: 'msg-2', action: 'dismiss' }),
    ];
    const result = collectISPCandidates(actions);
    expect(result).toHaveLength(1);
  });

  it('同一 ruleId+userId+message の重複を除外する', () => {
    const actions = [
      makeAction({ ruleId: 'rule-1', message: 'same-msg' }),
      makeAction({ ruleId: 'rule-1', message: 'same-msg' }),
    ];
    const result = collectISPCandidates(actions);
    expect(result).toHaveLength(1);
  });

  it('既存候補との重複も除外する', () => {
    const existing = [makeCandidate({ sourceRuleId: 'rule-1', text: 'msg-1' })];
    const actions = [makeAction({ ruleId: 'rule-1', message: 'msg-1' })];
    const result = collectISPCandidates(actions, existing);
    expect(result).toHaveLength(0);
  });
});

// ─── buildCandidateText ────────────────────────────────────

describe('buildCandidateText', () => {
  it('フォーマット通りのテキストを生成する', () => {
    const candidate = makeCandidate();
    const text = buildCandidateText(candidate);

    expect(text).toContain('【行動パターンからの候補】');
    expect(text).toContain(candidate.text);
    expect(text).toContain(`根拠: ${candidate.sourceEvidence}`);
    expect(text).toContain('→ 支援内容候補');
    expect(text).toContain('[source:rule=high-cooccurrence user=U123]');
  });

  it('short 候補の場合は「短期目標候補」ラベル', () => {
    const candidate = makeCandidate({ suggestedGoalType: 'short' });
    const text = buildCandidateText(candidate);
    expect(text).toContain('→ 短期目標候補');
  });
});

// ─── appendCandidateToImprovementIdeas ─────────────────────

describe('appendCandidateToImprovementIdeas', () => {
  it('空の improvementIdeas に追記できる', () => {
    const result = appendCandidateToImprovementIdeas('', makeCandidate());
    expect(result).toContain('【行動パターンからの候補】');
    expect(result).not.toContain('---');
  });

  it('undefined 相当（空文字）でも安全に追記できる', () => {
    const result = appendCandidateToImprovementIdeas('   ', makeCandidate());
    expect(result).toContain('【行動パターンからの候補】');
  });

  it('既存テキストがある場合はセパレータ付きで追記する', () => {
    const result = appendCandidateToImprovementIdeas('既存メモ', makeCandidate());
    expect(result).toContain('既存メモ');
    expect(result).toContain('---');
    expect(result).toContain('【行動パターンからの候補】');
  });
});

// ─── isAlreadyCandidated ───────────────────────────────────

describe('isAlreadyCandidated', () => {
  it('同一 ruleId+userId+text は true', () => {
    const existing = [makeCandidate()];
    expect(isAlreadyCandidated(existing, 'high-cooccurrence', 'U123', makeCandidate().text)).toBe(true);
  });

  it('ruleId が異なれば false', () => {
    const existing = [makeCandidate()];
    expect(isAlreadyCandidated(existing, 'other-rule', 'U123', makeCandidate().text)).toBe(false);
  });

  it('userId が異なれば false', () => {
    const existing = [makeCandidate()];
    expect(isAlreadyCandidated(existing, 'high-cooccurrence', 'U999', makeCandidate().text)).toBe(false);
  });

  it('空の配列は false', () => {
    expect(isAlreadyCandidated([], 'any', 'any', 'any')).toBe(false);
  });
});

// ─── isAlreadyInImprovementIdeas ───────────────────────────

describe('isAlreadyInImprovementIdeas', () => {
  it('メタ印が含まれている場合は true', () => {
    const text = '何か\n[source:rule=high-cooccurrence user=U123]\n何か';
    expect(isAlreadyInImprovementIdeas(text, 'high-cooccurrence', 'U123')).toBe(true);
  });

  it('メタ印が含まれていない場合は false', () => {
    expect(isAlreadyInImprovementIdeas('普通のメモ', 'rule-1', 'U123')).toBe(false);
  });

  it('ruleId は合致するが userId が異なる場合は false', () => {
    const text = '[source:rule=rule-1 user=U999]';
    expect(isAlreadyInImprovementIdeas(text, 'rule-1', 'U123')).toBe(false);
  });
});

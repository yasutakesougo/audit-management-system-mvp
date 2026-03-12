import { describe, expect, it } from 'vitest';
import { canTransition, transition } from '../proposalStateMachine';
import type { ProposalStatus } from '../proposalTypes';

describe('canTransition', () => {
  // ── proposed ──
  it('proposed → accepted: 許可', () => {
    expect(canTransition('proposed', 'accepted')).toBe(true);
  });

  it('proposed → deferred: 許可', () => {
    expect(canTransition('proposed', 'deferred')).toBe(true);
  });

  it('proposed → rejected: 許可', () => {
    expect(canTransition('proposed', 'rejected')).toBe(true);
  });

  // ── deferred ──
  it('deferred → proposed: 許可（再検討）', () => {
    expect(canTransition('deferred', 'proposed')).toBe(true);
  });

  it('deferred → accepted: 許可', () => {
    expect(canTransition('deferred', 'accepted')).toBe(true);
  });

  it('deferred → rejected: 許可', () => {
    expect(canTransition('deferred', 'rejected')).toBe(true);
  });

  // ── accepted (不可逆) ──
  it('accepted → proposed: 不許可', () => {
    expect(canTransition('accepted', 'proposed')).toBe(false);
  });

  it('accepted → deferred: 不許可', () => {
    expect(canTransition('accepted', 'deferred')).toBe(false);
  });

  it('accepted → rejected: 不許可', () => {
    expect(canTransition('accepted', 'rejected')).toBe(false);
  });

  // ── rejected (不可逆) ──
  it('rejected → proposed: 不許可', () => {
    expect(canTransition('rejected', 'proposed')).toBe(false);
  });

  it('rejected → accepted: 不許可', () => {
    expect(canTransition('rejected', 'accepted')).toBe(false);
  });

  it('rejected → deferred: 不許可', () => {
    expect(canTransition('rejected', 'deferred')).toBe(false);
  });
});

describe('transition', () => {
  it('有効な遷移は ok: true を返す', () => {
    const result = transition('proposed', 'accepted');
    expect(result).toEqual({ ok: true, status: 'accepted' });
  });

  it('無効な遷移は ok: false とエラーメッセージを返す', () => {
    const result = transition('accepted', 'proposed');
    expect(result).toEqual({
      ok: false,
      error: 'Invalid transition: accepted → proposed',
    });
  });

  it('全ての不可逆状態からの遷移を拒否する', () => {
    const immutableStates: ProposalStatus[] = ['accepted', 'rejected'];
    const targets: ProposalStatus[] = ['proposed', 'accepted', 'deferred', 'rejected'];

    for (const from of immutableStates) {
      for (const to of targets) {
        if (from === to) continue; // 同状態遷移はテーブルに無いが自然に false
        const result = transition(from, to);
        expect(result.ok).toBe(false);
      }
    }
  });
});

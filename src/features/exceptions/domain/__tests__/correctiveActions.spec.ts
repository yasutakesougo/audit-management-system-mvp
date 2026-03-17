/**
 * @fileoverview 是正アクションエンジンの単体テスト
 * @description
 * MVP-012: buildCorrectiveActions / buildAllCorrectiveActions / pickTopCorrectiveAction
 * と extractUserId のテスト
 */
import { describe, it, expect } from 'vitest';
import {
  buildCorrectiveActions,
  buildAllCorrectiveActions,
  pickTopCorrectiveAction,
  extractUserId,
  type CorrectiveAction,
} from '../correctiveActions';
import type { ExceptionItem } from '../exceptionLogic';

// ─── ヘルパー ────────────────────────────────────────────────────

function makeException(overrides: Partial<ExceptionItem> = {}): ExceptionItem {
  return {
    id: 'test-001',
    category: 'missing-record',
    severity: 'high',
    title: 'テスト例外',
    description: '説明',
    updatedAt: '2026-03-18',
    ...overrides,
  };
}

// ─── extractUserId ─────────────────────────────────────────────

describe('extractUserId', () => {
  it('クエリパラメータから userId を抽出する', () => {
    expect(extractUserId('/daily/activity?userId=U-001')).toBe('U-001');
  });

  it('エンコードされた userId をデコードする', () => {
    expect(extractUserId('/daily/activity?userId=U%20001')).toBe('U 001');
  });

  it('パスセグメントから userId を抽出する', () => {
    expect(extractUserId('/isp-editor/U-001')).toBe('U-001');
  });

  it('userId が見つからない場合は null', () => {
    expect(extractUserId('/handoff/timeline')).toBeNull();
    expect(extractUserId('')).toBeNull();
  });
});

// ─── buildCorrectiveActions ────────────────────────────────────

describe('buildCorrectiveActions', () => {
  describe('missing-record', () => {
    it('記録入力と利用者ハブの 2 アクションを返す', () => {
      const item = makeException({
        category: 'missing-record',
        actionPath: '/daily/activity?userId=U-001',
      });
      const actions = buildCorrectiveActions(item);
      expect(actions).toHaveLength(2);
    });

    it('primary アクションが先頭に来る', () => {
      const item = makeException({
        category: 'missing-record',
        actionPath: '/daily/activity?userId=U-001',
      });
      const actions = buildCorrectiveActions(item);
      expect(actions[0].variant).toBe('primary');
    });

    it('primary アクションの route に userId が含まれる', () => {
      const item = makeException({
        category: 'missing-record',
        actionPath: '/daily/activity?userId=U-001',
      });
      const actions = buildCorrectiveActions(item);
      expect(actions[0].route).toContain('U-001');
    });

    it('userId が取れない場合はフォールバック route を使う', () => {
      const item = makeException({ category: 'missing-record', actionPath: '' });
      const actions = buildCorrectiveActions(item);
      expect(actions[0].route).toBe('/dailysupport');
    });

    it('severity が high である', () => {
      const item = makeException({ category: 'missing-record' });
      expect(buildCorrectiveActions(item)[0].severity).toBe('high');
    });
  });

  describe('overdue-plan', () => {
    it('支援計画作成と利用者ハブの 2 アクションを返す', () => {
      const item = makeException({ category: 'overdue-plan' });
      expect(buildCorrectiveActions(item)).toHaveLength(2);
    });

    it('primary アクションに isp-editor route が含まれる (userId あり)', () => {
      const item = makeException({
        category: 'overdue-plan',
        actionPath: '/isp-editor/U-002',
      });
      const actions = buildCorrectiveActions(item);
      expect(actions[0].route).toContain('isp-editor');
      expect(actions[0].route).toContain('U-002');
    });
  });

  describe('critical-handoff', () => {
    it('申し送り確認と対応記録の 2 アクションを返す', () => {
      const item = makeException({ category: 'critical-handoff' });
      expect(buildCorrectiveActions(item)).toHaveLength(2);
    });

    it('primary アクションの severity が critical', () => {
      const item = makeException({ category: 'critical-handoff' });
      const actions = buildCorrectiveActions(item);
      expect(actions[0].severity).toBe('critical');
    });

    it('primary アクションの route が /handoff/timeline', () => {
      const item = makeException({ category: 'critical-handoff' });
      expect(buildCorrectiveActions(item)[0].route).toBe('/handoff/timeline');
    });
  });

  describe('attention-user', () => {
    it('支援手順書と利用者詳細の 2 アクションを返す', () => {
      const item = makeException({
        category: 'attention-user',
        actionPath: '/isp-editor/U-003',
      });
      expect(buildCorrectiveActions(item)).toHaveLength(2);
    });

    it('primary アクションに isp-editor が含まれる', () => {
      const item = makeException({
        category: 'attention-user',
        actionPath: '/isp-editor/U-003',
      });
      expect(buildCorrectiveActions(item)[0].route).toContain('isp-editor');
    });
  });

  it('各アクションに key / label / icon / reason が存在する', () => {
    const item = makeException({ category: 'missing-record' });
    buildCorrectiveActions(item).forEach((a: CorrectiveAction) => {
      expect(a.key).toBeTruthy();
      expect(a.label).toBeTruthy();
      expect(a.icon).toBeTruthy();
      expect(a.reason).toBeTruthy();
    });
  });
});

// ─── buildAllCorrectiveActions ─────────────────────────────────

describe('buildAllCorrectiveActions', () => {
  it('Map に各 item.id のアクションが入る', () => {
    const items = [
      makeException({ id: 'ex-001', category: 'missing-record' }),
      makeException({ id: 'ex-002', category: 'critical-handoff' }),
    ];
    const map = buildAllCorrectiveActions(items);
    expect(map.has('ex-001')).toBe(true);
    expect(map.has('ex-002')).toBe(true);
  });

  it('空配列なら空 Map を返す', () => {
    const map = buildAllCorrectiveActions([]);
    expect(map.size).toBe(0);
  });
});

// ─── pickTopCorrectiveAction ───────────────────────────────────

describe('pickTopCorrectiveAction', () => {
  it('最初の例外から primary アクションを返す', () => {
    const items = [makeException({ category: 'missing-record' })];
    const top = pickTopCorrectiveAction(items);
    expect(top).not.toBeNull();
    expect(top?.variant).toBe('primary');
  });

  it('空配列なら null を返す', () => {
    expect(pickTopCorrectiveAction([])).toBeNull();
  });

  it('severity が critical な例外が先頭なら critical アクションを返す', () => {
    // aggregateExceptions でソート済みの配列を想定
    const items = [
      makeException({ category: 'critical-handoff', severity: 'critical' }),
      makeException({ id: 'ex-002', category: 'missing-record', severity: 'high' }),
    ];
    const top = pickTopCorrectiveAction(items);
    expect(top?.severity).toBe('critical');
  });
});

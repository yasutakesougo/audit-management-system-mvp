/**
 * @fileoverview useIspRecommendationDecisions Hook テスト
 * @description
 * Phase 4-C4: ISP 判断記録 Hook の renderHook テスト。
 *
 * 観点:
 * - 初期ロード（userId / period 指定で判断レコードを取得）
 * - recommendations → decisionStatuses / decisionNotes の正しい解決
 * - 保存成功後の状態更新（decisionStatuses が更新される）
 * - 保存失敗時に error が立つ
 * - userId / period 変更時の再ロード
 * - monitoringPeriod が undefined のとき list を呼ばない
 * - レベルが pending の recommendation は decisionStatuses に含まれない
 */
import { renderHook, waitFor, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InMemoryIspDecisionRepository } from '../../data/InMemoryIspDecisionRepository';
import {
  __resetIspDecisionRepositoryForTesting,
  __setIspDecisionRepositoryForTesting,
} from '../../data/createIspDecisionRepository';
import type { IspRecommendation, IspRecommendationSummary } from '../../domain/ispRecommendationTypes';
import type { IspRecommendationDecision } from '../../domain/ispRecommendationDecisionTypes';
import { useIspRecommendationDecisions } from '../useIspRecommendationDecisions';
import type { MonitoringPeriod } from '../useIspRecommendationDecisions';

// ─── テストヘルパー ──────────────────────────────────────

const PERIOD: MonitoringPeriod = {
  from: '2026-01-15',
  to: '2026-03-15',
};

const USER_ID = 'user-1';
const DECIDED_BY = 'staff@example.com';

function makeRecommendation(overrides?: Partial<IspRecommendation>): IspRecommendation {
  return {
    goalId: 'goal-1',
    level: 'adjust-support',
    reason: 'テストの理由',
    evidence: {
      progressLevel: 'stagnant',
      rate: 0.45,
      trend: 'stable',
      matchedRecordCount: 5,
      matchedTagCount: 8,
      linkedCategories: ['dailyLiving'],
    },
    ...overrides,
  };
}

function makeSummary(recs?: IspRecommendation[]): IspRecommendationSummary {
  const recommendations = recs ?? [
    makeRecommendation({ goalId: 'goal-1', level: 'adjust-support' }),
    makeRecommendation({ goalId: 'goal-2', level: 'revise-goal' }),
    makeRecommendation({ goalId: 'goal-3', level: 'continue' }),
  ];
  return {
    recommendations,
    overallLevel: 'revise-goal',
    actionableCount: recommendations.length,
    totalGoalCount: recommendations.length,
    summaryText: 'テスト用サマリー',
  };
}

function makeDecisionRecord(overrides?: Partial<IspRecommendationDecision>): IspRecommendationDecision {
  return {
    id: 'decision-1',
    goalId: 'goal-1',
    userId: USER_ID,
    status: 'accepted',
    decidedBy: DECIDED_BY,
    decidedAt: '2026-03-15T10:00:00Z',
    note: '',
    snapshot: {
      level: 'adjust-support',
      reason: 'テストの理由',
      progressLevel: 'stagnant',
      rate: 0.45,
      trend: 'stable',
      matchedRecordCount: 5,
      matchedTagCount: 8,
    },
    monitoringPeriodFrom: PERIOD.from,
    monitoringPeriodTo: PERIOD.to,
    ...overrides,
  };
}

// ─── テスト本体 ──────────────────────────────────────────

describe('useIspRecommendationDecisions', () => {
  let repo: InMemoryIspDecisionRepository;

  beforeEach(() => {
    repo = new InMemoryIspDecisionRepository();
    __resetIspDecisionRepositoryForTesting();
    __setIspDecisionRepositoryForTesting(repo);
  });

  // ─── 初期ロード ──────────────────────────────────────

  describe('初期ロード', () => {
    it('userId と period があれば repository.list が呼ばれる', async () => {
      const summary = makeSummary();
      const listSpy = vi.spyOn(repo, 'list');

      renderHook(() =>
        useIspRecommendationDecisions(USER_ID, PERIOD, summary, DECIDED_BY),
      );

      await waitFor(() => {
        expect(listSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: USER_ID,
            monitoringPeriod: PERIOD,
          }),
        );
      });
    });

    it('userId が空文字なら list を呼ばない', async () => {
      const listSpy = vi.spyOn(repo, 'list');
      const summary = makeSummary();

      renderHook(() =>
        useIspRecommendationDecisions('', PERIOD, summary, DECIDED_BY),
      );

      // 少し待って呼ばれていないことを確認
      await new Promise(r => setTimeout(r, 50));
      expect(listSpy).not.toHaveBeenCalled();
    });

    it('monitoringPeriod が undefined なら list を呼ばない', async () => {
      const listSpy = vi.spyOn(repo, 'list');
      const summary = makeSummary();

      renderHook(() =>
        useIspRecommendationDecisions(USER_ID, undefined, summary, DECIDED_BY),
      );

      await new Promise(r => setTimeout(r, 50));
      expect(listSpy).not.toHaveBeenCalled();
    });

    it('既存の判断レコードがあれば初期状態で反映される', async () => {
      // 事前に判断レコードを入れておく
      await repo.save({
        goalId: 'goal-1',
        userId: USER_ID,
        status: 'accepted',
        decidedBy: DECIDED_BY,
        decidedAt: '2026-03-15T10:00:00Z',
        note: '対応する方針で合意',
        snapshot: makeDecisionRecord().snapshot,
        monitoringPeriodFrom: PERIOD.from,
        monitoringPeriodTo: PERIOD.to,
      });

      const summary = makeSummary();

      const { result } = renderHook(() =>
        useIspRecommendationDecisions(USER_ID, PERIOD, summary, DECIDED_BY),
      );

      await waitFor(() => {
        expect(result.current.decisions).toHaveLength(1);
      });

      expect(result.current.decisionStatuses.get('goal-1')).toBe('accepted');
      expect(result.current.decisionNotes.get('goal-1')).toBe('対応する方針で合意');
      // 未判断の goal-2, goal-3 は pending
      expect(result.current.decisionStatuses.get('goal-2')).toBe('pending');
      expect(result.current.decisionStatuses.get('goal-3')).toBe('pending');
    });
  });

  // ─── decisionStatuses / decisionNotes 解決 ───────────

  describe('decisionStatuses / decisionNotes 解決', () => {
    it('recommendations が null なら両 Map は空', () => {
      const { result } = renderHook(() =>
        useIspRecommendationDecisions('', PERIOD, null, DECIDED_BY),
      );

      expect(result.current.decisionStatuses.size).toBe(0);
      expect(result.current.decisionNotes.size).toBe(0);
    });

    it('全目標が未判断なら全て pending にマップされる', async () => {
      const summary = makeSummary();

      const { result } = renderHook(() =>
        useIspRecommendationDecisions(USER_ID, PERIOD, summary, DECIDED_BY),
      );

      await waitFor(() => {
        expect(result.current.decisionStatuses.get('goal-1')).toBe('pending');
      });

      expect(result.current.decisionStatuses.get('goal-2')).toBe('pending');
      expect(result.current.decisionStatuses.get('goal-3')).toBe('pending');
      expect(result.current.decisionNotes.size).toBe(0);
    });

    it('レベルが pending の recommendation は decisionStatuses に含まれない', () => {
      const summary = makeSummary([
        makeRecommendation({ goalId: 'goal-1', level: 'pending' }),
        makeRecommendation({ goalId: 'goal-2', level: 'adjust-support' }),
      ]);

      const { result } = renderHook(() =>
        useIspRecommendationDecisions('', PERIOD, summary, DECIDED_BY),
      );

      // level=pending の goal-1 は statuses に含まれない
      expect(result.current.decisionStatuses.has('goal-1')).toBe(false);
      // level!=pending の goal-2 は含まれる
      expect(result.current.decisionStatuses.get('goal-2')).toBe('pending');
    });

    it('同じ目標に複数の判断がある場合、最新の判断が反映される', async () => {
      // 古い判断
      await repo.save({
        goalId: 'goal-1',
        userId: USER_ID,
        status: 'deferred',
        decidedBy: DECIDED_BY,
        decidedAt: '2026-03-10T10:00:00Z',
        note: '保留にする',
        snapshot: makeDecisionRecord().snapshot,
        monitoringPeriodFrom: PERIOD.from,
        monitoringPeriodTo: PERIOD.to,
      });
      // 新しい判断
      await repo.save({
        goalId: 'goal-1',
        userId: USER_ID,
        status: 'accepted',
        decidedBy: DECIDED_BY,
        decidedAt: '2026-03-15T10:00:00Z',
        note: '最終的に採用',
        snapshot: makeDecisionRecord().snapshot,
        monitoringPeriodFrom: PERIOD.from,
        monitoringPeriodTo: PERIOD.to,
      });

      const summary = makeSummary();

      const { result } = renderHook(() =>
        useIspRecommendationDecisions(USER_ID, PERIOD, summary, DECIDED_BY),
      );

      await waitFor(() => {
        expect(result.current.decisions).toHaveLength(2);
      });

      // 最新の judgement が適用される
      expect(result.current.decisionStatuses.get('goal-1')).toBe('accepted');
      expect(result.current.decisionNotes.get('goal-1')).toBe('最終的に採用');
    });
  });

  // ─── 保存（handleDecision） ──────────────────────────

  describe('handleDecision — 保存', () => {
    it('保存成功後に decisionStatuses が更新される', async () => {
      const summary = makeSummary();

      const { result } = renderHook(() =>
        useIspRecommendationDecisions(USER_ID, PERIOD, summary, DECIDED_BY),
      );

      await waitFor(() => {
        expect(result.current.decisionStatuses.get('goal-1')).toBe('pending');
      });

      await act(async () => {
        await result.current.handleDecision({
          goalId: 'goal-1',
          status: 'accepted',
          note: 'ISP に反映する',
        });
      });

      expect(result.current.decisionStatuses.get('goal-1')).toBe('accepted');
      expect(result.current.decisionNotes.get('goal-1')).toBe('ISP に反映する');
      expect(result.current.decisions).toHaveLength(1);
    });

    it('保存後に isSaving が false に戻る', async () => {
      const summary = makeSummary();

      const { result } = renderHook(() =>
        useIspRecommendationDecisions(USER_ID, PERIOD, summary, DECIDED_BY),
      );

      await waitFor(() => {
        expect(result.current.isSaving).toBe(false);
      });

      await act(async () => {
        await result.current.handleDecision({
          goalId: 'goal-2',
          status: 'dismissed',
          note: '',
        });
      });

      expect(result.current.isSaving).toBe(false);
    });

    it('保存成功時に error は null', async () => {
      const summary = makeSummary();

      const { result } = renderHook(() =>
        useIspRecommendationDecisions(USER_ID, PERIOD, summary, DECIDED_BY),
      );

      await act(async () => {
        await result.current.handleDecision({
          goalId: 'goal-1',
          status: 'deferred',
          note: '次回確認',
        });
      });

      expect(result.current.error).toBeNull();
    });

    it('monitoringPeriod が undefined のとき handleDecision は何もしない', async () => {
      const summary = makeSummary();
      const saveSpy = vi.spyOn(repo, 'save');

      const { result } = renderHook(() =>
        useIspRecommendationDecisions(USER_ID, undefined, summary, DECIDED_BY),
      );

      await act(async () => {
        await result.current.handleDecision({
          goalId: 'goal-1',
          status: 'accepted',
          note: '',
        });
      });

      expect(saveSpy).not.toHaveBeenCalled();
    });

    it('recommendations が null のとき handleDecision は何もしない', async () => {
      const saveSpy = vi.spyOn(repo, 'save');

      const { result } = renderHook(() =>
        useIspRecommendationDecisions(USER_ID, PERIOD, null, DECIDED_BY),
      );

      await act(async () => {
        await result.current.handleDecision({
          goalId: 'goal-1',
          status: 'accepted',
          note: '',
        });
      });

      expect(saveSpy).not.toHaveBeenCalled();
    });

    it('存在しない goalId で handleDecision を呼んでも save されない', async () => {
      const summary = makeSummary();
      const saveSpy = vi.spyOn(repo, 'save');

      const { result } = renderHook(() =>
        useIspRecommendationDecisions(USER_ID, PERIOD, summary, DECIDED_BY),
      );

      await act(async () => {
        await result.current.handleDecision({
          goalId: 'goal-nonexistent',
          status: 'accepted',
          note: '',
        });
      });

      expect(saveSpy).not.toHaveBeenCalled();
    });

    it('保存されたレコードに正しい decidedBy / snapshot が含まれる', async () => {
      const summary = makeSummary();

      const { result } = renderHook(() =>
        useIspRecommendationDecisions(USER_ID, PERIOD, summary, DECIDED_BY),
      );

      await waitFor(() => {
        expect(result.current.decisionStatuses.get('goal-1')).toBe('pending');
      });

      await act(async () => {
        await result.current.handleDecision({
          goalId: 'goal-1',
          status: 'accepted',
          note: '',
        });
      });

      const allRecords = repo.getAll();
      expect(allRecords).toHaveLength(1);

      const record = allRecords[0];
      expect(record.decidedBy).toBe(DECIDED_BY);
      expect(record.userId).toBe(USER_ID);
      expect(record.monitoringPeriodFrom).toBe(PERIOD.from);
      expect(record.monitoringPeriodTo).toBe(PERIOD.to);
      expect(record.snapshot.level).toBe('adjust-support');
      expect(record.snapshot.rate).toBe(0.45);
    });

    it('連続で複数目標の判断を保存できる', async () => {
      const summary = makeSummary();

      const { result } = renderHook(() =>
        useIspRecommendationDecisions(USER_ID, PERIOD, summary, DECIDED_BY),
      );

      await waitFor(() => {
        expect(result.current.decisionStatuses.get('goal-1')).toBe('pending');
      });

      await act(async () => {
        await result.current.handleDecision({
          goalId: 'goal-1',
          status: 'accepted',
          note: '',
        });
      });
      await act(async () => {
        await result.current.handleDecision({
          goalId: 'goal-2',
          status: 'dismissed',
          note: '対応不要',
        });
      });
      await act(async () => {
        await result.current.handleDecision({
          goalId: 'goal-3',
          status: 'deferred',
          note: '',
        });
      });

      expect(result.current.decisionStatuses.get('goal-1')).toBe('accepted');
      expect(result.current.decisionStatuses.get('goal-2')).toBe('dismissed');
      expect(result.current.decisionStatuses.get('goal-3')).toBe('deferred');
      expect(result.current.decisionNotes.get('goal-2')).toBe('対応不要');
      expect(result.current.decisions).toHaveLength(3);
    });
  });

  // ─── 保存失敗 ────────────────────────────────────────

  describe('handleDecision — エラー', () => {
    it('repository.save が失敗したら error が立つ', async () => {
      const summary = makeSummary();

      vi.spyOn(repo, 'save').mockRejectedValueOnce(new Error('保存失敗'));

      const { result } = renderHook(() =>
        useIspRecommendationDecisions(USER_ID, PERIOD, summary, DECIDED_BY),
      );

      await waitFor(() => {
        expect(result.current.decisionStatuses.get('goal-1')).toBe('pending');
      });

      await act(async () => {
        await result.current.handleDecision({
          goalId: 'goal-1',
          status: 'accepted',
          note: '',
        });
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe('保存失敗');
      // 失敗時は decisions が更新されていない
      expect(result.current.decisionStatuses.get('goal-1')).toBe('pending');
    });

    it('保存失敗後も isSaving は false に戻る', async () => {
      const summary = makeSummary();

      vi.spyOn(repo, 'save').mockRejectedValueOnce(new Error('エラー'));

      const { result } = renderHook(() =>
        useIspRecommendationDecisions(USER_ID, PERIOD, summary, DECIDED_BY),
      );

      await act(async () => {
        await result.current.handleDecision({
          goalId: 'goal-1',
          status: 'accepted',
          note: '',
        });
      });

      expect(result.current.isSaving).toBe(false);
    });

    it('エラー後の再保存で error がクリアされる', async () => {
      const summary = makeSummary();

      const saveSpy = vi.spyOn(repo, 'save');
      saveSpy.mockRejectedValueOnce(new Error('1回目失敗'));

      const { result } = renderHook(() =>
        useIspRecommendationDecisions(USER_ID, PERIOD, summary, DECIDED_BY),
      );

      await waitFor(() => {
        expect(result.current.decisionStatuses.get('goal-1')).toBe('pending');
      });

      // 1回目: 失敗
      await act(async () => {
        await result.current.handleDecision({
          goalId: 'goal-1',
          status: 'accepted',
          note: '',
        });
      });
      expect(result.current.error).toBeInstanceOf(Error);

      // 2回目: spy を元に戻す（save が成功する）
      saveSpy.mockRestore();

      await act(async () => {
        await result.current.handleDecision({
          goalId: 'goal-1',
          status: 'accepted',
          note: '',
        });
      });

      expect(result.current.error).toBeNull();
      expect(result.current.decisionStatuses.get('goal-1')).toBe('accepted');
    });
  });

  // ─── props 変更時の再ロード ──────────────────────────

  describe('props 変更時の再ロード', () => {
    it('userId 変更で再ロードされる', async () => {
      // user-1 の判断を入れておく
      await repo.save({
        goalId: 'goal-1',
        userId: 'user-1',
        status: 'accepted',
        decidedBy: DECIDED_BY,
        decidedAt: '2026-03-15T10:00:00Z',
        note: '',
        snapshot: makeDecisionRecord().snapshot,
        monitoringPeriodFrom: PERIOD.from,
        monitoringPeriodTo: PERIOD.to,
      });
      // user-2 にはない
      const summary = makeSummary();

      const { result, rerender } = renderHook(
        ({ userId }: { userId: string }) =>
          useIspRecommendationDecisions(userId, PERIOD, summary, DECIDED_BY),
        { initialProps: { userId: 'user-1' } },
      );

      await waitFor(() => {
        expect(result.current.decisions).toHaveLength(1);
      });
      expect(result.current.decisionStatuses.get('goal-1')).toBe('accepted');

      // userId を変更
      rerender({ userId: 'user-2' });

      await waitFor(() => {
        expect(result.current.decisions).toHaveLength(0);
      });
      // user-2 には判断がないので pending
      expect(result.current.decisionStatuses.get('goal-1')).toBe('pending');
    });

    it('monitoringPeriod 変更で再ロードされる', async () => {
      const period1: MonitoringPeriod = { from: '2026-01-01', to: '2026-03-01' };
      const period2: MonitoringPeriod = { from: '2026-03-01', to: '2026-06-01' };

      // period1 にのみ判断を入れておく
      await repo.save({
        goalId: 'goal-1',
        userId: USER_ID,
        status: 'accepted',
        decidedBy: DECIDED_BY,
        decidedAt: '2026-02-15T10:00:00Z',
        note: '',
        snapshot: makeDecisionRecord().snapshot,
        monitoringPeriodFrom: period1.from,
        monitoringPeriodTo: period1.to,
      });

      const summary = makeSummary();

      const { result, rerender } = renderHook(
        ({ period }: { period: MonitoringPeriod }) =>
          useIspRecommendationDecisions(USER_ID, period, summary, DECIDED_BY),
        { initialProps: { period: period1 } },
      );

      await waitFor(() => {
        expect(result.current.decisions).toHaveLength(1);
      });
      expect(result.current.decisionStatuses.get('goal-1')).toBe('accepted');

      // period を変更
      rerender({ period: period2 });

      await waitFor(() => {
        expect(result.current.decisions).toHaveLength(0);
      });
      expect(result.current.decisionStatuses.get('goal-1')).toBe('pending');
    });
  });

  // ─── decisions 配列 ─────────────────────────────────

  describe('decisions 配列', () => {
    it('初期状態では空配列', () => {
      const summary = makeSummary();

      const { result } = renderHook(() =>
        useIspRecommendationDecisions('', PERIOD, summary, DECIDED_BY),
      );

      // 初期レンダリング時点では空
      expect(result.current.decisions).toEqual([]);
    });

    it('保存するたびに decisions に追加される', async () => {
      const summary = makeSummary();

      const { result } = renderHook(() =>
        useIspRecommendationDecisions(USER_ID, PERIOD, summary, DECIDED_BY),
      );

      await act(async () => {
        await result.current.handleDecision({
          goalId: 'goal-1',
          status: 'accepted',
          note: '',
        });
      });

      expect(result.current.decisions).toHaveLength(1);
      expect(result.current.decisions[0].goalId).toBe('goal-1');
      expect(result.current.decisions[0].status).toBe('accepted');
    });
  });
});

/**
 * nextStepBanner — ユニットテスト
 *
 * テスト構成:
 * 1. overview コンテキスト（全フェーズ）
 * 2. monitoring コンテキスト（シグナル有無）
 * 3. reassessment コンテキスト（未反映有無）
 * 4. planning コンテキスト（手順有無）
 * 5. ルール検証（CTA 1つ、hidden 制御）
 */
import { describe, it, expect } from 'vitest';
import {
  resolveNextStepBanner,
  type ResolveNextStepInput,
} from '../nextStepBanner';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function makeInput(overrides: Partial<ResolveNextStepInput> = {}): ResolveNextStepInput {
  return {
    phase: 'active_plan',
    context: 'overview',
    userId: 'u-1',
    planningSheetId: 'ps-1',
    hasMonitoringSignals: false,
    hasUnappliedReassessment: false,
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// 1. Overview コンテキスト
// ─────────────────────────────────────────────

describe('resolveNextStepBanner — overview', () => {
  it('monitoring_overdue → danger バナー表示', () => {
    const result = resolveNextStepBanner(
      makeInput({ phase: 'monitoring_overdue', context: 'overview' }),
    );

    expect(result.hidden).toBe(false);
    expect(result.tone).toBe('danger');
    expect(result.title).toContain('期限');
    expect(result.ctaLabel).toBe('モニタリングを実施');
    expect(result.href).toContain('tab=monitoring');
  });

  it('needs_reassessment → warning バナー表示', () => {
    const result = resolveNextStepBanner(
      makeInput({ phase: 'needs_reassessment', context: 'overview' }),
    );

    expect(result.hidden).toBe(false);
    expect(result.tone).toBe('warning');
    expect(result.ctaLabel).toBe('再評価を確認');
    expect(result.href).toContain('tab=reassessment');
  });

  it('needs_monitoring → warning バナー表示', () => {
    const result = resolveNextStepBanner(
      makeInput({ phase: 'needs_monitoring', context: 'overview' }),
    );

    expect(result.hidden).toBe(false);
    expect(result.tone).toBe('warning');
    expect(result.ctaLabel).toBe('モニタリングを確認');
  });

  it('needs_plan → info バナー表示', () => {
    const result = resolveNextStepBanner(
      makeInput({ phase: 'needs_plan', context: 'overview' }),
    );

    expect(result.hidden).toBe(false);
    expect(result.tone).toBe('info');
    expect(result.ctaLabel).toBe('支援設計を続ける');
    expect(result.href).toContain('tab=planning');
  });

  it('needs_assessment → info バナー表示', () => {
    const result = resolveNextStepBanner(
      makeInput({ phase: 'needs_assessment', context: 'overview' }),
    );

    expect(result.hidden).toBe(false);
    expect(result.ctaLabel).toBe('計画シートを新規作成');
    expect(result.href).toBe('/support-planning-sheet/new');
  });

  it('active_plan → hidden', () => {
    const result = resolveNextStepBanner(
      makeInput({ phase: 'active_plan', context: 'overview' }),
    );

    expect(result.hidden).toBe(true);
  });
});

// ─────────────────────────────────────────────
// 2. Monitoring コンテキスト
// ─────────────────────────────────────────────

describe('resolveNextStepBanner — monitoring', () => {
  it('シグナルあり → warning「再評価に反映」', () => {
    const result = resolveNextStepBanner(
      makeInput({
        context: 'monitoring',
        hasMonitoringSignals: true,
      }),
    );

    expect(result.hidden).toBe(false);
    expect(result.tone).toBe('warning');
    expect(result.title).toContain('見直し候補');
    expect(result.ctaLabel).toBe('再評価に反映');
    expect(result.href).toContain('tab=reassessment');
  });

  it('シグナルなし → success「再評価を確認」', () => {
    const result = resolveNextStepBanner(
      makeInput({
        context: 'monitoring',
        hasMonitoringSignals: false,
      }),
    );

    expect(result.hidden).toBe(false);
    expect(result.tone).toBe('success');
    expect(result.ctaLabel).toBe('再評価を確認');
  });
});

// ─────────────────────────────────────────────
// 3. Reassessment コンテキスト
// ─────────────────────────────────────────────

describe('resolveNextStepBanner — reassessment', () => {
  it('未反映あり → warning「計画を更新」', () => {
    const result = resolveNextStepBanner(
      makeInput({
        context: 'reassessment',
        hasUnappliedReassessment: true,
      }),
    );

    expect(result.hidden).toBe(false);
    expect(result.tone).toBe('warning');
    expect(result.title).toContain('計画を更新');
    expect(result.ctaLabel).toBe('計画を更新');
    expect(result.href).toContain('tab=planning');
  });

  it('未反映なし → info「反映内容を確認」', () => {
    const result = resolveNextStepBanner(
      makeInput({
        context: 'reassessment',
        hasUnappliedReassessment: false,
      }),
    );

    expect(result.hidden).toBe(false);
    expect(result.tone).toBe('info');
    expect(result.ctaLabel).toBe('反映内容を確認');
  });
});

// ─────────────────────────────────────────────
// 4. Planning コンテキスト
// ─────────────────────────────────────────────

describe('resolveNextStepBanner — planning', () => {
  it('needs_plan → info「手順を追加」', () => {
    const result = resolveNextStepBanner(
      makeInput({
        phase: 'needs_plan',
        context: 'planning',
      }),
    );

    expect(result.hidden).toBe(false);
    expect(result.tone).toBe('info');
    expect(result.ctaLabel).toBe('手順を追加');
  });

  it('active_plan → success「Dailyで確認」', () => {
    const result = resolveNextStepBanner(
      makeInput({
        phase: 'active_plan',
        context: 'planning',
      }),
    );

    expect(result.hidden).toBe(false);
    expect(result.tone).toBe('success');
    expect(result.ctaLabel).toBe('Dailyで確認');
    expect(result.href).toContain('userId=u-1');
  });
});

// ─────────────────────────────────────────────
// 5. ルール検証
// ─────────────────────────────────────────────

describe('resolveNextStepBanner — ルール', () => {
  it('CTA は必ず1つ（ctaLabel が非空文字列）', () => {
    const contexts: ResolveNextStepInput['context'][] = ['overview', 'monitoring', 'reassessment', 'planning'];
    const phases: ResolveNextStepInput['phase'][] = [
      'needs_assessment', 'needs_plan', 'active_plan',
      'needs_monitoring', 'monitoring_overdue', 'needs_reassessment',
    ];

    for (const context of contexts) {
      for (const phase of phases) {
        const result = resolveNextStepBanner(makeInput({ context, phase }));
        if (!result.hidden) {
          expect(result.ctaLabel.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('hidden バナーの title/description/ctaLabel は空', () => {
    const result = resolveNextStepBanner(
      makeInput({ phase: 'active_plan', context: 'overview' }),
    );

    expect(result.hidden).toBe(true);
    expect(result.title).toBe('');
    expect(result.description).toBe('');
    expect(result.ctaLabel).toBe('');
  });

  it('planningSheetId が href に埋め込まれる', () => {
    const result = resolveNextStepBanner(
      makeInput({
        phase: 'monitoring_overdue',
        context: 'overview',
        planningSheetId: 'ps-test-123',
      }),
    );

    expect(result.href).toContain('ps-test-123');
  });

  it('不明な context は hidden を返す', () => {
    const result = resolveNextStepBanner(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeInput({ context: 'unknown' as ResolveNextStepInput['context'] }),
    );

    expect(result.hidden).toBe(true);
  });
});

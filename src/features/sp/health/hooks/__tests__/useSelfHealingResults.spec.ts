import { describe, expect, it } from 'vitest';
import { extractNightlyDecisionContext } from '../useSelfHealingResults';

describe('extractNightlyDecisionContext', () => {
  it('extracts decision actions from runtime-summary decisionContext', () => {
    const context = extractNightlyDecisionContext({
      decisionContext: {
        date: '2026-04-22',
        finalLabel: 'action_required',
        sourceFile: 'docs/nightly-patrol/decision-2026-04-22.json',
        reasonCodeActions: {
          fail: [
            {
              code: 'PATROL_NEEDS_REVIEW',
              normalizedCode: 'PATROL_NEEDS_REVIEW',
              owner: 'Platform Owner',
              severity: 'action_required',
              firstAction: 'Fail Trigger を順に割り当てる',
              runbookLink: 'docs/nightly-patrol/PRODUCTION-GO-LIVE.md#rc-patrol',
            },
          ],
          warn: [],
        },
      },
    });

    expect(context).not.toBeNull();
    expect(context?.date).toBe('2026-04-22');
    expect(context?.finalLabel).toBe('action_required');
    expect(context?.actions).toHaveLength(1);
    expect(context?.actions[0]).toEqual(
      expect.objectContaining({
        bucket: 'fail',
        code: 'PATROL_NEEDS_REVIEW',
        owner: 'Platform Owner',
        severity: 'action_required',
      }),
    );
  });

  it('supports decision-json shape with runbook.reasonCodeActions', () => {
    const context = extractNightlyDecisionContext({
      date: '2026-04-21',
      final: { label: 'watch' },
      runbook: {
        reasonCodeActions: {
          fail: [],
          warn: [
            {
              code: 'ADMIN_STATUS_SUMMARY_MISSING',
              owner: 'Ops On-call',
              severity: 'watch',
              firstAction: 'integration-diagnose のログを開く',
              runbookLink: 'docs/nightly-patrol/PRODUCTION-GO-LIVE.md#rc-admin-status',
            },
          ],
        },
      },
    });

    expect(context).not.toBeNull();
    expect(context?.date).toBe('2026-04-21');
    expect(context?.finalLabel).toBe('watch');
    expect(context?.actions).toHaveLength(1);
    expect(context?.actions[0]?.bucket).toBe('warn');
  });

  it('returns null when required action fields are missing', () => {
    const context = extractNightlyDecisionContext({
      runbook: {
        reasonCodeActions: {
          fail: [{ code: 'BROKEN' }],
          warn: [],
        },
      },
    });

    expect(context).toBeNull();
  });
});

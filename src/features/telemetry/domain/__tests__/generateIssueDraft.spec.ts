import { describe, it, expect } from 'vitest';
import { generateIssueDraft } from '../generateIssueDraft';
import type { KpiAlert } from '../computeCtaKpiDiff';
import type { PlaybookEntry } from '../alertPlaybook';

// ── helpers ─────────────────────────────────────────────────────────────────

const mkAlert = (overrides: Partial<KpiAlert> = {}): KpiAlert => ({
  id: 'hero-rate-low',
  severity: 'warning',
  label: 'Hero 利用率低下',
  message: 'Hero 利用率が 60% です（閾値: 70%）。',
  value: 60,
  threshold: 70,
  ...overrides,
});

const mkPlaybook = (overrides: Partial<PlaybookEntry> = {}): PlaybookEntry => ({
  alertId: 'hero-rate-low',
  causes: ['原因A', '原因B'],
  checkpoints: ['確認点1', '確認点2'],
  relatedScreens: [{ label: 'Today', path: '/today' }],
  issueTemplate: { title: '[改善] Hero 利用率が閾値を下回っている', labels: ['ux', 'telemetry'] },
  ...overrides,
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe('generateIssueDraft', () => {
  it('title と labels を PlaybookEntry から取得', () => {
    const draft = generateIssueDraft(mkAlert(), mkPlaybook());
    expect(draft.title).toBe('[改善] Hero 利用率が閾値を下回っている');
    expect(draft.labels).toEqual(['ux', 'telemetry']);
  });

  it('body に指標値と閾値が含まれる', () => {
    const draft = generateIssueDraft(mkAlert({ value: 55, threshold: 70 }), mkPlaybook());
    expect(draft.body).toContain('55%');
    expect(draft.body).toContain('70%');
  });

  it('body に想定原因が含まれる', () => {
    const draft = generateIssueDraft(mkAlert(), mkPlaybook());
    expect(draft.body).toContain('原因A');
    expect(draft.body).toContain('原因B');
  });

  it('body に確認ポイントがチェックリスト形式で含まれる', () => {
    const draft = generateIssueDraft(mkAlert(), mkPlaybook());
    expect(draft.body).toContain('- [ ] 確認点1');
    expect(draft.body).toContain('- [ ] 確認点2');
  });

  it('body に関連画面のパスが含まれる', () => {
    const draft = generateIssueDraft(mkAlert(), mkPlaybook());
    expect(draft.body).toContain('/today');
    expect(draft.body).toContain('Today');
  });

  it('critical の場合は 🔴 emoji が含まれる', () => {
    const draft = generateIssueDraft(mkAlert({ severity: 'critical' }), mkPlaybook());
    expect(draft.body).toContain('🔴');
    expect(draft.body).toContain('Critical');
  });

  it('warning の場合は 🟡 emoji が含まれる', () => {
    const draft = generateIssueDraft(mkAlert({ severity: 'warning' }), mkPlaybook());
    expect(draft.body).toContain('🟡');
    expect(draft.body).toContain('Warning');
  });

  it('body にアラートの message が含まれる', () => {
    const msg = 'カスタムメッセージです。';
    const draft = generateIssueDraft(mkAlert({ message: msg }), mkPlaybook());
    expect(draft.body).toContain(msg);
  });
});

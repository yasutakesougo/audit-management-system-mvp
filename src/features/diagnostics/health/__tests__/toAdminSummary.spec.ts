import { describe, expect, it } from 'vitest';
import { toAdminSummary } from '../toAdminSummary';
import type { HealthReport } from '../types';

// ── ヘルパー ───────────────────────────────────────────────────

const mkReport = (overrides: Partial<HealthReport> = {}): HealthReport => ({
  overall: 'pass',
  counts: { pass: 10, warn: 0, fail: 0 },
  generatedAt: '2026-03-15T10:00:00+09:00',
  results: [],
  byCategory: {
    config: { overall: 'pass', counts: { pass: 10, warn: 0, fail: 0 } },
    auth: { overall: 'pass', counts: { pass: 0, warn: 0, fail: 0 } },
    connectivity: { overall: 'pass', counts: { pass: 0, warn: 0, fail: 0 } },
    lists: { overall: 'pass', counts: { pass: 0, warn: 0, fail: 0 } },
    schema: { overall: 'pass', counts: { pass: 0, warn: 0, fail: 0 } },
    permissions: { overall: 'pass', counts: { pass: 0, warn: 0, fail: 0 } },
  },
  ...overrides,
});

// ── 全体構造 ───────────────────────────────────────────────────

describe('toAdminSummary', () => {
  it('always starts with 【Iceberg-PDCA 環境診断】', () => {
    const summary = toAdminSummary(mkReport());
    expect(summary).toMatch(/^【Iceberg-PDCA 環境診断】/);
  });

  it('includes generatedAt', () => {
    const summary = toAdminSummary(mkReport());
    expect(summary).toContain('2026-03-15T10:00:00+09:00');
  });

  it('includes counts in header', () => {
    const summary = toAdminSummary(mkReport({ counts: { pass: 8, warn: 1, fail: 1 } }));
    expect(summary).toContain('PASS:8');
    expect(summary).toContain('WARN:1');
    expect(summary).toContain('FAIL:1');
  });
});

// ── PASS パターン ──────────────────────────────────────────────

describe('toAdminSummary — PASS', () => {
  it('shows ✅ PASS emoji and icon', () => {
    const summary = toAdminSummary(mkReport({ overall: 'pass' }));
    expect(summary).toContain('✅ PASS');
  });

  it('includes setup completion message', () => {
    const summary = toAdminSummary(mkReport({ overall: 'pass' }));
    expect(summary).toContain('環境セットアップ完了');
  });

  it('includes next step guidance', () => {
    const summary = toAdminSummary(mkReport({ overall: 'pass' }));
    expect(summary).toContain('ログイン確認を実施');
  });

  it('includes Delete WARN footnote', () => {
    const summary = toAdminSummary(mkReport({ overall: 'pass' }));
    expect(summary).toContain('Delete が WARN');
  });
});

// ── WARN パターン ──────────────────────────────────────────────

describe('toAdminSummary — WARN', () => {
  it('shows 🟡 WARN emoji', () => {
    const summary = toAdminSummary(mkReport({
      overall: 'warn',
      counts: { pass: 9, warn: 1, fail: 0 },
    }));
    expect(summary).toContain('🟡 WARN');
  });

  it('includes 要対応 section', () => {
    const summary = toAdminSummary(mkReport({
      overall: 'warn',
      counts: { pass: 9, warn: 1, fail: 0 },
    }));
    expect(summary).toContain('要対応');
  });

  it('lists issue summaries (max 5)', () => {
    const results = Array.from({ length: 7 }, (_, i) => ({
      key: `test.${i}`,
      label: `テスト${i}`,
      category: 'config' as const,
      status: 'warn' as const,
      summary: `問題${i}`,
      nextActions: [],
    }));
    const summary = toAdminSummary(mkReport({
      overall: 'warn',
      counts: { pass: 3, warn: 7, fail: 0 },
      results,
    }));
    // Should show at most 5 issues
    const issueLines = summary.split('\n').filter(l => l.startsWith('- WARN'));
    expect(issueLines.length).toBeLessThanOrEqual(5);
  });

  it('includes admin and field guidance', () => {
    const summary = toAdminSummary(mkReport({
      overall: 'warn',
      counts: { pass: 9, warn: 1, fail: 0 },
    }));
    expect(summary).toContain('管理者へ');
    expect(summary).toContain('現場へ');
  });
});

// ── FAIL パターン ──────────────────────────────────────────────

describe('toAdminSummary — FAIL', () => {
  it('shows 🔴 FAIL emoji', () => {
    const summary = toAdminSummary(mkReport({
      overall: 'fail',
      counts: { pass: 8, warn: 0, fail: 2 },
    }));
    expect(summary).toContain('🔴 FAIL');
  });

  it('includes admin action section', () => {
    const summary = toAdminSummary(mkReport({
      overall: 'fail',
      counts: { pass: 8, warn: 0, fail: 2 },
    }));
    expect(summary).toContain('まず管理者がやること');
  });

  it('shows FAIL issues first', () => {
    const results = [
      {
        key: 'auth.fail',
        label: '認証失敗',
        category: 'auth' as const,
        status: 'fail' as const,
        summary: '認証に失敗',
        nextActions: [],
      },
      {
        key: 'config.warn',
        label: '設定警告',
        category: 'config' as const,
        status: 'warn' as const,
        summary: '設定不備',
        nextActions: [],
      },
    ];
    const summary = toAdminSummary(mkReport({
      overall: 'fail',
      counts: { pass: 8, warn: 1, fail: 1 },
      results,
    }));
    const issueLines = summary.split('\n').filter(l => l.startsWith('- '));
    expect(issueLines[0]).toContain('FAIL');
  });
});

// ── エッジケース ───────────────────────────────────────────────

describe('toAdminSummary — edge cases', () => {
  it('handles missing counts gracefully', () => {
    const report = { ...mkReport(), counts: undefined } as unknown as HealthReport;
    const summary = toAdminSummary(report);
    expect(summary).toContain('PASS:0');
  });

  it('handles empty results array', () => {
    const summary = toAdminSummary(mkReport({
      overall: 'warn',
      counts: { pass: 0, warn: 1, fail: 0 },
      results: [],
    }));
    expect(summary).toContain('WARN が検出されています');
  });

  it('includes nextAction label in issue summary', () => {
    const results = [{
      key: 'test.action',
      label: 'テスト',
      category: 'config' as const,
      status: 'warn' as const,
      summary: '問題あり',
      nextActions: [{ kind: 'doc' as const, label: '修正手順', value: 'docs/fix.md' }],
    }];
    const summary = toAdminSummary(mkReport({
      overall: 'warn',
      counts: { pass: 9, warn: 1, fail: 0 },
      results,
    }));
    expect(summary).toContain('修正手順');
  });
});

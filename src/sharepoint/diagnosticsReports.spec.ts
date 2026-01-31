/**
 * shouldResetNotified 単体テスト
 * - Notified フラグの制御ロジックを検証
 */

import { describe, it, expect } from 'vitest';
import {
  shouldResetNotified,
  type DiagnosticsReportInput,
  type DiagnosticsReportItem,
} from './diagnosticsReports';

describe('shouldResetNotified', () => {
  // ─────────────────────────────────────────────────────────────
  // 初回作成（prev === null）
  // ─────────────────────────────────────────────────────────────

  describe('初回作成（prev === null）', () => {
    it('overall=fail の場合、Notified = false (Flow が拾う)', () => {
      const next: DiagnosticsReportInput = {
        title: 'health:https://test.sharepoint.com',
        overall: 'fail',
      };
      expect(shouldResetNotified(null, next)).toBe(false);
    });

    it('overall=warn の場合、Notified = false (Flow が拾う)', () => {
      const next: DiagnosticsReportInput = {
        title: 'health:https://test.sharepoint.com',
        overall: 'warn',
      };
      expect(shouldResetNotified(null, next)).toBe(false);
    });

    it('overall=pass の場合、Notified = true (Flow が拾わない)', () => {
      const next: DiagnosticsReportInput = {
        title: 'health:https://test.sharepoint.com',
        overall: 'pass',
      };
      expect(shouldResetNotified(null, next)).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 更新時：Overall が変わった
  // ─────────────────────────────────────────────────────────────

  describe('更新時：Overall が変わった', () => {
    it('pass → fail：Notified = false (再通知)', () => {
      const prev: DiagnosticsReportItem = {
        Id: 1,
        Title: 'health:https://test.sharepoint.com',
        Overall: { Value: 'pass' },
        Notified: true,
        Created: '2026-01-25T00:00:00Z',
        Modified: '2026-01-25T00:00:00Z',
      };
      const next: DiagnosticsReportInput = {
        title: 'health:https://test.sharepoint.com',
        overall: 'fail',
      };
      expect(shouldResetNotified(prev, next)).toBe(false);
    });

    it('warn → pass：Notified = true (通知不要)', () => {
      const prev: DiagnosticsReportItem = {
        Id: 1,
        Title: 'health:https://test.sharepoint.com',
        Overall: { Value: 'warn' },
        Notified: false,
        Created: '2026-01-25T00:00:00Z',
        Modified: '2026-01-25T00:00:00Z',
      };
      const next: DiagnosticsReportInput = {
        title: 'health:https://test.sharepoint.com',
        overall: 'pass',
      };
      expect(shouldResetNotified(prev, next)).toBe(true);
    });

    it('fail → warn：Notified = false (再通知)', () => {
      const prev: DiagnosticsReportItem = {
        Id: 1,
        Title: 'health:https://test.sharepoint.com',
        Overall: { Value: 'fail' },
        Notified: true,
        Created: '2026-01-25T00:00:00Z',
        Modified: '2026-01-25T00:00:00Z',
      };
      const next: DiagnosticsReportInput = {
        title: 'health:https://test.sharepoint.com',
        overall: 'warn',
      };
      expect(shouldResetNotified(prev, next)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 更新時：Overall は変わらず、TopIssue が変わった
  // ─────────────────────────────────────────────────────────────

  describe('更新時：TopIssue が変わった', () => {
    it('TopIssue が新規 → Notified = false (再通知)', () => {
      const prev: DiagnosticsReportItem = {
        Id: 1,
        Title: 'health:https://test.sharepoint.com',
        Overall: { Value: 'fail' },
        TopIssue: 'Config: Missing env',
        Notified: true,
        Created: '2026-01-25T00:00:00Z',
        Modified: '2026-01-25T00:00:00Z',
      };
      const next: DiagnosticsReportInput = {
        title: 'health:https://test.sharepoint.com',
        overall: 'fail',
        topIssue: 'Auth: Token expired',
      };
      expect(shouldResetNotified(prev, next)).toBe(false);
    });

    it('TopIssue が削除 → Notified = false (再通知)', () => {
      const prev: DiagnosticsReportItem = {
        Id: 1,
        Title: 'health:https://test.sharepoint.com',
        Overall: { Value: 'fail' },
        TopIssue: 'Config: Missing env',
        Notified: true,
        Created: '2026-01-25T00:00:00Z',
        Modified: '2026-01-25T00:00:00Z',
      };
      const next: DiagnosticsReportInput = {
        title: 'health:https://test.sharepoint.com',
        overall: 'fail',
        topIssue: null,
      };
      expect(shouldResetNotified(prev, next)).toBe(false);
    });

    it('TopIssue が同じ & overall が fail → Notified = undefined (変更なし)', () => {
      const prev: DiagnosticsReportItem = {
        Id: 1,
        Title: 'health:https://test.sharepoint.com',
        Overall: { Value: 'fail' },
        TopIssue: 'Config: Missing env',
        Notified: false,
        Created: '2026-01-25T00:00:00Z',
        Modified: '2026-01-25T00:00:00Z',
      };
      const next: DiagnosticsReportInput = {
        title: 'health:https://test.sharepoint.com',
        overall: 'fail',
        topIssue: 'Config: Missing env',
      };
      expect(shouldResetNotified(prev, next)).toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 更新時：Overall は変わらず、SummaryText が変わった
  // ─────────────────────────────────────────────────────────────

  describe('更新時：SummaryText が変わった', () => {
    it('SummaryText が新規 → Notified = false (再通知)', () => {
      const prev: DiagnosticsReportItem = {
        Id: 1,
        Title: 'health:https://test.sharepoint.com',
        Overall: { Value: 'warn' },
        SummaryText: 'PASS: 5, WARN: 2, FAIL: 0',
        Notified: true,
        Created: '2026-01-25T00:00:00Z',
        Modified: '2026-01-25T00:00:00Z',
      };
      const next: DiagnosticsReportInput = {
        title: 'health:https://test.sharepoint.com',
        overall: 'warn',
        summaryText: 'PASS: 4, WARN: 3, FAIL: 0',
      };
      expect(shouldResetNotified(prev, next)).toBe(false);
    });

    it('SummaryText が削除 → Notified = false (再通知)', () => {
      const prev: DiagnosticsReportItem = {
        Id: 1,
        Title: 'health:https://test.sharepoint.com',
        Overall: { Value: 'warn' },
        SummaryText: 'PASS: 5, WARN: 2, FAIL: 0',
        Notified: true,
        Created: '2026-01-25T00:00:00Z',
        Modified: '2026-01-25T00:00:00Z',
      };
      const next: DiagnosticsReportInput = {
        title: 'health:https://test.sharepoint.com',
        overall: 'warn',
        summaryText: null,
      };
      expect(shouldResetNotified(prev, next)).toBe(false);
    });

    it('SummaryText が同じ & overall が warn → Notified = undefined (変更なし)', () => {
      const prev: DiagnosticsReportItem = {
        Id: 1,
        Title: 'health:https://test.sharepoint.com',
        Overall: { Value: 'warn' },
        SummaryText: 'PASS: 5, WARN: 2, FAIL: 0',
        Notified: false,
        Created: '2026-01-25T00:00:00Z',
        Modified: '2026-01-25T00:00:00Z',
      };
      const next: DiagnosticsReportInput = {
        title: 'health:https://test.sharepoint.com',
        overall: 'warn',
        summaryText: 'PASS: 5, WARN: 2, FAIL: 0',
      };
      expect(shouldResetNotified(prev, next)).toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 更新時：Overall・TopIssue・SummaryText すべて同じ
  // ─────────────────────────────────────────────────────────────

  describe('更新時：すべて同じ（Notified を保持）', () => {
    it('Notified=true のまま保持（undefined返却）', () => {
      const prev: DiagnosticsReportItem = {
        Id: 1,
        Title: 'health:https://test.sharepoint.com',
        Overall: { Value: 'pass' },
        TopIssue: null,
        SummaryText: 'PASS: 10, WARN: 0, FAIL: 0',
        Notified: true,
        Created: '2026-01-25T00:00:00Z',
        Modified: '2026-01-25T00:00:00Z',
      };
      const next: DiagnosticsReportInput = {
        title: 'health:https://test.sharepoint.com',
        overall: 'pass',
        topIssue: null,
        summaryText: 'PASS: 10, WARN: 0, FAIL: 0',
      };
      expect(shouldResetNotified(prev, next)).toBeUndefined();
    });

    it('Notified=false のまま保持（undefined返却）', () => {
      const prev: DiagnosticsReportItem = {
        Id: 1,
        Title: 'health:https://test.sharepoint.com',
        Overall: { Value: 'fail' },
        TopIssue: 'Auth: Token',
        SummaryText: 'PASS: 5, WARN: 1, FAIL: 4',
        Notified: false,
        Created: '2026-01-25T00:00:00Z',
        Modified: '2026-01-25T00:00:00Z',
      };
      const next: DiagnosticsReportInput = {
        title: 'health:https://test.sharepoint.com',
        overall: 'fail',
        topIssue: 'Auth: Token',
        summaryText: 'PASS: 5, WARN: 1, FAIL: 4',
      };
      expect(shouldResetNotified(prev, next)).toBeUndefined();
    });

    it('ReportLink が変わっても内容が同じなら Notified を変更しない', () => {
      const prev: DiagnosticsReportItem = {
        Id: 1,
        Title: 'health:https://test.sharepoint.com',
        Overall: { Value: 'warn' },
        TopIssue: 'Config',
        SummaryText: 'PASS: 5, WARN: 2, FAIL: 0',
        ReportLink: 'https://app.com/diag/1',
        Notified: false,
        Created: '2026-01-25T00:00:00Z',
        Modified: '2026-01-25T00:00:00Z',
      };
      const next: DiagnosticsReportInput = {
        title: 'health:https://test.sharepoint.com',
        overall: 'warn',
        topIssue: 'Config',
        summaryText: 'PASS: 5, WARN: 2, FAIL: 0',
        reportLink: 'https://app.com/diag/2',
      };
      expect(shouldResetNotified(prev, next)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // エッジケース：Choice フィールド形式
  // ─────────────────────────────────────────────────────────────

  describe('エッジケース：Choice フィールド形式', () => {
    it('Overall が文字列形式（SharePoint返却）の場合、正規化して比較 → undefined', () => {
      const prev: DiagnosticsReportItem = {
        Id: 1,
        Title: 'health:https://test.sharepoint.com',
        Overall: 'fail' as unknown as { Value: 'fail' },
        TopIssue: 'Config',
        Notified: false,
        Created: '2026-01-25T00:00:00Z',
        Modified: '2026-01-25T00:00:00Z',
      };
      const next: DiagnosticsReportInput = {
        title: 'health:https://test.sharepoint.com',
        overall: 'fail',
        topIssue: 'Config',
      };
      expect(shouldResetNotified(prev, next)).toBeUndefined();
    });

    it('Overall が { Value: "..." } 形式の場合、正規化して比較 → undefined', () => {
      const prev: DiagnosticsReportItem = {
        Id: 1,
        Title: 'health:https://test.sharepoint.com',
        Overall: { Value: 'warn' },
        TopIssue: 'Config',
        Notified: false,
        Created: '2026-01-25T00:00:00Z',
        Modified: '2026-01-25T00:00:00Z',
      };
      const next: DiagnosticsReportInput = {
        title: 'health:https://test.sharepoint.com',
        overall: 'warn',
        topIssue: 'Config',
      };
      expect(shouldResetNotified(prev, next)).toBeUndefined();
    });

    it('Overall が変わった（文字列 → { Value: "..." }） → false', () => {
      const prev: DiagnosticsReportItem = {
        Id: 1,
        Title: 'health:https://test.sharepoint.com',
        Overall: 'pass' as unknown as { Value: 'pass' },
        Notified: true,
        Created: '2026-01-25T00:00:00Z',
        Modified: '2026-01-25T00:00:00Z',
      };
      const next: DiagnosticsReportInput = {
        title: 'health:https://test.sharepoint.com',
        overall: 'fail',
      };
      expect(shouldResetNotified(prev, next)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 複合ケース：複数フィールドが同時に変わった
  // ─────────────────────────────────────────────────────────────

  describe('複合ケース：複数フィールドが同時に変わった', () => {
    it('Overall と TopIssue が両方変わった(pass→fail) → Notified = false', () => {
      const prev: DiagnosticsReportItem = {
        Id: 1,
        Title: 'health:https://test.sharepoint.com',
        Overall: { Value: 'pass' },
        TopIssue: 'Config: Old',
        Notified: true,
        Created: '2026-01-25T00:00:00Z',
        Modified: '2026-01-25T00:00:00Z',
      };
      const next: DiagnosticsReportInput = {
        title: 'health:https://test.sharepoint.com',
        overall: 'fail',
        topIssue: 'Auth: New',
      };
      expect(shouldResetNotified(prev, next)).toBe(false);
    });

    it('TopIssue と SummaryText が両方変わった(fail継続) → Notified = false', () => {
      const prev: DiagnosticsReportItem = {
        Id: 1,
        Title: 'health:https://test.sharepoint.com',
        Overall: { Value: 'fail' },
        TopIssue: 'Config: Old',
        SummaryText: 'PASS: 5, WARN: 1, FAIL: 4',
        Notified: true,
        Created: '2026-01-25T00:00:00Z',
        Modified: '2026-01-25T00:00:00Z',
      };
      const next: DiagnosticsReportInput = {
        title: 'health:https://test.sharepoint.com',
        overall: 'fail',
        topIssue: 'Auth: New',
        summaryText: 'PASS: 3, WARN: 0, FAIL: 7',
      };
      expect(shouldResetNotified(prev, next)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Null / Undefined 安全性
  // ─────────────────────────────────────────────────────────────

  describe('Null / Undefined 安全性', () => {
    it('prev の TopIssue が undefined の場合、null として扱う → undefined', () => {
      const prev: DiagnosticsReportItem = {
        Id: 1,
        Title: 'health:https://test.sharepoint.com',
        Overall: { Value: 'fail' },
        // TopIssue は undefined
        Notified: false,
        Created: '2026-01-25T00:00:00Z',
        Modified: '2026-01-25T00:00:00Z',
      };
      const next: DiagnosticsReportInput = {
        title: 'health:https://test.sharepoint.com',
        overall: 'fail',
        topIssue: null,
      };
      expect(shouldResetNotified(prev, next)).toBeUndefined();
    });

    it('next の TopIssue が undefined の場合、null として扱う → false', () => {
      const prev: DiagnosticsReportItem = {
        Id: 1,
        Title: 'health:https://test.sharepoint.com',
        Overall: { Value: 'fail' },
        TopIssue: 'Config',
        Notified: false,
        Created: '2026-01-25T00:00:00Z',
        Modified: '2026-01-25T00:00:00Z',
      };
      const next: DiagnosticsReportInput = {
        title: 'health:https://test.sharepoint.com',
        overall: 'fail',
        topIssue: undefined,
      };
      expect(shouldResetNotified(prev, next)).toBe(false);
    });
  });
});

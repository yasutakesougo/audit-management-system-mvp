/**
 * Health Diagnostics → SharePoint Upsert 統合
 * - 診断結果を HealthReport から DiagnosticsReportInput に変換
 * - SharePoint Diagnostics_Reports リストに記録
 * - フィールド定義は src/sharepoint/fields.ts の FIELD_MAP_DIAGNOSTICS_REPORTS から参照
 */

import type { HealthReport } from '@/features/diagnostics/health/types';
import type { UseSP } from '@/lib/spClient';
import {
  upsertDiagnosticsReport,
  type DiagnosticsReportInput,
  type DiagnosticsReportStatus,
} from '@/sharepoint/diagnosticsReports';

/**
 * HealthReport を DiagnosticsReportInput に変換
 * - overall → overall（直下）
 * - topIssue: 最初の FAIL or WARN を抽出
 * - summaryText: counts + categories のサマリー
 * - reportLink: null（フロント後付け可能）
 */
function healthReportToDiagnosticsInput(
  report: HealthReport,
  siteUrl: string
): DiagnosticsReportInput {
  // Title: 一意キー（site別に分離）
  const title = `health:${siteUrl}`;

  // overall
  const overall = report.overall as DiagnosticsReportStatus;

  // topIssue: 最初の FAIL、なければ WARN を抽出
  let topIssue: string | undefined;
  const firstFail = report.results.find((r) => r.status === 'fail');
  const firstWarn = report.results.find((r) => r.status === 'warn');
  if (firstFail) {
    topIssue = firstFail.label;
  } else if (firstWarn) {
    topIssue = firstWarn.label;
  }

  // summaryText: counts + categories の簡潔なサマリー
  const counts = report.counts;
  const categoryLines = Object.entries(report.byCategory)
    .filter(([, cat]) => cat.overall !== 'pass')
    .map(([name, cat]) => {
      const fails = cat.counts.fail || 0;
      const warns = cat.counts.warn || 0;
      const parts = [];
      if (fails > 0) parts.push(`FAIL×${fails}`);
      if (warns > 0) parts.push(`WARN×${warns}`);
      return `  ${name}: ${parts.join(', ')}`;
    });

  const summaryLines: string[] = [
    `PASS: ${counts.pass}, WARN: ${counts.warn}, FAIL: ${counts.fail}`,
  ];
  if (categoryLines.length > 0) {
    summaryLines.push('Categories:');
    summaryLines.push(...categoryLines);
  }

  return {
    title,
    overall,
    topIssue: topIssue || null,
    summaryText: summaryLines.join('\n'),
    reportLink: null,
    notified: false,
  };
}

/**
 * 健康診断結果をSharePointに記録
 * - HealthReport 生成 → DiagnosticsReportInput 変換 → upsert
 *
 * @param sp SharePoint クライアント（useSP）
 * @param healthReport 診断結果
 * @param siteUrl SharePoint サイトURL（Title生成用）
 * @returns SharePointに記録したアイテムまたはnull
 */
export async function recordHealthDiagnostics(
  sp: UseSP,
  healthReport: HealthReport,
  siteUrl: string
) {
  try {
    const input = healthReportToDiagnosticsInput(healthReport, siteUrl);

    console.info('[health] recording diagnostics start', {
      siteUrl,
      overall: input.overall,
      topIssue: input.topIssue,
    });

    const result = await upsertDiagnosticsReport(sp, input);

    console.info('[health] recording diagnostics success', {
      id: result?.Id,
      siteUrl,
      overall: result?.Overall,
    });

    return result;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[health] recording diagnostics failed', {
      siteUrl,
      error: msg,
    });
    throw error;
  }
}

/**
 * 複数のHealthReportを一括記録（e.g. 全サイト診断）
 */
export async function recordHealthDiagnosticsBatch(
  sp: UseSP,
  reports: Array<{ healthReport: HealthReport; siteUrl: string }>
) {
  const results = [];
  const failures = [];

  for (const { healthReport, siteUrl } of reports) {
    try {
      const result = await recordHealthDiagnostics(sp, healthReport, siteUrl);
      results.push(result);
    } catch (error) {
      failures.push({
        siteUrl,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  if (failures.length > 0) {
    console.warn('[health] recording diagnostics batch partial error', {
      total: reports.length,
      succeeded: results.length,
      failed: failures.length,
    });
  }

  return { results, failures };
}

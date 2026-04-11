/**
 * Nightly Patrol イベント → SpHealthSignal 変換
 *
 * DriftEventsLog の行データを受け取り、SpHealthSignal に変換する。
 * 変換できない場合（severity が対象外・データ不正）は null を返す。
 *
 * Fail-open: 例外を外部に投げない。
 */

import type { DiagnosticsReportItem } from '@/sharepoint/diagnosticsReports';
import type { JsonRecord } from '@/lib/sp/types';
import type {
  SpHealthReasonCode,
  SpHealthSeverity,
  SpHealthSignal,
} from './spHealthSignalStore';
import { reportSpHealthEvent, revokeSpHealthSignal } from './spHealthSignalStore';

/** mapping.ts が返す型: Store が occurrenceCount を付与するため除外 */
type PatrolSignal = Omit<SpHealthSignal, 'occurrenceCount'>;

// ─── Input ────────────────────────────────────────────────────────────────────

/**
 * DriftEventsLog から取得したパトロールイベント（正規化済み）
 */
export interface PatrolEvent {
  /** 'warning' | 'action_required' | 'critical' — それ以外は変換対象外 */
  severity: string;
  /** ResolutionType 等から来る生コード */
  code: string;
  listName?: string;
  message: string;
  actionGuide?: string;
  occurredAt: string;
}

// ─── Severity mapping ────────────────────────────────────────────────────────

const VALID_SEVERITIES: ReadonlySet<string> = new Set(['warning', 'action_required', 'critical']);

/**
 * SP 側の Severity 文字列を SpHealthSeverity に正規化。
 * - 'watch' → 'warning'（Nightly patrol の watch = 要観察）
 * - その他の未知値 → null（変換対象外）
 */
function normalizeSeverity(raw: string): SpHealthSeverity | null {
  if (VALID_SEVERITIES.has(raw)) return raw as SpHealthSeverity;
  if (raw === 'watch') return 'warning';
  return null;
}

// ─── ReasonCode mapping ───────────────────────────────────────────────────────

const CODE_MAP: ReadonlyArray<[pattern: RegExp | string, reasonCode: SpHealthReasonCode]> = [
  // 8KB 行サイズ制限 / インデックス上限到達
  ['sp_row_size_limit',       'sp_limit_reached'],
  ['max_size_exceeded',       'sp_limit_reached'],
  ['sp_index_limit',          'sp_limit_reached'],
  // インデックス圧迫（予防）
  ['index_warning',           'sp_index_pressure'],
  ['sp_index_pressure',       'sp_index_pressure'],
  // プロビジョニングブロック
  ['provision_skipped:block', 'sp_bootstrap_blocked'],
  ['sp_bootstrap_blocked',    'sp_bootstrap_blocked'],
  // 認証失敗
  ['sp_auth_failed',          'sp_auth_failed'],
  ['auth_failed',             'sp_auth_failed'],
  // リスト到達不能
  ['list_not_found',          'sp_list_unreachable'],
  ['essential_resource_unavailable', 'sp_list_unreachable'],
  ['sp_list_unreachable',     'sp_list_unreachable'],
  // 429 → レート制限はリソース枯渇として扱う
  ['rate_limit',              'sp_limit_reached'],
  ['http_429',                'sp_limit_reached'],
];

function resolveReasonCode(code: string): SpHealthReasonCode {
  for (const [pattern, reasonCode] of CODE_MAP) {
    if (typeof pattern === 'string' ? code === pattern : pattern.test(code)) {
      return reasonCode;
    }
  }
  // フォールバック: 不明なコードはリスト到達不能として扱う
  return 'sp_list_unreachable';
}

// ─── Main mapper ─────────────────────────────────────────────────────────────

/**
 * Nightly Patrol の DriftEventsLog イベントを PatrolSignal に変換する。
 * occurrenceCount は Store 側で付与されるためここでは含まない。
 *
 * @returns PatrolSignal — 変換成功
 * @returns null — severity が対象外 / 変換不可
 */
export function mapPatrolEventToSignal(event: PatrolEvent): PatrolSignal | null {
  try {
    const severity = normalizeSeverity(event.severity);
    if (severity === null) return null;

    const reasonCode = resolveReasonCode(event.code);

    // ── 状態の解消（Success/Recovery）検知 ─────────────────────────────────────
    if (event.code === 'transient_failure' || event.code === 'success') {
      revokeSpHealthSignal(reasonCode, event.listName);
      return null;
    }

    return {
      severity,
      reasonCode,
      listName: event.listName || undefined,
      message: event.message,
      actionGuide: event.actionGuide || undefined,
      occurredAt: event.occurredAt,
      source: 'nightly_patrol',
    };
  } catch {
    return null;
  }
}

/**
 * 診断レポート（DiagnosticsReportItem）を健康シグナルに変換
 * - Overall が fail/warn の場合にのみシグナルを生成
 */
export function mapDiagnosticsReportToSignal(report: DiagnosticsReportItem): PatrolSignal | null {
  const rawOverall = (report.Overall as JsonRecord)?.Value || report.Overall;
  const overall = typeof rawOverall === 'string' ? rawOverall : 'pass';

  if (overall === 'pass') return null;

  const severity = overall === 'fail' ? 'critical' : 'warning';
  const displayTitle = report.TopIssue || 'System Health Issue Detected';
  const displaySummary = report.SummaryText || 'Details are available in the health diagnosis page.';

  return {
    severity,
    reasonCode: overall === 'fail' ? 'sp_list_unreachable' : 'sp_index_pressure',
    message: `${displayTitle}: ${displaySummary}`,
    actionGuide: 'Check the Health Diagnosis page for more details.',
    source: 'nightly_patrol',
    occurredAt: report.Modified || report.Created || new Date().toISOString(),
  };
}

/**
 * 診断レポートをストアに報告
 */
export function reportDiagnosticsReport(report: DiagnosticsReportItem): void {
  const signal = mapDiagnosticsReportToSignal(report);
  if (signal) {
    reportSpHealthEvent(signal);
  }
}

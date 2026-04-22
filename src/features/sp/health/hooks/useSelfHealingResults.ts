import React from 'react';
import { useSP } from '@/lib/spClient';
import { getLatestDiagnosticsReport } from '@/sharepoint/diagnosticsReports';

export interface SelfHealingResult {
  resourceKey: string;
  fieldKey?: string;
  outcome: 'added' | 'failed' | 'skipped_limit' | 'unknown';
  message: string;
  occurredAt: string;
}

interface NightlyEvent {
  eventType: string;
  resourceKey: string;
  fieldKey?: string;
  sampleMessage: string;
  lastSeen?: string;
}

export type NightlyDecisionSeverity = 'watch' | 'action_required' | 'blocked';

export interface NightlyReasonCodeAction {
  bucket: 'fail' | 'warn';
  code: string;
  normalizedCode: string;
  owner: string;
  severity: NightlyDecisionSeverity;
  firstAction: string;
  runbookLink: string;
}

export interface NightlyDecisionContext {
  date?: string;
  finalLabel?: string;
  sourceFile?: string;
  actions: NightlyReasonCodeAction[];
}

interface RuntimeSummaryPayload {
  date?: string;
  final?: { label?: string };
  events?: NightlyEvent[];
  decisionContext?: {
    date?: string;
    finalLabel?: string;
    sourceFile?: string;
    reasonCodeActions?: {
      fail?: unknown;
      warn?: unknown;
    };
  };
  runbook?: {
    reasonCodeActions?: {
      fail?: unknown;
      warn?: unknown;
    };
  };
}

const DECISION_SEVERITIES: NightlyDecisionSeverity[] = ['watch', 'action_required', 'blocked'];

function isDecisionSeverity(value: unknown): value is NightlyDecisionSeverity {
  return DECISION_SEVERITIES.includes(value as NightlyDecisionSeverity);
}

function extractBucketActions(
  bucket: 'fail' | 'warn',
  raw: unknown,
): NightlyReasonCodeAction[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => {
      const code = typeof item.code === 'string' ? item.code : '';
      const normalizedCode = typeof item.normalizedCode === 'string' ? item.normalizedCode : code;
      const owner = typeof item.owner === 'string' ? item.owner : '';
      const severity = item.severity;
      const firstAction = typeof item.firstAction === 'string' ? item.firstAction : '';
      const runbookLink = typeof item.runbookLink === 'string' ? item.runbookLink : '';
      if (!code || !owner || !isDecisionSeverity(severity) || !firstAction || !runbookLink) {
        return null;
      }
      return {
        bucket,
        code,
        normalizedCode,
        owner,
        severity,
        firstAction,
        runbookLink,
      };
    })
    .filter((item): item is NightlyReasonCodeAction => Boolean(item));
}

export function extractNightlyDecisionContext(summary: RuntimeSummaryPayload): NightlyDecisionContext | null {
  const runtimeActions = summary.decisionContext?.reasonCodeActions;
  const decisionActions = summary.runbook?.reasonCodeActions;
  const source = runtimeActions ?? decisionActions;
  if (!source) return null;

  const actions = [
    ...extractBucketActions('fail', source.fail),
    ...extractBucketActions('warn', source.warn),
  ];
  if (actions.length === 0) return null;

  return {
    date: summary.decisionContext?.date ?? summary.date,
    finalLabel: summary.decisionContext?.finalLabel ?? summary.final?.label,
    sourceFile: summary.decisionContext?.sourceFile,
    actions,
  };
}

function toRemediationResults(events: NightlyEvent[], fallbackOccurredAt: string): SelfHealingResult[] {
  return events
    .filter((event) => event.eventType === 'remediation')
    .map((event) => {
      let outcome: SelfHealingResult['outcome'] = 'unknown';
      const messageLower = (event.sampleMessage || '').toLowerCase();
      if (messageLower.includes('成功') || messageLower.includes('success')) {
        outcome = 'added';
      } else if (messageLower.includes('失敗') || messageLower.includes('fail')) {
        outcome = 'failed';
      } else if (messageLower.includes('上限') || messageLower.includes('limit')) {
        outcome = 'skipped_limit';
      }

      return {
        resourceKey: event.resourceKey,
        fieldKey: event.fieldKey,
        outcome,
        message: event.sampleMessage,
        occurredAt: event.lastSeen || fallbackOccurredAt,
      };
    });
}

export function useSelfHealingResults() {
  const sp = useSP();
  const [results, setResults] = React.useState<SelfHealingResult[]>([]);
  const [decisionContext, setDecisionContext] = React.useState<NightlyDecisionContext | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [hasReport, setHasReport] = React.useState(false);

  React.useEffect(() => {
    if (!sp) return;

    let cancelled = false;
    const fetchResults = async () => {
      setLoading(true);
      setError(null);
      try {
        // 'runtime-summary' を明示的に指定して取得
        const report = await getLatestDiagnosticsReport(sp, 'runtime-summary');
        if (cancelled) return;

        if (report) {
          setHasReport(true);
        }

        if (report?.SummaryText) {
          try {
            const summary = JSON.parse(report.SummaryText) as RuntimeSummaryPayload;
            const fallbackOccurredAt = report.Modified || report.Created;
            setResults(toRemediationResults(summary.events || [], fallbackOccurredAt));
            setDecisionContext(extractNightlyDecisionContext(summary));
          } catch (e) {
            console.warn('[useSelfHealingResults] Failed to parse SummaryText', e);
            setResults([]);
            setDecisionContext(null);
          }
        } else {
          setResults([]);
          setDecisionContext(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchResults();
    return () => { cancelled = true; };
  }, [sp]);

  return { results, decisionContext, loading, error, hasReport };
}

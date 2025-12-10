interface NurseMswSummaryEntry {
  userId: string;
  status: 'ok' | 'partial' | 'error';
  kind: string;
  error?: unknown;
}

interface NurseMswSummary {
  sent?: number;
  remaining?: number;
  okCount?: number;
  errorCount?: number;
  partialCount?: number;
  totalCount?: number;
  entries?: NurseMswSummaryEntry[];
  bpSent?: number;
  durationMs?: number;
  attempts?: number;
}

declare global {
  interface Window {
    __MSW_NURSE_MODE__?: 'ok' | 'partial' | 'error';
    __MSW_NURSE_SUMMARY__?: NurseMswSummary;
    __MSW__?: Record<string, unknown>;
  }
}

export { };

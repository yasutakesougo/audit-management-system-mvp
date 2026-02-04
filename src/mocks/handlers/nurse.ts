import { http, HttpResponse } from 'msw';
import type { FlushEntrySummary, FlushSummary } from '../../features/nurse/state/useNurseSync';

export type NurseMode = 'ok' | 'partial' | 'error';

type EntryPreset = Omit<FlushEntrySummary, 'status'> & { status: FlushEntrySummary['status'] };

const SUMMARY_PRESETS: Record<NurseMode, EntryPreset[]> = {
  ok: [
    { userId: 'I015', status: 'ok', kind: 'observation' },
    { userId: 'I022', status: 'ok', kind: 'observation' },
    { userId: 'I031', status: 'ok', kind: 'observation' },
  ],
  partial: [
    { userId: 'I015', status: 'partial', kind: 'observation' },
    { userId: 'I022', status: 'ok', kind: 'observation' },
    { userId: 'I031', status: 'ok', kind: 'observation' },
    { userId: 'I044', status: 'partial', kind: 'observation' },
  ],
  error: [
    { userId: 'I015', status: 'error', kind: 'observation' },
    { userId: 'I022', status: 'error', kind: 'observation' },
  ],
};

const cloneEntries = (entries: EntryPreset[]): FlushEntrySummary[] => entries.map((entry) => ({ ...entry }));

const deriveSummary = (entries: FlushEntrySummary[], _mode: NurseMode): FlushSummary => {
  const okCount = entries.filter((entry) => entry.status === 'ok').length;
  const partialCount = entries.filter((entry) => entry.status === 'partial').length;
  const errorCount = entries.filter((entry) => entry.status === 'error').length;
  const totalCount = entries.length;
  const sent = okCount;
  const remaining = partialCount + errorCount;
  const failureSamples = entries
    .filter((entry) => entry.status === 'error')
    .slice(0, 5)
    .map((entry) => ({ userId: entry.userId, key: entry.userId, error: typeof entry.error === 'string' ? entry.error : undefined }));
  return {
    sent,
    remaining,
    okCount,
    errorCount,
    partialCount,
    entries,
    totalCount,
    source: 'manual',
    bpSent: 0,
    durationMs: 300,
    attempts: entries.length,
    failureSamples,
  };
};

const resolveMode = (mode: string | null | undefined, fallback: NurseMode): NurseMode => {
  if (mode === 'ok' || mode === 'partial' || mode === 'error') {
    return mode;
  }
  return fallback;
};

const buildResponse = (mode: NurseMode): FlushSummary => {
  const entries = cloneEntries(SUMMARY_PRESETS[mode]);
  return deriveSummary(entries, mode);
};

export const makeNurseHandlers = (mode: NurseMode) => {
  return [
    http.post('**/api/nurse/flush', async ({ request }) => {
      const baseUrl =
        typeof window !== 'undefined' && window.location?.origin
          ? window.location.origin
          : 'http://localhost:5173'; // SSR fallback（テスト用、CI 保護）
      const url = new URL(request.url, baseUrl);
      const effectiveMode = resolveMode(url.searchParams.get('mode'), mode);
      await new Promise((resolve) => setTimeout(resolve, 300));
      const summary = buildResponse(effectiveMode);
      return HttpResponse.json(summary, { status: 200 });
    }),
  ];
};

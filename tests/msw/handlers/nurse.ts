import { http, HttpResponse } from 'msw';

const MODE_ENTRIES = {
  ok: {
    sent: 2,
    remaining: 0,
    okCount: 2,
    partialCount: 0,
    errorCount: 0,
    entries: [
      { userId: 'I015', status: 'ok', kind: 'observation' },
      { userId: 'I022', status: 'ok', kind: 'observation' },
    ],
  },
  partial: {
    sent: 2,
    remaining: 2,
    okCount: 2,
    partialCount: 2,
    errorCount: 0,
    entries: [
      { userId: 'I015', status: 'partial', kind: 'observation' },
      { userId: 'I022', status: 'ok', kind: 'observation' },
      { userId: 'I031', status: 'ok', kind: 'observation' },
      { userId: 'I044', status: 'partial', kind: 'observation' },
    ],
  },
  error: {
    sent: 0,
    remaining: 2,
    okCount: 0,
    partialCount: 0,
    errorCount: 2,
    entries: [
      { userId: 'I015', status: 'error', kind: 'observation' },
      { userId: 'I022', status: 'error', kind: 'observation' },
    ],
  },
} as const;

type NurseMode = keyof typeof MODE_ENTRIES;

const toSummary = (mode: NurseMode) => {
  const payload = MODE_ENTRIES[mode];
  return {
    source: 'manual',
    totalCount: payload.entries.length,
    ...payload,
  };
};

export const nurseHandlers = [
  http.post('**/api/nurse/flush', ({ request }) => {
    const url = new URL(request.url);
    const modeParam = (url.searchParams.get('mode') ?? 'ok') as NurseMode;
    const mode: NurseMode = modeParam === 'partial' || modeParam === 'error' ? modeParam : 'ok';
    return HttpResponse.json(toSummary(mode));
  }),
];

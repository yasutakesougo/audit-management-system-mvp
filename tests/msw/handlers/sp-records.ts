import { http, HttpResponse } from 'msw';

const RECORDS_ENDPOINT = 'https://*/_api/web/lists/getbytitle*/items';

export const spRecordsHandlers = [
  http.get(RECORDS_ENDPOINT, ({ request }: { request: Request }) => {
    const url = new URL(request.url);
    const filter = url.searchParams.get('$filter') ?? '';
    const topParam = url.searchParams.get('$top') ?? '2';
    const top = Number.isFinite(Number(topParam)) ? Number(topParam) : 2;
    const match = /cr013_usercode\s+eq\s+'([^']+)'/i.exec(filter);
    const userCode = match?.[1] ?? 'U';
    const today = '2025-09-28';
    const now = new Date().toISOString();

    const rows = Array.from({ length: top }, (_, index) => ({
      Id: index + 1,
      cr013_usercode: userCode,
      cr013_recorddate: index === 0 ? today : '2025-09-27',
      cr013_rowno: index + 1,
      cr013_situation: index % 2 === 0 ? '落ち着いて作業' : '',
      cr013_specialnote: index % 3 === 0 ? '咳あり、様子観察' : '',
      cr013_completed: index % 4 === 0,
      cr013_amactivity: index % 2 === 0 ? '午前: 作業' : '午前: 体操',
      cr013_pmactivity: index % 2 === 0 ? '午後: 散歩' : '午後: 学習',
  cr013_lunchamount: index % 2 === 0 ? '完食' : '半分',
  cr013_behaviorcheck: index % 3 === 0 ? ['暴言'] : ['自傷', '異食'],
      Modified: now,
      Editor: { Title: 'Tester' },
    }));

    return HttpResponse.json({ value: rows });
  }),
];

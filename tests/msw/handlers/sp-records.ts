import { http, HttpResponse } from 'msw';

/**
 * SharePoint通所記録リストのレコード型
 */
type SupportRecord = {
  Id: number;
  cr013_usercode: string;
  cr013_recorddate: string;
  cr013_rowno: number;
  cr013_situation: string;
  cr013_specialnote: string;
  cr013_completed: boolean;
  cr013_amactivity: string;
  cr013_pmactivity: string;
  cr013_lunchamount: string;
  cr013_behaviorcheck: string[];
  Modified: string;
  Editor: { Title: string };
};

/**
 * $top パラメータのパース
 * 不正値は 2 にフォールバック、最大 100 件制限
 */
const parseTop = (topParam: string | null): number => {
  if (!topParam) return 2;
  const parsed = Number(topParam);
  if (!Number.isFinite(parsed) || parsed < 1) return 2;
  return Math.min(parsed, 100); // 最大100件制限
};

/**
 * テスト用日付の生成
 * 固定日付でテスト再現性を保証（動的日付が必要な場合は useDynamicDates を true に）
 */
const generateTestDates = (useDynamicDates = false) => {
  if (useDynamicDates) {
    const todayDate = new Date();
    const today = todayDate.toISOString().slice(0, 10); // yyyy-mm-dd
    const yesterday = new Date(todayDate.getTime() - 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    return { today, yesterday };
  }

  // 固定日付（テスト再現性優先）
  return {
    today: '2025-09-28',
    yesterday: '2025-09-27'
  };
};

const RECORDS_ENDPOINT = 'https://*/_api/web/lists/getbytitle*/items';

/**
 * SharePoint通所記録リスト (/api/web/lists/getbytitle('SupportRecord_Daily')/items) のMSWハンドラー
 *
 * サポート機能:
 * - $filter での cr013_usercode 絞り込み
 * - $top での件数制限（最大100件）
 * - 多様なフィールドパターンでリアルなテストデータを生成
 */
export const spRecordsHandlers = [
  http.get(RECORDS_ENDPOINT, ({ request }: { request: Request }) => {
    const url = new URL(request.url);
    const filter = url.searchParams.get('$filter') ?? '';
    const top = parseTop(url.searchParams.get('$top'));
    const match = /cr013_usercode\s+eq\s+'([^']+)'/i.exec(filter);
    const userCode = match?.[1] ?? 'U';
    const { today, yesterday } = generateTestDates();
    const now = new Date().toISOString();

    const rows: SupportRecord[] = Array.from({ length: top }, (_, index) => ({
      Id: index + 1,
      cr013_usercode: userCode,
      cr013_recorddate: index === 0 ? today : yesterday,
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

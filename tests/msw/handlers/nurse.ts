import { http, HttpResponse } from 'msw';

/**
 * 看護記録エントリーのステータス
 */
type NurseEntryStatus = 'ok' | 'partial' | 'error';

/**
 * 看護記録エントリーの種類
 * 将来的に 'medication' などの追加も想定
 */
type NurseEntryKind = 'observation';

/**
 * 看護記録エントリー
 */
type NurseEntry = {
  userId: string;
  status: NurseEntryStatus;
  kind: NurseEntryKind;
};

/**
 * 看護記録同期サマリー
 */
type NurseSummary = {
  sent: number;
  remaining: number;
  okCount: number;
  partialCount: number;
  errorCount: number;
  entries: readonly NurseEntry[];
};

/**
 * API レスポンス形式
 */
type NurseFlushResponse = NurseSummary & {
  source: 'manual';
  totalCount: number;
};

/**
 * 看護記録同期APIのモック用データ
 * 各モードでの同期結果パターンを定義
 */
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

/**
 * モードパラメータのパース処理
 * MODE_ENTRIESを真実源として不正値をokにフォールバック
 */
const parseMode = (raw: string | null): NurseMode => {
  if (!raw) return 'ok';
  const lower = raw.toLowerCase();
  return (lower in MODE_ENTRIES ? lower : 'ok') as NurseMode;
};

const toSummary = (mode: NurseMode): NurseFlushResponse => {
  const payload = MODE_ENTRIES[mode];
  return {
    source: 'manual',
    totalCount: payload.entries.length,
    ...payload,
  };
};

/**
 * 看護記録同期API (/api/nurse/flush) のMSWハンドラー
 *
 * 使用方法:
 * - POST /api/nurse/flush?mode=ok     → 全件同期成功
 * - POST /api/nurse/flush?mode=partial → 一部同期残り
 * - POST /api/nurse/flush?mode=error  → 全件同期エラー
 * - その他のmode値や未指定 → ok として扱う
 */
export const nurseHandlers = [
  http.post('**/api/nurse/flush', ({ request }) => {
    const url = new URL(request.url);
    const mode = parseMode(url.searchParams.get('mode'));
    return HttpResponse.json(toSummary(mode));
  }),
];

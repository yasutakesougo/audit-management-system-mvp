/**
 * createTimelineDataFetcher — タイムライン用データ取得関数ファクトリ
 *
 * 各ドメインの Repository を受け取り、userId に紐づくデータを取得して
 * TimelineSources 形式に変換する fetcher を生成する。
 *
 * 設計方針:
 *   - fetcher は plain function（hook 禁止）→ Repository は外部注入
 *   - Repository の生データ差異は fetcher 内で吸収
 *   - 直近30日をデフォルト範囲とする（Phase 5 で可変化予定）
 *
 * Phase 4 接続状況:
 *   - Step 1: Daily ✅
 *   - Step 2: Incident ✅
 *   - Step 3: ISP ✅
 *   - Step 4: Handoff ✅
 *
 * @see features/timeline/useUserTimeline.ts — 消費側 hook
 * @see domain/timeline/buildTimeline.ts — データ変換
 */

import type { AnyDaily, PersonDaily } from '@/domain/daily/types';
import type { DailyRecordRepository, DailyRecordItem } from '@/features/daily/domain/DailyRecordRepository';
import type { DailyRecordUserRow } from '@/features/daily/schema';
import type { HighRiskIncident } from '@/domain/support/highRiskIncident';
import type { IncidentRepository } from '@/domain/support/incidentRepository';
import type { IspRepository } from '@/domain/isp/port';
import type { IndividualSupportPlan } from '@/domain/isp/schema';
import type { HandoffRepository } from '@/features/handoff/domain/HandoffRepository';
import type { HandoffRecord } from '@/features/handoff/handoffTypes';
import type { TimelineDataFetcher } from './useUserTimeline';

// ─────────────────────────────────────────────
// Repository 依存性定義
// ─────────────────────────────────────────────

/**
 * fetcher が必要とする Repository の集合。
 *
 * 各プロパティは省略可能 — 未接続のソースは空配列を返す。
 * これにより段階的な接続が安全に行える。
 */
export type TimelineRepositories = {
  dailyRepo?: DailyRecordRepository;
  incidentRepo?: IncidentRepository;
  ispRepo?: IspRepository;
  handoffRepo?: HandoffRepository;
};

// ─────────────────────────────────────────────
// 日付ユーティリティ
// ─────────────────────────────────────────────

/** 直近 N 日間の日付範囲を YYYY-MM-DD で返す */
function getDateRange(days: number): { startDate: string; endDate: string } {
  const now = new Date();
  const end = formatYmd(now);

  const start = new Date(now);
  start.setDate(start.getDate() - days);
  const startDate = formatYmd(start);

  return { startDate, endDate: end };
}

function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ─────────────────────────────────────────────
// DailyRecordItem → AnyDaily 変換
// ─────────────────────────────────────────────

/**
 * DailyRecordItem (repository) → AnyDaily[] (adapter 互換) 変換。
 *
 * DailyRecordItem は1日分のバルクレコード（userRows を含む）。
 * タイムラインは user 単位なので、指定 userId の行だけ抽出し
 * PersonDaily (kind: 'A') に変換する。
 *
 * 型マッピング:
 *   DailyRecordUserRow.amActivity (string) → DailyAData.specialNotes (string)
 *   ※ amActivities (string[]) は UserRow から直接取れないため、
 *      amActivity を specialNotes にまとめて adapter に渡す。
 *      dailyAdapter は specialNotes を description として使う。
 */
function dailyItemToAnyDailies(
  item: DailyRecordItem,
  userId: string,
): AnyDaily[] {
  const userRows: DailyRecordUserRow[] =
    (item as Record<string, unknown>).userRows as DailyRecordUserRow[] ?? [];
  const date = item.date ?? '';
  const reporter = (item as Record<string, unknown>).reporter as
    | { name: string; role?: string }
    | undefined;

  return userRows
    .filter((row) => String(row.userId) === userId)
    .map((row, idx): PersonDaily => ({
      id: Number(item.id ?? 0) * 1000 + idx,
      userId: String(row.userId),
      userName: row.userName,
      date,
      status: '完了',
      reporter: { name: reporter?.name ?? '' },
      draft: { isDraft: false },
      kind: 'A',
      data: {
        // DailyRecordUserRow → DailyAData の変換
        // amActivities / pmActivities は string[] だが、UserRow には
        // amActivity / pmActivity (単一文字列) しかないため配列化する
        amActivities: row.amActivity ? [row.amActivity] : [],
        pmActivities: row.pmActivity ? [row.pmActivity] : [],
        specialNotes: row.specialNotes || undefined,
        problemBehavior: row.problemBehavior
          ? {
              selfHarm: row.problemBehavior.selfHarm,
              otherInjury: row.problemBehavior.otherInjury,
              loudVoice: row.problemBehavior.loudVoice,
              pica: row.problemBehavior.pica,
              other: row.problemBehavior.other,
            }
          : undefined,
        seizureRecord: { occurred: false },
      },
    }));
}

// ─────────────────────────────────────────────
// createTimelineDataFetcher
// ─────────────────────────────────────────────

/**
 * タイムラインのデータ取得関数を生成する。
 *
 * @param repos - 各ドメインの Repository（省略可能）
 * @param rangeDays - 取得日数（デフォルト: 30日）
 * @returns async fetcher function
 *
 * @example
 * ```ts
 * const dailyRepo = useDailyRecordRepository();
 * const fetcher = createTimelineDataFetcher({ dailyRepo });
 * const { events } = useUserTimeline(userId, fetcher, users);
 * ```
 */
export function createTimelineDataFetcher(
  repos: TimelineRepositories = {},
  rangeDays = 30,
): TimelineDataFetcher {
  return async (userId: string) => {
    const { startDate, endDate } = getDateRange(rangeDays);

    // ─── Daily ───
    let dailyRecords: AnyDaily[] = [];
    if (repos.dailyRepo) {
      try {
        const items = await repos.dailyRepo.list({
          range: { startDate, endDate },
        });
        dailyRecords = items.flatMap((item) =>
          dailyItemToAnyDailies(item, userId),
        );
      } catch (err) {
        console.warn('[Timeline] Daily fetch failed:', err);
      }
    }

    // ─── Incident ───
    // IncidentRecord は HighRiskIncident のスーパーセット。
    // adapter は HighRiskIncident を期待するので、そのまま渡せる。
    let incidents: HighRiskIncident[] = [];
    if (repos.incidentRepo) {
      try {
        const records = await repos.incidentRepo.getByUserId(userId);
        incidents = records;
      } catch (err) {
        console.warn('[Timeline] Incident fetch failed:', err);
      }
    }

    // ─── ISP ───
    // IspRepository.listByUser() は IspListItem[] を返す。
    // IspListItem は IndividualSupportPlan のサブセット（summary 形式）。
    // ISP adapter が必要とするフィールド (id, userId, planStartDate, status, title) を持つ。
    let ispRecords: IndividualSupportPlan[] = [];
    if (repos.ispRepo) {
      try {
        const list = await repos.ispRepo.listByUser(userId);
        ispRecords = list as unknown as IndividualSupportPlan[];
      } catch (err) {
        console.warn('[Timeline] ISP fetch failed:', err);
      }
    }

    // ─── Handoff ───
    // getRecords('week', 'all') で直近1週間のデータを取得。
    // userId でのフィルタは buildTimeline 内の handoffAdapter が
    // resolveUserIdFromCode を使って行う。
    let handoffRecords: HandoffRecord[] = [];
    let rawHandoffCount = 0;
    if (repos.handoffRepo) {
      try {
        const records = await repos.handoffRepo.getRecords('week', 'all');
        rawHandoffCount = records.length;
        handoffRecords = records;
      } catch (err) {
        console.warn('[Timeline] Handoff fetch failed:', err);
      }
    }

    return {
      dailyRecords,
      incidents,
      ispRecords,
      handoffRecords,
      rawHandoffCount,
    };
  };
}

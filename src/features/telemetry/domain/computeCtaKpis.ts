/**
 * computeCtaKpis — CTA テレメトリから運用 KPI を算出する pure function
 *
 * 入力: Firestore telemetry ドキュメントの配列
 * 出力: ダッシュボード表示に必要な KPI 構造体
 *
 * @see docs/design/telemetry-dashboard.md
 */

// ── Types ───────────────────────────────────────────────────────────────────

/** Firestore から取得した telemetry ドキュメント（最小フィールド） */
export type TelemetryRecord = {
  type: string;
  ctaId?: string;
  sourceComponent?: string;
  stateType?: string;
  targetUrl?: string;
  path?: string;
  screen?: string;
  clientTs?: string;
  ts?: Date;
};

/** Hero vs Queue の比率 */
export type HeroQueueRatio = {
  heroCount: number;
  queueCount: number;
  heroRate: number;   // 0–100
  queueRate: number;  // 0–100
};

/** 導線分布（Today → どこに行ったか） */
export type FlowDistribution = {
  destination: string;
  label: string;
  count: number;
  rate: number; // 0–100
};

/** ファネル段階 */
export type FunnelStep = {
  label: string;
  count: number;
  rate: number; // 前段階からの転換率 0–100
};

/** 画面別 KPI */
export type ScreenKpi = {
  screen: string;
  label: string;
  heroClicks: number;
  queueClicks: number;
  totalClicks: number;
  heroRate: number;
};

/** 時間帯別集計 */
export type HourlyBucket = {
  hour: number;
  count: number;
};

/** ダッシュボード KPI 全体 */
export type DashboardKpis = {
  totalEvents: number;
  totalCtaClicks: number;
  totalLandings: number;

  /** Hero vs Queue（全画面合算） */
  heroQueueRatio: HeroQueueRatio;

  /** 画面別 Hero vs Queue */
  screenKpis: ScreenKpi[];

  /** Today からの導線分布 */
  flowDistribution: FlowDistribution[];

  /** 表示 → クリック → 完了 ファネル */
  funnel: FunnelStep[];

  /** 時間帯別利用分布 */
  hourlyDistribution: HourlyBucket[];
};

// ── CTA ID → Screen Mapping ────────────────────────────────────────────────

type ScreenGroup = 'daily' | 'calllog' | 'handoff' | 'today';

const SCREEN_LABELS: Record<ScreenGroup, string> = {
  daily: '日々の記録',
  calllog: '受電ログ',
  handoff: '申し送り',
  today: '今日の業務',
};

const HERO_CTA_IDS: Record<ScreenGroup, string[]> = {
  daily: ['daily_hero_clicked', 'daily_hero_all_completed_clicked'],
  calllog: ['calllog_hero_done_clicked'],
  handoff: ['handoff_hero_confirm_clicked', 'handoff_hero_done_clicked'],
  today: ['today_next_action_primary_clicked', 'today_next_action_schedule_clicked'],
};

const QUEUE_CTA_IDS: Record<ScreenGroup, string[]> = {
  daily: ['daily_queue_item_clicked', 'daily_queue_completed_toggled'],
  calllog: ['calllog_priority_item_clicked', 'calllog_priority_done_clicked'],
  handoff: ['handoff_priority_item_clicked', 'handoff_priority_done_clicked'],
  today: ['today_next_action_empty_clicked', 'today_next_action_utility_clicked'],
};

const FLOW_DESTINATION_MAP: Record<string, { destination: string; label: string }> = {
  daily_hero_clicked: { destination: '/daily/activity', label: '日々の記録' },
  daily_queue_item_clicked: { destination: '/daily/activity', label: '日々の記録' },
  daily_hero_all_completed_clicked: { destination: '/daily/activity', label: '日々の記録' },
  daily_queue_completed_toggled: { destination: '/daily/activity', label: '日々の記録' },
  calllog_hero_done_clicked: { destination: '/calllog', label: '受電ログ' },
  calllog_priority_item_clicked: { destination: '/calllog', label: '受電ログ' },
  calllog_priority_done_clicked: { destination: '/calllog', label: '受電ログ' },
  handoff_hero_confirm_clicked: { destination: '/handoff/timeline', label: '申し送り' },
  handoff_hero_done_clicked: { destination: '/handoff/timeline', label: '申し送り' },
  handoff_priority_item_clicked: { destination: '/handoff/timeline', label: '申し送り' },
  handoff_priority_done_clicked: { destination: '/handoff/timeline', label: '申し送り' },
};

const DONE_CTA_IDS = new Set([
  'calllog_hero_done_clicked',
  'calllog_priority_done_clicked',
  'handoff_hero_done_clicked',
  'handoff_priority_done_clicked',
  'daily_hero_all_completed_clicked',
]);

// ── Core Computation ────────────────────────────────────────────────────────

function identifyScreen(ctaId: string): ScreenGroup | null {
  for (const [screen, ids] of Object.entries(HERO_CTA_IDS)) {
    if (ids.includes(ctaId)) return screen as ScreenGroup;
  }
  for (const [screen, ids] of Object.entries(QUEUE_CTA_IDS)) {
    if (ids.includes(ctaId)) return screen as ScreenGroup;
  }
  return null;
}

function isHeroCta(ctaId: string, screen: ScreenGroup): boolean {
  return HERO_CTA_IDS[screen]?.includes(ctaId) ?? false;
}

function getHour(rec: TelemetryRecord): number | null {
  const d = rec.ts ?? (rec.clientTs ? new Date(rec.clientTs) : null);
  if (!d) return null;
  return d.getHours();
}

/**
 * テレメトリレコード配列からダッシュボード KPI を算出する
 */
export function computeCtaKpis(records: TelemetryRecord[]): DashboardKpis {
  let totalCtaClicks = 0;
  let totalLandings = 0;
  let totalHero = 0;
  let totalQueue = 0;
  let totalDone = 0;

  const screenHero: Record<ScreenGroup, number> = { daily: 0, calllog: 0, handoff: 0, today: 0 };
  const screenQueue: Record<ScreenGroup, number> = { daily: 0, calllog: 0, handoff: 0, today: 0 };

  const flowCounts: Record<string, { label: string; count: number }> = {};
  const hourlyCounts: Record<number, number> = {};

  for (const rec of records) {
    // counting
    if (rec.type === 'todayops_landing') {
      totalLandings++;
      continue;
    }

    if (rec.type === 'todayops_cta_click' && rec.ctaId) {
      totalCtaClicks++;

      const screen = identifyScreen(rec.ctaId);
      if (screen) {
        if (isHeroCta(rec.ctaId, screen)) {
          totalHero++;
          screenHero[screen]++;
        } else {
          totalQueue++;
          screenQueue[screen]++;
        }
      }

      // done counting
      if (DONE_CTA_IDS.has(rec.ctaId)) {
        totalDone++;
      }

      // flow distribution
      const flow = FLOW_DESTINATION_MAP[rec.ctaId];
      if (flow) {
        if (!flowCounts[flow.destination]) {
          flowCounts[flow.destination] = { label: flow.label, count: 0 };
        }
        flowCounts[flow.destination].count++;
      }

      // hourly
      const h = getHour(rec);
      if (h !== null) {
        hourlyCounts[h] = (hourlyCounts[h] ?? 0) + 1;
      }
    }
  }

  // ── Hero vs Queue ratio ──
  const totalHQ = totalHero + totalQueue;
  const heroQueueRatio: HeroQueueRatio = {
    heroCount: totalHero,
    queueCount: totalQueue,
    heroRate: totalHQ > 0 ? Math.round((totalHero / totalHQ) * 100) : 0,
    queueRate: totalHQ > 0 ? Math.round((totalQueue / totalHQ) * 100) : 0,
  };

  // ── Screen KPIs ──
  const screens: ScreenGroup[] = ['daily', 'calllog', 'handoff', 'today'];
  const screenKpis: ScreenKpi[] = screens
    .map((s) => {
      const hero = screenHero[s];
      const queue = screenQueue[s];
      const total = hero + queue;
      return {
        screen: s,
        label: SCREEN_LABELS[s],
        heroClicks: hero,
        queueClicks: queue,
        totalClicks: total,
        heroRate: total > 0 ? Math.round((hero / total) * 100) : 0,
      };
    })
    .filter((s) => s.totalClicks > 0);

  // ── Flow distribution ──
  const totalFlow = Object.values(flowCounts).reduce((a, b) => a + b.count, 0);
  const flowDistribution: FlowDistribution[] = Object.entries(flowCounts)
    .map(([dest, { label, count }]) => ({
      destination: dest,
      label,
      count,
      rate: totalFlow > 0 ? Math.round((count / totalFlow) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // ── Funnel ──
  const funnel: FunnelStep[] = [
    {
      label: 'ランディング',
      count: totalLandings,
      rate: 100,
    },
    {
      label: 'CTAクリック',
      count: totalCtaClicks,
      rate: totalLandings > 0 ? Math.round((totalCtaClicks / totalLandings) * 100) : 0,
    },
    {
      label: '完了',
      count: totalDone,
      rate: totalCtaClicks > 0 ? Math.round((totalDone / totalCtaClicks) * 100) : 0,
    },
  ];

  // ── Hourly distribution ──
  const hourlyDistribution: HourlyBucket[] = [];
  for (let h = 6; h <= 21; h++) {
    hourlyDistribution.push({ hour: h, count: hourlyCounts[h] ?? 0 });
  }

  return {
    totalEvents: records.length,
    totalCtaClicks,
    totalLandings,
    heroQueueRatio,
    screenKpis,
    flowDistribution,
    funnel,
    hourlyDistribution,
  };
}

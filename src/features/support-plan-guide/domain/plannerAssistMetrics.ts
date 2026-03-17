/**
 * plannerAssistMetrics — Planner Assist 採用効果計測 (P6-A)
 *
 * イベント型定義（SSoT）と pure 集計関数を提供する。
 *
 * 設計原則:
 *  - 画面文言ではなく意味的キー (actionCategory / actionId) を使う
 *  - UI は emit だけ、解釈はここに集約する
 *  - 計測ロジックが plannerInsights / adoption 系を汚さない
 *
 * イベントフロー:
 *  panel_shown → action_clicked → tab_landed
 *                                  └→ adoption_snapshot（定期）
 */

import type { PlannerInsightActionKey } from './plannerInsights';

// ────────────────────────────────────────────
// 共通フィールド
// ────────────────────────────────────────────

/** 全イベント共通の base 型 */
export type PlannerAssistEventBase = {
  /**
   * セッション ID — Planner Assist パネルの表示ライフサイクル単位で一意。
   *
   * 境界定義:
   *  - 生成タイミング: usePlannerAssistTracking の初回マウント時
   *  - 維持: 同一コンポーネントの re-render では変わらない (useRef)
   *  - リセット: ページ遷移・タブ移動でコンポーネントが unmount → remount すると新規
   *  - 粒度: 「Planner Assist パネル表示単位」= 対象利用者の詳細ページ閲覧 1 回
   *
   * ⚠ ブラウザリロードや React key 変更でもリセットされる。
   *   ナビゲーション移動による unmount → 再マウントは別セッション扱い。
   */
  sessionId: string;
  /** 操作者のロール */
  userRole: 'staff' | 'planner' | 'admin';
  /** 対象利用者 ID（匿名化済み） */
  targetUserId: string;
  /** パネルの実装バージョン（将来の A/B テスト用） */
  panelVersion: string;
  /** 発生日時（ISO 8601） */
  occurredAt: string;
};

// ────────────────────────────────────────────
// イベント型定義
// ────────────────────────────────────────────

/** パネルが表示された */
export type PanelShownEvent = PlannerAssistEventBase & {
  type: 'planner_assist_panel_shown';
  /** 表示されたアクション件数 */
  actionCount: number;
  /** 表示時の採用率 */
  acceptanceRate: number | undefined;
};

/** アクション行がクリックされた */
export type ActionClickedEvent = PlannerAssistEventBase & {
  type: 'planner_assist_action_clicked';
  /** インタラクション ID（click → land の紐付け用） */
  interactionId: string;
  /** クリックされたカテゴリ */
  actionCategory: PlannerInsightActionKey;
  /** 遷移先タブ */
  targetTab: string;
};

/** タブに到達した */
export type TabLandedEvent = PlannerAssistEventBase & {
  type: 'planner_assist_tab_landed';
  /** 対応する interactionId（action_clicked と結ぶ） */
  interactionId: string;
  /** 到達したタブ */
  tab: string;
  /** action_clicked からの経過ミリ秒 */
  elapsedMs: number;
};

/** 採用率スナップショット（定期記録） */
export type AdoptionSnapshotEvent = PlannerAssistEventBase & {
  type: 'planner_assist_adoption_snapshot';
  /** スナップショット時点の採用率 */
  acceptanceRate: number;
  /** スナップショット時点の判断総数 */
  totalDecisions: number;
  /** 直近1週間の判断数 */
  weeklyDecisions: number;
  /** 直近1週間の採用率 */
  weeklyAcceptanceRate: number | undefined;
};

/** 全イベントの union */
export type PlannerAssistEvent =
  | PanelShownEvent
  | ActionClickedEvent
  | TabLandedEvent
  | AdoptionSnapshotEvent;

/** イベント型名の列挙 */
export type PlannerAssistEventType = PlannerAssistEvent['type'];

// ────────────────────────────────────────────
// イベント ID 生成
// ────────────────────────────────────────────

/**
 * セッション ID 生成。
 * Planner Assist パネルのマウントライフサイクルに 1:1 で対応する。
 * @see PlannerAssistEventBase.sessionId — 境界定義
 */
export function generateSessionId(): string {
  return `pas_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** インタラクション ID 生成（click → land 単位） */
export function generateInteractionId(): string {
  return `pai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ────────────────────────────────────────────
// Panel version (SSoT)
// ────────────────────────────────────────────

/** 現在のパネルバージョン。A/B テスト時に切り替える */
export const CURRENT_PANEL_VERSION = 'v1.0-p5c3';

// ────────────────────────────────────────────
// P6-A2: Pure 集計関数
// ────────────────────────────────────────────

/** 集計結果: 初回遷移先の分布 */
export type FirstNavigationDistribution = Record<string, number>;

/** 集計結果: アクション押下率 */
export type ActionClickRate = {
  /** カテゴリ別 click 回数 */
  byCategory: Record<string, number>;
  /** panel shown あたりの平均 click 数 */
  clicksPerSession: number;
  /** 全 click 数 */
  totalClicks: number;
  /** 全 session 数 */
  totalSessions: number;
};

/** 集計結果: 到達時間 */
export type NavigationLatency = {
  /** 全ペアの経過ミリ秒リスト */
  latencies: number[];
  /** 中央値（ミリ秒） */
  medianMs: number;
  /** 平均値（ミリ秒） */
  meanMs: number;
  /** P90（ミリ秒） */
  p90Ms: number;
};

/**
 * 集計結果: 採用率変化 (before/after 比較)
 *
 * 比較窓ルール:
 *  - before/after の区切りは `cutoffDate` (ISO 8601) で決定する
 *  - cutoffDate は Planner Assist 機能リリース日 or A/B テスト開始日を想定
 *  - 日付基準 (バージョン基準ではない) — バージョンは panelVersion で別管理
 *
 * 最低サンプル数:
 *  - before / after それぞれ MIN_UPLIFT_SAMPLES (3) 以上を要求
 *  - 不足時は insufficient=true, uplift=0 を返す
 *  - UI側は insufficient フラグで「データ不足」表示に切り替える
 */
export type AdoptionUplift = {
  /** before 期間の平均採用率 */
  beforeRate: number;
  /** after 期間の平均採用率 */
  afterRate: number;
  /** 有効サンプル数（before + after の合計） */
  sampleCount: number;
  /** 改善幅 (after - before)。insufficient 時は 0 */
  uplift: number;
  /** before/after いずれかが MIN_UPLIFT_SAMPLES 未満の場合 true */
  insufficient: boolean;
};

/** 4指標の集約 */
export type PlannerAssistMetricsSummary = {
  firstNavigation: FirstNavigationDistribution;
  actionClickRate: ActionClickRate;
  navigationLatency: NavigationLatency;
  adoptionUplift: AdoptionUplift;
};

// ────────────────────────────────────────────
// 指標1: 初回遷移先の分布
// ────────────────────────────────────────────

/**
 * panel shown 後、最初にどのタブに到達したかの分布を算出する。
 * session ごとに最初の tab_landed のみをカウントする。
 */
export function computeFirstNavigationDistribution(
  events: PlannerAssistEvent[],
): FirstNavigationDistribution {
  // sessionId → 最初の tab_landed を探す
  const shownSessions = new Set<string>();
  const landedBySession = new Map<string, string>();

  // イベントを occurredAt 順にソート
  const sorted = [...events].sort(
    (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
  );

  for (const event of sorted) {
    if (event.type === 'planner_assist_panel_shown') {
      shownSessions.add(event.sessionId);
    }
    if (
      event.type === 'planner_assist_tab_landed' &&
      shownSessions.has(event.sessionId) &&
      !landedBySession.has(event.sessionId)
    ) {
      landedBySession.set(event.sessionId, event.tab);
    }
  }

  const distribution: FirstNavigationDistribution = {};
  for (const tab of landedBySession.values()) {
    distribution[tab] = (distribution[tab] ?? 0) + 1;
  }
  return distribution;
}

// ────────────────────────────────────────────
// 指標2: アクション押下率
// ────────────────────────────────────────────

/**
 * panel shown あたりの click 率と、カテゴリ別分布を算出する。
 */
export function computeActionClickRate(events: PlannerAssistEvent[]): ActionClickRate {
  const sessions = new Set<string>();
  const byCategory: Record<string, number> = {};
  let totalClicks = 0;

  for (const event of events) {
    if (event.type === 'planner_assist_panel_shown') {
      sessions.add(event.sessionId);
    }
    if (event.type === 'planner_assist_action_clicked') {
      totalClicks++;
      byCategory[event.actionCategory] = (byCategory[event.actionCategory] ?? 0) + 1;
    }
  }

  const totalSessions = sessions.size;
  return {
    byCategory,
    clicksPerSession: totalSessions > 0 ? totalClicks / totalSessions : 0,
    totalClicks,
    totalSessions,
  };
}

// ────────────────────────────────────────────
// 指標3: 到達時間
// ────────────────────────────────────────────

/**
 * action_clicked → tab_landed の到達時間を集計する。
 * interactionId で紐付ける。
 */
export function computeNavigationLatency(events: PlannerAssistEvent[]): NavigationLatency {
  const landed = events.filter(
    (e): e is TabLandedEvent => e.type === 'planner_assist_tab_landed',
  );

  const latencies = landed.map((e) => e.elapsedMs).sort((a, b) => a - b);

  if (latencies.length === 0) {
    return { latencies: [], medianMs: 0, meanMs: 0, p90Ms: 0 };
  }

  const sum = latencies.reduce((acc, v) => acc + v, 0);
  const medianIdx = Math.floor(latencies.length / 2);
  const p90Idx = Math.min(Math.floor(latencies.length * 0.9), latencies.length - 1);

  return {
    latencies,
    medianMs: latencies[medianIdx],
    meanMs: sum / latencies.length,
    p90Ms: latencies[p90Idx],
  };
}

// ────────────────────────────────────────────
// 指標4: 採用率変化 (before/after)
// ────────────────────────────────────────────

/**
 * before / after 各期間に必要な最低スナップショット数。
 * これ未満の場合は insufficient=true として uplift を 0 で返す。
 */
export const MIN_UPLIFT_SAMPLES = 3;

/**
 * snapshot イベントを before / after に分割して uplift を算出する。
 *
 * @param events - 全イベント
 * @param cutoffDate - before/after の境界日時（ISO 8601）。
 *   通常は Planner Assist リリース日 or A/B テスト開始日を指定する。
 *
 * @returns AdoptionUplift — insufficient=true なら uplift の数値は信用できない。
 *   UI 側は insufficient をチェックし「データ不足」表示に切り替えること。
 */
export function computeAdoptionUplift(
  events: PlannerAssistEvent[],
  cutoffDate: string,
): AdoptionUplift {
  const cutoff = new Date(cutoffDate).getTime();

  const snapshots = events.filter(
    (e): e is AdoptionSnapshotEvent => e.type === 'planner_assist_adoption_snapshot',
  );

  const before = snapshots.filter((s) => new Date(s.occurredAt).getTime() < cutoff);
  const after = snapshots.filter((s) => new Date(s.occurredAt).getTime() >= cutoff);

  const avgRate = (items: AdoptionSnapshotEvent[]): number => {
    if (items.length === 0) return 0;
    const sum = items.reduce((acc, s) => acc + s.acceptanceRate, 0);
    return sum / items.length;
  };

  const beforeRate = avgRate(before);
  const afterRate = avgRate(after);
  const insufficient =
    before.length < MIN_UPLIFT_SAMPLES || after.length < MIN_UPLIFT_SAMPLES;

  return {
    beforeRate,
    afterRate,
    sampleCount: snapshots.length,
    uplift: insufficient ? 0 : afterRate - beforeRate,
    insufficient,
  };
}

// ────────────────────────────────────────────
// 4指標統合
// ────────────────────────────────────────────

/**
 * 全イベントから4指標を一括算出する。
 */
export function computePlannerAssistMetrics(
  events: PlannerAssistEvent[],
  cutoffDate: string,
): PlannerAssistMetricsSummary {
  return {
    firstNavigation: computeFirstNavigationDistribution(events),
    actionClickRate: computeActionClickRate(events),
    navigationLatency: computeNavigationLatency(events),
    adoptionUplift: computeAdoptionUplift(events, cutoffDate),
  };
}

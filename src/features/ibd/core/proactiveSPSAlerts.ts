// ---------------------------------------------------------------------------
// proactiveSPSAlerts — 行動データドリブンの 支援計画シート 改訂推奨ロジック
//
// React 非依存の純関数。テスト容易性のため、すべての入力をパラメータとして受け取る。
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProactiveAlertLevel = 'ok' | 'watch' | 'urgent';

export interface ProactiveAlert {
  userId: string;
  userName: string;
  level: ProactiveAlertLevel;
  /** 直近N日間の高リスク事象数 */
  incidentCount: number;
  /** intensity ≥ intensityThreshold の事象数 */
  highIntensityCount: number;
  /** 次回支援計画シート見直しまでの残日数（未登録の場合 null） */
  daysUntilSPSReview: number | null;
  /** 表示用メッセージ */
  message: string;
}

export interface AlertThresholds {
  /** watch 判定の事象回数閾値 */
  watchCount: number;
  /** urgent 判定の事象回数閾値 */
  urgentCount: number;
  /** urgent 判定の高強度事象回数閾値 */
  urgentHighIntensityCount: number;
  /** 高強度とみなす intensity の下限値（含む） */
  intensityThreshold: number;
  /** 分析対象の日数 */
  lookbackDays: number;
}

export const DEFAULT_THRESHOLDS: AlertThresholds = {
  watchCount: 2,
  urgentCount: 5,
  urgentHighIntensityCount: 3,
  intensityThreshold: 4,
  lookbackDays: 7,
};

// ---------------------------------------------------------------------------
// Pure Logic
// ---------------------------------------------------------------------------

/**
 * 事象の頻度と強度からプロアクティブなアラートレベルを判定する。
 *
 * - `urgent`:  事象合計 ≥ urgentCount、または高強度事象 ≥ urgentHighIntensityCount
 * - `watch`:   事象合計 ≥ watchCount
 * - `ok`:      上記以外
 */
export function evaluateAlertLevel(
  incidentCount: number,
  highIntensityCount: number,
  thresholds: AlertThresholds = DEFAULT_THRESHOLDS,
): ProactiveAlertLevel {
  if (
    incidentCount >= thresholds.urgentCount ||
    highIntensityCount >= thresholds.urgentHighIntensityCount
  ) {
    return 'urgent';
  }
  if (incidentCount >= thresholds.watchCount) {
    return 'watch';
  }
  return 'ok';
}

/**
 * アラートレベルに応じた日本語メッセージを生成する。
 */
export function buildAlertMessage(
  userName: string,
  level: ProactiveAlertLevel,
  incidentCount: number,
  highIntensityCount: number,
  daysUntilSPSReview: number | null,
): string {
  if (level === 'ok') return '';

  const reviewPart =
    daysUntilSPSReview !== null
      ? `（支援計画シート更新まで${daysUntilSPSReview}日）`
      : '（支援計画シート未登録）';

  if (level === 'urgent') {
    return `🔴 ${userName}さん: 直近7日で${incidentCount}件の事象（高強度${highIntensityCount}件）— 支援計画シート前倒し改訂を推奨${reviewPart}`;
  }
  // watch
  return `🟠 ${userName}さん: 直近7日で${incidentCount}件の事象を検出 — 注意深い観察を推奨${reviewPart}`;
}

export interface IncidentSummary {
  userId: string;
  userName: string;
  incidentCount: number;
  highIntensityCount: number;
  daysUntilSPSReview: number | null;
}

/**
 * ユーザーごとの事象サマリからプロアクティブアラートのリストを生成する。
 * ok レベルのユーザーはフィルタし、urgent → watch の順でソートする。
 */
export function generateProactiveAlerts(
  summaries: IncidentSummary[],
  thresholds: AlertThresholds = DEFAULT_THRESHOLDS,
): ProactiveAlert[] {
  const alerts: ProactiveAlert[] = [];

  for (const s of summaries) {
    const level = evaluateAlertLevel(s.incidentCount, s.highIntensityCount, thresholds);
    if (level === 'ok') continue;

    alerts.push({
      userId: s.userId,
      userName: s.userName,
      level,
      incidentCount: s.incidentCount,
      highIntensityCount: s.highIntensityCount,
      daysUntilSPSReview: s.daysUntilSPSReview,
      message: buildAlertMessage(
        s.userName,
        level,
        s.incidentCount,
        s.highIntensityCount,
        s.daysUntilSPSReview,
      ),
    });
  }

  // urgent を先に、同レベル内は事象数の多い順
  alerts.sort((a, b) => {
    const levelOrder: Record<ProactiveAlertLevel, number> = { urgent: 0, watch: 1, ok: 2 };
    const levelDiff = levelOrder[a.level] - levelOrder[b.level];
    if (levelDiff !== 0) return levelDiff;
    return b.incidentCount - a.incidentCount;
  });

  return alerts;
}

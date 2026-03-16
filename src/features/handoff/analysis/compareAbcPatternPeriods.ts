/**
 * compareAbcPatternPeriods.ts — ABC記録の時系列パターン比較 Pure Function
 *
 * @description
 * 2つの期間の ABC 記録を比較し、パターンの変化を検出する。
 * 「前月と今月で頻出場面が変わったか」を定量化する。
 *
 * 6層モデル: 第1層（観測: ABC） → 第2層（解釈: パターン変化検出）
 *
 * 設計方針:
 * - Pure Function: React / Hook / 外部API 依存ゼロ
 * - evidencePatternAnalysis.ts の集計関数を再利用
 * - 変化の検出は率・順位・出現パターンの3軸で行う
 */

import type { AbcRecord, AbcIntensity } from '../../../domain/abc/abcRecord';

// ────────────────────────────────────────────────────────────
// 型定義
// ────────────────────────────────────────────────────────────

/** 場面の出現パターン */
export interface SettingFrequency {
  setting: string;
  count: number;
  /** 全体に占める割合 */
  ratio: number;
}

/** 場面パターンの変化 */
export interface SettingChange {
  setting: string;
  /** 変化種別 */
  changeType: 'new' | 'disappeared' | 'increased' | 'decreased' | 'stable';
  /** 前期の出現回数 */
  previousCount: number;
  /** 今期の出現回数 */
  currentCount: number;
  /** 前期の割合 */
  previousRatio: number;
  /** 今期の割合 */
  currentRatio: number;
  /** 変化率 (current - previous) / max(previous, 1) */
  changeRate: number;
}

/** 強度分布の変化 */
export interface IntensityShift {
  /** 前期の分布 */
  previous: Record<AbcIntensity, number>;
  /** 今期の分布 */
  current: Record<AbcIntensity, number>;
  /** high 割合の変化 (current - previous) */
  highRateDelta: number;
  /** リスクフラグ率の変化 */
  riskRateDelta: number;
  /** 強度が悪化しているか */
  worsening: boolean;
}

/** 場面変化アラート */
export interface SceneChangeAlert {
  /** アラート種別 */
  type: 'new_scene' | 'scene_spike' | 'scene_disappeared' | 'intensity_worsening';
  /** 重要度 */
  severity: 'info' | 'warning' | 'alert';
  /** 対象場面（あれば） */
  setting?: string;
  /** 説明文 */
  message: string;
  /** 改善提案（§5 予防的支援向け） */
  suggestion: string;
}

/** パターン比較結果 */
export interface AbcPatternComparison {
  /** 前期の記録数 */
  previousCount: number;
  /** 今期の記録数 */
  currentCount: number;
  /** 場面別の変化一覧 */
  settingChanges: SettingChange[];
  /** 新出場面 */
  newSettings: string[];
  /** 消失場面 */
  disappearedSettings: string[];
  /** 顕著な増加 (changeRate > threshold) */
  significantIncreases: SettingChange[];
  /** 顕著な減少 (changeRate < -threshold) */
  significantDecreases: SettingChange[];
  /** 強度分布の変化 */
  intensityShift: IntensityShift;
  /** 検出されたアラート */
  alerts: SceneChangeAlert[];
  /** 変化の総合評価 */
  overallChangeLevel: 'none' | 'minor' | 'moderate' | 'significant';
}

/** オプション */
export interface CompareAbcPatternsOptions {
  /** 顕著な変化と判定する変化率の閾値（デフォルト: 0.5 = 50%増減） */
  changeRateThreshold?: number;
  /** 上位N場面まで分析（デフォルト: 10） */
  topN?: number;
}

// ────────────────────────────────────────────────────────────
// 内部ロジック
// ────────────────────────────────────────────────────────────

const DEFAULT_CHANGE_THRESHOLD = 0.5;
const DEFAULT_TOP_N = 10;

/**
 * ABC記録から場面別頻度を集計
 */
function computeSettingFrequencies(records: AbcRecord[]): SettingFrequency[] {
  const counts = new Map<string, number>();
  for (const r of records) {
    if (!r.setting) continue;
    counts.set(r.setting, (counts.get(r.setting) ?? 0) + 1);
  }

  const total = records.length || 1;
  return [...counts.entries()]
    .map(([setting, count]) => ({
      setting,
      count,
      ratio: Math.round((count / total) * 100) / 100,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * 強度分布を比較
 */
function computeIntensityShift(prev: AbcRecord[], curr: AbcRecord[]): IntensityShift {
  const count = (records: AbcRecord[], level: AbcIntensity) =>
    records.filter(r => r.intensity === level).length;

  const prevTotal = prev.length || 1;
  const currTotal = curr.length || 1;

  const prevDist = { low: count(prev, 'low'), medium: count(prev, 'medium'), high: count(prev, 'high') };
  const currDist = { low: count(curr, 'low'), medium: count(curr, 'medium'), high: count(curr, 'high') };

  const prevHighRate = prevDist.high / prevTotal;
  const currHighRate = currDist.high / currTotal;

  const prevRiskRate = prev.filter(r => r.riskFlag).length / prevTotal;
  const currRiskRate = curr.filter(r => r.riskFlag).length / currTotal;

  return {
    previous: prevDist,
    current: currDist,
    highRateDelta: Math.round((currHighRate - prevHighRate) * 100) / 100,
    riskRateDelta: Math.round((currRiskRate - prevRiskRate) * 100) / 100,
    worsening: currHighRate > prevHighRate + 0.1 || currRiskRate > prevRiskRate + 0.1,
  };
}

/**
 * アラートを生成
 */
function generateAlerts(
  settingChanges: SettingChange[],
  intensityShift: IntensityShift,
  newSettings: string[],
  disappearedSettings: string[],
): SceneChangeAlert[] {
  const alerts: SceneChangeAlert[] = [];

  // 新出場面
  for (const setting of newSettings) {
    const change = settingChanges.find(c => c.setting === setting);
    if (change && change.currentCount >= 3) {
      alerts.push({
        type: 'new_scene',
        severity: 'warning',
        setting,
        message: `新しい場面「${setting}」が${change.currentCount}回出現しています`,
        suggestion: `「${setting}」場面の環境調整・予防的支援を検討してください`,
      });
    }
  }

  // 急増場面
  for (const change of settingChanges) {
    if (change.changeType === 'increased' && change.changeRate >= 1.0) {
      alerts.push({
        type: 'scene_spike',
        severity: 'alert',
        setting: change.setting,
        message: `「${change.setting}」の出現が${Math.round(change.changeRate * 100)}%増加しています（${change.previousCount}→${change.currentCount}回）`,
        suggestion: `「${change.setting}」場面の支援手順を緊急で見直してください`,
      });
    }
  }

  // 消失場面（支援が効いた可能性）
  for (const setting of disappearedSettings) {
    alerts.push({
      type: 'scene_disappeared',
      severity: 'info',
      setting,
      message: `「${setting}」場面が今期は出現していません — 支援が効果を発揮した可能性があります`,
      suggestion: `「${setting}」場面の支援手順を成功事例として記録してください`,
    });
  }

  // 強度悪化
  if (intensityShift.worsening) {
    alerts.push({
      type: 'intensity_worsening',
      severity: 'alert',
      message: `行動の強度が悪化傾向です（重度率 ${Math.round(intensityShift.highRateDelta * 100)}%増加）`,
      suggestion: '環境調整と危機対応手順の見直しを推奨します',
    });
  }

  // severity 降順
  const severityOrder = { alert: 3, warning: 2, info: 1 };
  alerts.sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity]);

  return alerts;
}

/**
 * 変化の総合レベルを判定
 */
function evaluateOverallChange(
  settingChanges: SettingChange[],
  intensityShift: IntensityShift,
  alerts: SceneChangeAlert[],
): AbcPatternComparison['overallChangeLevel'] {
  const hasAlert = alerts.some(a => a.severity === 'alert');
  const hasWarning = alerts.some(a => a.severity === 'warning');
  const significantChanges = settingChanges.filter(
    c => c.changeType === 'new' || c.changeType === 'disappeared' || Math.abs(c.changeRate) >= 1.0,
  ).length;

  if (hasAlert || intensityShift.worsening || significantChanges >= 3) return 'significant';
  if (hasWarning || significantChanges >= 1) return 'moderate';
  if (settingChanges.some(c => c.changeType !== 'stable')) return 'minor';
  return 'none';
}

// ────────────────────────────────────────────────────────────
// エントリ関数
// ────────────────────────────────────────────────────────────

/**
 * 2つの期間の ABC 記録を比較し、パターン変化を検出する。
 *
 * @param previousRecords - 前期間の ABC 記録
 * @param currentRecords - 今期間の ABC 記録
 * @param options - 比較オプション
 * @returns パターン比較結果
 *
 * @example
 * ```ts
 * const lastMonth = abcRecords.filter(r => isInPeriod(r, lastMonthRange));
 * const thisMonth = abcRecords.filter(r => isInPeriod(r, thisMonthRange));
 * const comparison = compareAbcPatternPeriods(lastMonth, thisMonth);
 * // comparison.alerts → [{ type: 'new_scene', ... }]
 * ```
 */
export function compareAbcPatternPeriods(
  previousRecords: AbcRecord[],
  currentRecords: AbcRecord[],
  options?: CompareAbcPatternsOptions,
): AbcPatternComparison {
  const threshold = options?.changeRateThreshold ?? DEFAULT_CHANGE_THRESHOLD;
  const topN = options?.topN ?? DEFAULT_TOP_N;

  // 前期・今期の場面別頻度
  const prevFreq = computeSettingFrequencies(previousRecords);
  const currFreq = computeSettingFrequencies(currentRecords);

  // 全場面のセットを作成
  const allSettings = new Set<string>();
  for (const f of prevFreq) allSettings.add(f.setting);
  for (const f of currFreq) allSettings.add(f.setting);

  // 場面別の変化を計算
  const settingChanges: SettingChange[] = [];
  const newSettings: string[] = [];
  const disappearedSettings: string[] = [];

  for (const setting of allSettings) {
    const prev = prevFreq.find(f => f.setting === setting);
    const curr = currFreq.find(f => f.setting === setting);

    const prevCount = prev?.count ?? 0;
    const currCount = curr?.count ?? 0;
    const prevRatio = prev?.ratio ?? 0;
    const currRatio = curr?.ratio ?? 0;
    const changeRate = prevCount > 0
      ? (currCount - prevCount) / prevCount
      : currCount > 0 ? 1.0 : 0;

    let changeType: SettingChange['changeType'];
    if (prevCount === 0 && currCount > 0) {
      changeType = 'new';
      newSettings.push(setting);
    } else if (prevCount > 0 && currCount === 0) {
      changeType = 'disappeared';
      disappearedSettings.push(setting);
    } else if (changeRate > threshold) {
      changeType = 'increased';
    } else if (changeRate < -threshold) {
      changeType = 'decreased';
    } else {
      changeType = 'stable';
    }

    settingChanges.push({
      setting,
      changeType,
      previousCount: prevCount,
      currentCount: currCount,
      previousRatio: prevRatio,
      currentRatio: currRatio,
      changeRate: Math.round(changeRate * 100) / 100,
    });
  }

  // 変化量降順にソート
  settingChanges.sort((a, b) => Math.abs(b.changeRate) - Math.abs(a.changeRate));
  const topChanges = settingChanges.slice(0, topN);

  // 顕著な増減
  const significantIncreases = topChanges.filter(c => c.changeType === 'increased' && c.changeRate >= threshold);
  const significantDecreases = topChanges.filter(c => c.changeType === 'decreased' && c.changeRate <= -threshold);

  // 強度分布
  const intensityShift = computeIntensityShift(previousRecords, currentRecords);

  // アラート生成
  const alerts = generateAlerts(topChanges, intensityShift, newSettings, disappearedSettings);

  // 総合評価
  const overallChangeLevel = evaluateOverallChange(topChanges, intensityShift, alerts);

  return {
    previousCount: previousRecords.length,
    currentCount: currentRecords.length,
    settingChanges: topChanges,
    newSettings,
    disappearedSettings,
    significantIncreases,
    significantDecreases,
    intensityShift,
    alerts,
    overallChangeLevel,
  };
}

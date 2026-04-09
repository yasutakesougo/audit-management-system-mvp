/**
 * regulatoryHud — 制度適合 HUD 信号灯の判定ロジック
 *
 * P2-B: RegulatorySummaryBand のチップを
 * 「見れば次の対応が分かる」信号灯 UI に進化させる。
 *
 * 設計原則:
 *  - 純粋関数のみ（React 非依存）
 *  - 判定ロジックと表示を完全分離
 *  - 各項目は group.sub ルートを持ち、クリックで該当タブへ遷移可能
 */

import type { IspComplianceMetadata, IspStatus } from '@/domain/isp/schema';
import type { DeadlineInfo } from '../types';
import type { SectionKey } from '../types';

// ────────────────────────────────────────────
// 信号灯型定義
// ────────────────────────────────────────────

/** 信号の三段階: ok / warning / danger */
export type RegulatorySignal = 'ok' | 'warning' | 'danger';

/** 信号灯 HUD の1項目 */
export type RegulatoryHudItem = {
  /** 一意識別子 */
  key: string;
  /** 表示ラベル（短い自然言語） */
  label: string;
  /** 信号色 */
  signal: RegulatorySignal;
  /** 補足テキスト（ツールチップ / 副テキスト用） */
  detail?: string;
  /** クリック時の遷移先 SectionKey */
  navigateTo?: SectionKey;
};

// ────────────────────────────────────────────
// 入力型
// ────────────────────────────────────────────

export type RegulatoryHudInput = {
  /** ISP ステータス */
  ispStatus: IspStatus;
  /** コンプライアンスメタデータ（null = 制度適合タブ未設定） */
  compliance: IspComplianceMetadata | null;
  /** 期限情報 */
  deadlines: {
    creation: DeadlineInfo;
    monitoring: DeadlineInfo;
  };
  /** 最新モニタリング情報 */
  latestMonitoring: { date: string; planChangeRequired: boolean } | null | undefined;
  /** Iceberg 分析件数合計 */
  icebergTotal: number;
};

// ────────────────────────────────────────────
// 個別判定関数
// ────────────────────────────────────────────

/** ISP 確定状況を判定する */
function judgeIspStatus(status: IspStatus): RegulatoryHudItem {
  if (status === 'active') {
    return {
      key: 'isp-status',
      label: '個別支援計画確定済み',
      signal: 'ok',
      navigateTo: 'overview',
    };
  }
  return {
    key: 'isp-status',
    label: '個別支援計画未確定',
    signal: 'danger',
    detail: '個別支援計画が確定されていません。計画を完成させてください。',
    navigateTo: 'overview',
  };
}

/** 同意取得状況を判定する */
function judgeConsent(compliance: IspComplianceMetadata | null): RegulatoryHudItem {
  if (!compliance) {
    return {
      key: 'consent',
      label: '同意未取得',
      signal: 'danger',
      detail: '同意記録が設定されていません。',
      navigateTo: 'compliance',
    };
  }

  const { consent } = compliance;
  if (consent.consentedAt && consent.consentedBy) {
    return {
      key: 'consent',
      label: '同意取得済み',
      signal: 'ok',
      navigateTo: 'compliance',
    };
  }

  if (consent.explainedAt) {
    return {
      key: 'consent',
      label: '説明済み・同意待ち',
      signal: 'warning',
      detail: '説明は実施済みですが、同意がまだ取得されていません。',
      navigateTo: 'compliance',
    };
  }

  return {
    key: 'consent',
    label: '同意未取得',
    signal: 'danger',
    detail: '同意記録が未入力です。',
    navigateTo: 'compliance',
  };
}

/** 交付状況を判定する */
function judgeDelivery(compliance: IspComplianceMetadata | null): RegulatoryHudItem {
  if (!compliance) {
    return {
      key: 'delivery',
      label: '交付未完了',
      signal: 'danger',
      detail: '交付記録が設定されていません。',
      navigateTo: 'compliance',
    };
  }

  const { delivery } = compliance;
  if (delivery.deliveredToUser && delivery.deliveredToConsultationSupport) {
    return {
      key: 'delivery',
      label: '交付完了',
      signal: 'ok',
      navigateTo: 'compliance',
    };
  }

  if (delivery.deliveredToUser || delivery.deliveredToConsultationSupport) {
    return {
      key: 'delivery',
      label: '交付一部完了',
      signal: 'warning',
      detail: delivery.deliveredToUser
        ? '相談支援専門員への交付がまだです。'
        : '本人への交付がまだです。',
      navigateTo: 'compliance',
    };
  }

  return {
    key: 'delivery',
    label: '交付未完了',
    signal: 'danger',
    detail: '計画の交付がまだ行われていません。',
    navigateTo: 'compliance',
  };
}

/** 作成期限を判定する */
function judgeCreationDeadline(deadline: DeadlineInfo): RegulatoryHudItem {
  if (deadline.daysLeft == null || deadline.date == null) {
    return {
      key: 'creation-deadline',
      label: '作成期限未設定',
      signal: 'warning',
      detail: '計画期間を入力すると作成期限が計算されます。',
      navigateTo: 'overview',
    };
  }

  if (deadline.daysLeft < 0) {
    return {
      key: 'creation-deadline',
      label: `作成期限 ${Math.abs(deadline.daysLeft)}日超過`,
      signal: 'danger',
      detail: `作成期限を${Math.abs(deadline.daysLeft)}日超過しています。`,
      navigateTo: 'overview',
    };
  }

  if (deadline.daysLeft === 0) {
    return {
      key: 'creation-deadline',
      label: '作成期限 本日',
      signal: 'danger',
      detail: '作成期限が本日です。',
      navigateTo: 'overview',
    };
  }

  if (deadline.daysLeft <= 7) {
    return {
      key: 'creation-deadline',
      label: `作成期限 残${deadline.daysLeft}日`,
      signal: 'warning',
      detail: `作成期限まで残り${deadline.daysLeft}日です。`,
      navigateTo: 'overview',
    };
  }

  return {
    key: 'creation-deadline',
    label: `作成期限 残${deadline.daysLeft}日`,
    signal: 'ok',
    navigateTo: 'overview',
  };
}

/** モニタリング期限を判定する */
function judgeMonitoringDeadline(deadline: DeadlineInfo): RegulatoryHudItem {
  if (deadline.daysLeft == null || deadline.date == null) {
    return {
      key: 'monitoring-deadline',
      label: 'モニタ期限未設定',
      signal: 'warning',
      detail: 'モニタリング計画を入力すると期限が計算されます。',
      navigateTo: 'monitoring',
    };
  }

  if (deadline.daysLeft < 0) {
    return {
      key: 'monitoring-deadline',
      label: `モニタ期限 ${Math.abs(deadline.daysLeft)}日超過`,
      signal: 'danger',
      detail: `モニタリング期限を${Math.abs(deadline.daysLeft)}日超過しています。`,
      navigateTo: 'monitoring',
    };
  }

  if (deadline.daysLeft === 0) {
    return {
      key: 'monitoring-deadline',
      label: 'モニタ期限 本日',
      signal: 'danger',
      detail: 'モニタリング期限が本日です。',
      navigateTo: 'monitoring',
    };
  }

  if (deadline.daysLeft <= 14) {
    return {
      key: 'monitoring-deadline',
      label: `モニタ期限 残${deadline.daysLeft}日`,
      signal: 'warning',
      detail: `モニタリング期限まで残り${deadline.daysLeft}日です。`,
      navigateTo: 'monitoring',
    };
  }

  return {
    key: 'monitoring-deadline',
    label: `モニタ期限 残${deadline.daysLeft}日`,
    signal: 'ok',
    navigateTo: 'monitoring',
  };
}

/**
 * Iceberg 分析 / 再分析推奨を判定する。
 *
 * ルール:
 * - latestMonitoring.planChangeRequired === true → 再分析推奨（warning）
 * - latestMonitoring がない → 未実施（danger）
 * - latestMonitoring が 180 日以上前 → 再分析推奨（warning）
 * - それ以外で icebergTotal > 0 → OK
 * - icebergTotal === 0 → warning（分析がまだ）
 */
function judgeIcebergAnalysis(
  latestMonitoring: { date: string; planChangeRequired: boolean } | null | undefined,
  icebergTotal: number,
): RegulatoryHudItem {
  if (!latestMonitoring) {
    return {
      key: 'iceberg-analysis',
      label: 'モニタリング未実施',
      signal: 'danger',
      detail: 'モニタリングが一度も実施されていません。',
      navigateTo: 'monitoring',
    };
  }

  if (latestMonitoring.planChangeRequired) {
    return {
      key: 'iceberg-analysis',
      label: '再分析推奨',
      signal: 'warning',
      detail: 'モニタリングにより計画変更が推奨されています。',
      navigateTo: 'monitoring',
    };
  }

  const daysSince = Math.floor(
    (Date.now() - new Date(latestMonitoring.date).getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysSince >= 180) {
    return {
      key: 'iceberg-analysis',
      label: '再分析推奨',
      signal: 'warning',
      detail: `前回モニタリングから${daysSince}日経過（180日以上）。`,
      navigateTo: 'monitoring',
    };
  }

  if (icebergTotal > 0) {
    return {
      key: 'iceberg-analysis',
      label: `Iceberg分析 ${icebergTotal}件`,
      signal: 'ok',
      navigateTo: 'monitoring',
    };
  }

  return {
    key: 'iceberg-analysis',
    label: 'Iceberg分析なし',
    signal: 'warning',
    detail: 'Iceberg分析がまだ実施されていません。',
    navigateTo: 'monitoring',
  };
}

// ────────────────────────────────────────────
// メインビルダー
// ────────────────────────────────────────────

/**
 * 制度 HUD 信号灯項目を生成する。
 *
 * 6項目を固定順で返す:
 * 1. ISP確定状況
 * 2. 同意取得状況
 * 3. 交付状況
 * 4. 作成期限
 * 5. モニタリング期限
 * 6. Iceberg分析 / 再分析推奨
 */
export function buildRegulatoryHudItems(input: RegulatoryHudInput): RegulatoryHudItem[] {
  return [
    judgeIspStatus(input.ispStatus),
    judgeConsent(input.compliance),
    judgeDelivery(input.compliance),
    judgeCreationDeadline(input.deadlines.creation),
    judgeMonitoringDeadline(input.deadlines.monitoring),
    judgeIcebergAnalysis(input.latestMonitoring, input.icebergTotal),
  ];
}

// ────────────────────────────────────────────
// ヘルパー: 全体ステータスの導出
// ────────────────────────────────────────────

/**
 * HUD 項目群から、最も深刻な信号を返す。
 * UI 側でバンドのボーダー色等に使う。
 */
export function worstSignal(items: RegulatoryHudItem[]): RegulatorySignal {
  if (items.some((i) => i.signal === 'danger')) return 'danger';
  if (items.some((i) => i.signal === 'warning')) return 'warning';
  return 'ok';
}

/**
 * 信号ごとの件数を返す。
 */
export function signalCounts(items: RegulatoryHudItem[]): Record<RegulatorySignal, number> {
  return {
    ok: items.filter((i) => i.signal === 'ok').length,
    warning: items.filter((i) => i.signal === 'warning').length,
    danger: items.filter((i) => i.signal === 'danger').length,
  };
}

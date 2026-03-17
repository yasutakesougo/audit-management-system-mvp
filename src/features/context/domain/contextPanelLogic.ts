/**
 * @fileoverview ContextPanel のデータモデルと集約ロジック
 * @description
 * MVP-005: DailyRecord 入力時に参照できるコンテキストパネル。
 *
 * 4つのセクション:
 * 1. 支援計画サマリー (ISP goals)
 * 2. 最新申し送り (Handoff)
 * 3. 最近の記録 (Recent Daily Records)
 * 4. 注意事項 (Alerts)
 *
 * 純粋関数で分離し、UIと独立にテスト可能。
 */

// ─── セクション型定義 ────────────────────────────────────────

export type ContextSupportPlan = {
  status: 'confirmed' | 'draft' | 'none';
  planPeriod: string;
  goals: Array<{
    type: 'long' | 'short' | 'support';
    label: string;
    text: string;
  }>;
};

export type ContextHandoff = {
  id: string;
  message: string;
  category: string;
  severity: string;
  status: string;
  createdAt: string;
};

export type ContextRecentRecord = {
  date: string;
  status: string;
  amNotes?: string;
  pmNotes?: string;
  specialNotes?: string;
};

export type ContextAlert = {
  key: string;
  level: 'info' | 'warning' | 'error';
  message: string;
};

export type ContextPanelData = {
  supportPlan: ContextSupportPlan;
  handoffs: ContextHandoff[];
  recentRecords: ContextRecentRecord[];
  alerts: ContextAlert[];
};

// ─── アラート生成（純粋関数） ──────────────────────────────────

/**
 * コンテキストデータからアラート一覧を生成する
 */
export function buildContextAlerts(params: {
  supportPlan: ContextSupportPlan;
  handoffs: ContextHandoff[];
  recentRecords: ContextRecentRecord[];
  isHighIntensity: boolean;
  isSupportProcedureTarget: boolean;
}): ContextAlert[] {
  const alerts: ContextAlert[] = [];

  // 支援計画未作成
  if (params.supportPlan.status === 'none') {
    alerts.push({
      key: 'isp-missing',
      level: 'warning',
      message: '個別支援計画書が未作成です',
    });
  }

  // 重要申し送りあり
  const criticalHandoffs = params.handoffs.filter(
    (h) => h.severity === '重要' && h.status !== '完了' && h.status !== '確認済',
  );
  if (criticalHandoffs.length > 0) {
    alerts.push({
      key: 'critical-handoff',
      level: 'error',
      message: `重要な申し送りが${criticalHandoffs.length}件あります`,
    });
  }

  // 直近記録なし（3日以上前 or 0件）
  if (params.recentRecords.length === 0) {
    alerts.push({
      key: 'no-recent-records',
      level: 'info',
      message: '直近の記録がありません',
    });
  }

  // 強度行動障害対象者
  if (params.isHighIntensity) {
    alerts.push({
      key: 'high-intensity',
      level: 'warning',
      message: '強度行動障害対象者です — 支援手順を確認してください',
    });
  }

  // 支援手順対象者
  if (params.isSupportProcedureTarget && !params.isHighIntensity) {
    alerts.push({
      key: 'support-procedure',
      level: 'info',
      message: '支援手順対象者です',
    });
  }

  return alerts;
}

/**
 * 空のコンテキストデータを生成
 */
export function createEmptyContextData(): ContextPanelData {
  return {
    supportPlan: { status: 'none', planPeriod: '', goals: [] },
    handoffs: [],
    recentRecords: [],
    alerts: [],
  };
}

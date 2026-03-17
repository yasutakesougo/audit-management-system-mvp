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
  summary: string;
  prompts: string[];
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
    summary: '直近の関連履歴はありません。',
    prompts: ['💡 本日の利用者の様子で気になった些細な変化や気づきを記録してください。'],
  };
}

// ─── 新規追加: MVP-009 履歴要約と推奨プロンプト抽出 ────────────────────────

/**
 * 過去の申し送りと記録から、短い履歴要約（1〜3文）を生成する
 */
export function buildContextSummary(
  records: ContextRecentRecord[],
  handoffs: ContextHandoff[]
): string {
  const parts: string[] = [];

  const recentCritical = handoffs.filter(
    (h) => h.severity === '重要' && h.status !== '完了' && h.status !== '確認済'
  );
  if (recentCritical.length > 0) {
    parts.push(`未対応の重要な申し送りが${recentCritical.length}件あります。`);
  }

  const specialNotes = records.filter((r) => !!r.specialNotes).slice(0, 2);
  if (specialNotes.length > 0) {
    parts.push(`直近の記録に特記事項あり（${specialNotes.length}件）。`);
  }

  if (parts.length === 0) {
    if (records.length > 0) {
      parts.push(`直近${records.length}回の記録は特筆すべき問題なく完了しています。`);
    } else {
      parts.push('直近の関連履歴はありません。');
    }
  }

  return parts.join(' ');
}

/**
 * 支援計画やアラート状態から、今回の記録で確認すべき「推奨アクション」を抽出する
 */
export function buildRecommendedPrompts(
  plan: ContextSupportPlan,
  isHighIntensity: boolean,
  isSupportProcedureTarget: boolean
): string[] {
  const prompts: string[] = [];

  if (isHighIntensity) {
    prompts.push('💡 強度行動障害の支援手順書に沿った対応ができているか確認してください。');
  } else if (isSupportProcedureTarget) {
    prompts.push('💡 個別支援手順書に基づく対応ができているか確認してください。');
  }

  const supportGoals = plan.goals.filter((g) => g.type === 'support' || g.type === 'short').slice(0, 2);
  for (const goal of supportGoals) {
    prompts.push(`💡 目標「${goal.label}」に対する本日のアプローチ結果はどうでしたか？`);
  }

  if (prompts.length === 0) {
    prompts.push('💡 本日の利用者の様子で気になった些細な変化や気づきを記録してください。');
  }

  return prompts.slice(0, 3); // 最大3件
}

/**
 * アラートを優先度順 (error -> warning -> info) に並び替える
 */
export function prioritizeContextAlerts(alerts: ContextAlert[]): ContextAlert[] {
  const priorityMap = { error: 0, warning: 1, info: 2 };
  return [...alerts].sort((a, b) => priorityMap[a.level] - priorityMap[b.level]);
}

/**
 * 共有 目標データモデル
 *
 * isp-editor / support-plan-guide で共通利用する
 * GoalItem 関連の型定義・定数。
 *
 * ※ ISPPlan, StatusStep など ISP 固有の型はここに置かない。
 */

/* ─── 型定義 ─── */

export interface DomainDef {
  id: string;
  label: string;
  color: string;
  bg: string;
}

export interface GoalItem {
  id: string;
  type: 'long' | 'short' | 'support';
  label: string;
  text: string;
  domains: string[];
}

export interface SmartCriterion {
  key: string;
  label: string;
  hint: string;
}

/* ─── 定数 ─── */

export const DOMAINS: DomainDef[] = [
  { id: 'health',    label: '健康・生活',                color: '#ef4444', bg: '#fef2f2' },
  { id: 'motor',     label: '運動・感覚',                color: '#f59e0b', bg: '#fffbeb' },
  { id: 'cognitive', label: '認知・行動',                color: '#3b82f6', bg: '#eff6ff' },
  { id: 'language',  label: '言語・コミュニケーション',  color: '#8b5cf6', bg: '#f5f3ff' },
  { id: 'social',    label: '人間関係・社会性',          color: '#10b981', bg: '#ecfdf5' },
];

export const SMART_CRITERIA: SmartCriterion[] = [
  { key: 'S', label: 'Specific（具体的）',   hint: '誰が・何を・どこで明確に' },
  { key: 'M', label: 'Measurable（測定可能）', hint: '数値や頻度で測定できるか' },
  { key: 'A', label: 'Achievable（達成可能）', hint: '本人の能力・環境で実現可能か' },
  { key: 'R', label: 'Relevant（関連性）',    hint: '本人のニーズ・希望に合致するか' },
  { key: 'T', label: 'Time-bound（期限）',    hint: '達成期限が明確か' },
];

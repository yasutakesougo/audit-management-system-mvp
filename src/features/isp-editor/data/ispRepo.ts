/**
 * C層: ISPデータリポジトリ
 * 現在はモック。将来 SharePoint 実装へ差し替え。
 */

/* ─── shared re-exports（後方互換） ─── */
export { parseYmdLocal } from '@/features/isp/shared/date';
export { DOMAINS } from '@/features/isp/shared/domains';
export type { DomainDef } from '@/features/isp/shared/domains';
export { computeDiff } from '@/features/isp/shared/diff';
export type { DiffSegment } from '@/features/isp/shared/diff';

/* ─── 型定義 ─── */

export interface GoalItem {
  id: string;
  type: 'long' | 'short' | 'support';
  label: string;
  text: string;
  domains: string[];
}

export interface ISPPlan {
  userName: string;
  certExpiry: string;      // YYYY-MM-DD
  planPeriod: string;       // 表示用テキスト
  status: 'confirmed' | 'draft';
  goals: GoalItem[];
}

export interface StatusStep {
  key: string;
  label: string;
  done?: boolean;
}

export interface SmartCriterion {
  key: string;
  label: string;
  hint: string;
}

/* ─── 定数 ─── */

export const SMART_CRITERIA: SmartCriterion[] = [
  { key: 'S', label: 'Specific（具体的）',   hint: '誰が・何を・どこで明確に' },
  { key: 'M', label: 'Measurable（測定可能）', hint: '数値や頻度で測定できるか' },
  { key: 'A', label: 'Achievable（達成可能）', hint: '本人の能力・環境で実現可能か' },
  { key: 'R', label: 'Relevant（関連性）',    hint: '本人のニーズ・希望に合致するか' },
  { key: 'T', label: 'Time-bound（期限）',    hint: '達成期限が明確か' },
];

export const STATUS_STEPS: StatusStep[] = [
  { key: 'assessment', label: 'アセスメント完了' },
  { key: 'goals',      label: '目標設定' },
  { key: 'supports',   label: '支援内容記入' },
  { key: 'domains',    label: '5領域チェック' },
  { key: 'review',     label: '確認・承認' },
];

/* ─── モックデータ ─── */

export const MOCK_PREVIOUS: ISPPlan = {
  userName: '山田 太郎',
  certExpiry: '2026-05-31',
  planPeriod: '2025年4月〜2025年9月',
  status: 'confirmed',
  goals: [
    {
      id: 'g1', type: 'long', label: '長期目標',
      text: '日中活動に主体的に参加し、生活リズムを安定させる',
      domains: ['health', 'social'],
    },
    {
      id: 'g2', type: 'short', label: '短期目標①',
      text: '週3回以上、創作活動に自ら参加する',
      domains: ['cognitive', 'motor'],
    },
    {
      id: 'g3', type: 'short', label: '短期目標②',
      text: '朝の会で挨拶を自発的に行う',
      domains: ['language', 'social'],
    },
    {
      id: 'g4', type: 'support', label: '具体的支援内容①',
      text: '創作活動の前に、本人の好みの素材を提示し、選択を促す。活動中は見守りつつ、困った時に声かけを行う。',
      domains: ['cognitive'],
    },
    {
      id: 'g5', type: 'support', label: '具体的支援内容②',
      text: '朝の会の前に「今日の挨拶係」カードを渡し、役割意識を持てるよう支援する。',
      domains: ['language', 'social'],
    },
  ],
};

export function createEmptyCurrentPlan(userName = '山田 太郎', certExpiry = '2026-05-31'): ISPPlan {
  return {
    userName,
    certExpiry,
    planPeriod: '2025年10月〜2026年3月',
    status: 'draft',
    goals: [
      { id: 'g1', type: 'long',    label: '長期目標',         text: '', domains: [] },
      { id: 'g2', type: 'short',   label: '短期目標①',       text: '', domains: [] },
      { id: 'g3', type: 'short',   label: '短期目標②',       text: '', domains: [] },
      { id: 'g4', type: 'support', label: '具体的支援内容①', text: '', domains: [] },
      { id: 'g5', type: 'support', label: '具体的支援内容②', text: '', domains: [] },
    ],
  };
}

/* ─── LocalStorage Draft ─── */

const ISP_DRAFT_KEY = 'isp-editor.draft.v1';

export function draftKey(userId: string, planPeriod: string): string {
  return `${ISP_DRAFT_KEY}:${userId}:${planPeriod}`;
}

export function loadDraft(userId: string, planPeriod: string): ISPPlan | null {
  try {
    const raw = localStorage.getItem(draftKey(userId, planPeriod));
    if (!raw) return null;
    return JSON.parse(raw) as ISPPlan;
  } catch {
    return null;
  }
}

export function saveDraft(userId: string, planPeriod: string, plan: ISPPlan): { savedAt: number } {
  const savedAt = Date.now();
  localStorage.setItem(draftKey(userId, planPeriod), JSON.stringify(plan));
  return { savedAt };
}

export function deleteDraft(userId: string, planPeriod: string): void {
  localStorage.removeItem(draftKey(userId, planPeriod));
}

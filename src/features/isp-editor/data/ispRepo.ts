/**
 * C層: ISPデータリポジトリ
 * 現在はモック。将来 SharePoint 実装へ差し替え。
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

export function createEmptyCurrentPlan(): ISPPlan {
  return {
    userName: '山田 太郎',
    certExpiry: '2026-05-31',
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

/* ─── ユーティリティ ─── */

/** YYYY-MM-DD をローカル日付として解釈（JST 1日ズレ対策） */
export function parseYmdLocal(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d); // local midnight
}

/** LCS-based character-level diff */
export interface DiffSegment {
  type: 'same' | 'add' | 'del';
  text: string;
}

export function computeDiff(oldText: string, newText: string): DiffSegment[] {
  if (!oldText && !newText) return [];
  if (!oldText) return [{ type: 'add', text: newText }];
  if (!newText) return [{ type: 'del', text: oldText }];
  if (oldText === newText) return [{ type: 'same', text: oldText }];

  const oldChars = oldText.split('');
  const newChars = newText.split('');
  const m = oldChars.length;
  const n = newChars.length;

  // LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = oldChars[i - 1] === newChars[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);

  // Backtrace
  const rev: DiffSegment[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldChars[i - 1] === newChars[j - 1]) {
      rev.push({ type: 'same', text: oldChars[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      rev.push({ type: 'add', text: newChars[j - 1] });
      j--;
    } else {
      rev.push({ type: 'del', text: oldChars[i - 1] });
      i--;
    }
  }
  rev.reverse();

  // Merge consecutive same-type segments
  const result: DiffSegment[] = [];
  for (const seg of rev) {
    if (result.length && result[result.length - 1].type === seg.type) {
      result[result.length - 1].text += seg.text;
    } else {
      result.push({ ...seg });
    }
  }
  return result;
}

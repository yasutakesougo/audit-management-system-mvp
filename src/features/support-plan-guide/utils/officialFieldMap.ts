/**
 * officialFieldMap — Support Plan Guide 公式帳票マッピング SSOT
 * 
 * 内部モデル (SupportPlanExportModel) の各フィールドが、
 * 公式帳票（個別支援計画書 / 強度行動障害支援計画シート）の
 * どのセクション/項目に対応するかを再帰的に定義する。
 * 
 * これにより、Adapter 側はレイアウト（Excel/PDF）に集中でき、
 * 意味的マッピングはここで一元管理される。
 */

export const OFFICIAL_ISP_MAP = {
  header: {
    userName: '利用者氏名',
    level: '障害支援区分',
    period: '計画作成期間',
    attending: '通所日数・時間',
  },
  assessment: {
    summary: '本人の意向・アセスメント結果',
    decision: '意思決定支援の配慮',
  },
  goals: {
    long: '長期目標',
    short: '短期目標',
    measures: '支援内容・具体的方策',
  },
  management: {
    monitoring: 'モニタリング時期・方法',
    risk: '緊急時の対応等（安全確保）',
    rights: '権利擁護（身体拘束等の例外規定）',
  },
} as const;

export const OFFICIAL_IBD_MAP = {
  identification: {
    name: '氏名',
    date: '作成日',
  },
  behavior: {
    adjustment: '環境調整・コミュニケーションの配慮',
    pbs: 'PBS（ポジティブな行動支援）に基づく対応手順',
  },
  safety: {
    risk: 'リスク管理・緊急時対応計画',
  },
} as const;

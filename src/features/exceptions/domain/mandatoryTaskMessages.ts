/**
 * @fileoverview 行動強制OS (Action Enforcement OS) 標準メッセージテンプレート
 * @description
 * 現場の認知負荷を下げるため、異なるUI部品間で文言を完全に一致させる。
 */

export interface MandatoryTaskMessage {
  /** Hero Card用タイトル */
  heroTitle: string;
  /** Hero Card用説明文 */
  heroDescription: string;
  /** Guardロック画面での詳細メッセージ */
  blockingMessage: string;
  /** Guardロック画面での解除ヒント */
  resolutionHint: string;
}

export type MandatoryTaskCategory = 
  | 'SCHEMA_DRIFT' 
  | 'MISSING_RECORD' 
  | 'PLAN_GAP' 
  | 'CRITICAL_HANDOFF'
  | 'DEFAULT';

export const MANDATORY_TASK_MESSAGES: Record<MandatoryTaskCategory, MandatoryTaskMessage> = {
  SCHEMA_DRIFT: {
    heroTitle: 'システム構成の修復',
    heroDescription: 'データ整合性に課題があります。自動修復を実行してください。',
    blockingMessage: 'システム構成に不整合が検出されたため、他の操作を制限しています。',
    resolutionHint: '解除条件：管理コンソールから自動修復を実行し、正常な状態に戻すこと。',
  },
  MISSING_RECORD: {
    heroTitle: '必須記録の入力',
    heroDescription: '本日分および未完了の必須業務記録が残っています。',
    blockingMessage: '本日分の必須業務記録が未完了のため、先に対応を完了させてください。',
    resolutionHint: '解除条件：対象の業務を完了するか、内容を確認（承諾）すること。',
  },
  PLAN_GAP: {
    heroTitle: '計画内容の隔たり確認',
    heroDescription: '個別支援計画と実績に乖離があります。内容を確認してください。',
    blockingMessage: '計画と実態に乖離があるため、安全な支援継続のために内容を確認してください。',
    resolutionHint: '解除条件：詳細画面で計画との差分を確認し、承諾すること。',
  },
  CRITICAL_HANDOFF: {
    heroTitle: '緊急申し送りの確認',
    heroDescription: '本日最優先で確認すべき重要連絡があります。',
    blockingMessage: '緊急かつ重大な申し送りがあります。内容を十分に確認してください。',
    resolutionHint: '解除条件：申し送り詳細の内容を読み、確認チェックを入れること。',
  },
  DEFAULT: {
    heroTitle: '必須業務への対応',
    heroDescription: '優先対応が必要な業務があります。内容を確認してください。',
    blockingMessage: '本日分の必須業務が未完了のため、先に対応してください。',
    resolutionHint: '解除条件：表示されている必須業務を確認し、完了または承諾すること。',
  },
};

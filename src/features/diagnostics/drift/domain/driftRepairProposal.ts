import type { DriftType } from './driftLogic';

/**
 * 実行するアクションの種類
 * 
 * - fix-case: 物理名のケース不一致を正規化する（安全）
 * - sanitize: 予約文字や異常文字をクリーンアップする（安全）
 * - migrate: カラムサフィックス不一致等の場合、新カラムへデータを移行する（要レビュー）
 * - add-index: 欠落しているインデックスを追加する（安全）
 * - manual-review: 自動判断不能な場合、管理者が手動で判断する
 */
export type RepairActionKind = 
  | 'fix-case' 
  | 'sanitize' 
  | 'migrate' 
  | 'add-index'
  | 'manual-review';

export interface RepairProposal {
  /** 修復による影響の説明 */
  impact: string;
  /** 手動レビューが必要か（データ移行を伴う、または破壊的変更の可能性がある場合 true） */
  requiresReview: boolean;
  /** 修復詳細画面へのパス（クエリパラメータ等を含む） */
  actionPath: string;
  /** 自動修復で使用するアクション識別子 */
  actionKind: RepairActionKind;
}

/**
 * ドリフトの種類に応じた修復プランを取得する
 */
export const getDriftRepairProposal = (
  listName: string,
  fieldName: string,
  driftType: DriftType | undefined
): RepairProposal => {
  const commonPath = `/settings/system/diagnostics/remediation?list=${listName}&field=${fieldName}`;

  switch (driftType) {
    case 'case_mismatch':
      return {
        impact: '物理列名の大文字小文字を定義に合わせます。アプリのクエリ安定性が向上します。',
        requiresReview: false,
        actionPath: commonPath,
        actionKind: 'fix-case',
      };
    case 'suffix_mismatch':
      return {
        impact: 'サフィックス付きの列（例: Name0）から正規の列へデータを移行する必要があります。',
        requiresReview: true,
        actionPath: commonPath,
        actionKind: 'migrate',
      };
    case 'missing_index':
      return {
        impact: 'この列はクエリ効率化のためにインデックスが必要です。インデックスを追加します。',
        requiresReview: false,
        actionPath: commonPath,
        actionKind: 'add-index',
      };
    case 'fuzzy_match':
    default:
      return {
        impact: '物理名の曖昧一致（内部変換）が検知されました。整合性を確認してください。',
        requiresReview: false,
        actionPath: commonPath,
        actionKind: 'sanitize',
      };
  }
};

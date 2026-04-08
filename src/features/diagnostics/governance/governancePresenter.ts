import { GovernanceDecision } from './governanceEngine';

/**
 * ガバナンス・プレゼンテーション・モデル
 * 現場（管理者・職員）向けの表示情報を定義する。
 */
export interface GovernanceUIModel {
  badgeLabel: string;
  badgeColor: 'blue' | 'yellow' | 'red' | 'gray';
  statusDescription: string;
  actionCall: string;
}

/**
 * ガバナンスの判定結果を、業務・UI 向けの表示モデルに変換する。
 * 技術用語（auto_heal 等）から業務用語（自動補正等）への翻訳をここで集約する。
 */
export const presentGovernanceDecision = (decision?: GovernanceDecision): GovernanceUIModel => {
  if (!decision) {
    return {
      badgeLabel: '未判定',
      badgeColor: 'gray',
      statusDescription: 'ガバナンス判定は行われていません。',
      actionCall: '手動確認を推奨',
    };
  }

  const { action, riskLevel } = decision;

  switch (action) {
    case 'auto_heal':
      return {
        badgeLabel: '自動補正対象',
        badgeColor: 'blue',
        statusDescription: '信頼済み項目のため、次回 Nightly Patrol で自動補正されます。',
        actionCall: '対応不要（自動）',
      };

    case 'propose':
      return {
        badgeLabel: '管理者確認推奨',
        badgeColor: 'yellow',
        statusDescription: '不整合を検知しました。内容を確認し、修復を実行してください。',
        actionCall: '修復の実行',
      };

    case 'notify':
      return {
        badgeLabel: riskLevel === 'high' ? '要確認（重大）' : '要確認',
        badgeColor: riskLevel === 'high' ? 'red' : 'yellow',
        statusDescription: decision.reason || '不整合が検知されましたが、自動修復の対象外です。',
        actionCall: '詳細ログの確認',
      };

    case 'block':
      return {
        badgeLabel: '自動修復停止',
        badgeColor: 'red',
        statusDescription: '重要項目において予期せぬ乖離があります。破壊的変更を避けるため自動修復を停止しています。',
        actionCall: 'インフラ管理者へ連絡',
      };

    default:
      return {
        badgeLabel: '要確認',
        badgeColor: 'gray',
        statusDescription: '不整合を検知しました。',
        actionCall: '詳細確認',
      };
  }
};

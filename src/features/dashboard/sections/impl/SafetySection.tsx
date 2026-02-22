/**
 * Dashboard Safety Section Component
 *
 * 責務：Safety インジケーター の表示のみ
 * - Parent: Page の renderSection から呼ばれる
 * - Props: 最小限（計算はまだ Page で）
 *
 * Phase 3 で：
 * - props 化（useDashboardSafetySection hook から データ受け取り）
 * - あるいは ViewModel 層で状態を集中管理
 */

import DashboardSafetyHUD from '../../DashboardSafetyHUD';
import React from 'react';

export type SafetySectionProps = {
  // Phase 1-2 では空でOK（既存コンポーネントの中身を活用）
};

export const SafetySection: React.FC<SafetySectionProps> = () => {
  return <DashboardSafetyHUD />;
};


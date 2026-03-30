/**
 * SupportPlanningSheetPage — 支援計画シート画面 (L2)
 *
 * アーキテクチャ更新 (ADR-006): Orchestrator + ViewModel パターンへの完全移行
 * - Page: Thin Container (useSupportPlanningSheetOrchestrator を呼ぶだけ)
 * - Orchestrator: State, Hooks, Logic 集約 (useSupportPlanningSheetOrchestrator)
 * - ViewModel: 表示用データの加工 (Orchestrator 内で合成)
 * - View: Passive UI (SupportPlanningSheetView)
 *
 * @see docs/adr/ADR-006-screen-responsibility-boundaries.md
 * @see docs/architecture/isp-three-layer-rules.md
 */
import React from 'react';
import { useSupportPlanningSheetOrchestrator } from './support-planning-sheet/hooks/useSupportPlanningSheetOrchestrator';
import { SupportPlanningSheetView } from './support-planning-sheet/SupportPlanningSheetView';

export default function SupportPlanningSheetPage() {
  const { viewModel, handlers } = useSupportPlanningSheetOrchestrator();

  return (
    <SupportPlanningSheetView 
      viewModel={viewModel}
      handlers={handlers}
    />
  );
}

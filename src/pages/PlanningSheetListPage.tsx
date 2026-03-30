/**
 * PlanningSheetListPage — 支援計画シート一覧 (L2 Planning サブ画面)
 *
 * アーキテクチャ更新 (ADR-006 準拠):
 * 1. Page (this file): Thin Facade
 * 2. Orchestrator: usePlanningSheetListOrchestrator
 * 3. ViewModel Mapper: planningSheetListViewModelMapper
 * 4. View: PlanningSheetListView
 *
 * @see docs/adr/006-screen-responsibility-boundaries.md
 * @see docs/architecture/isp-three-layer-rules.md
 */
import React from 'react';
import { usePlanningSheetListOrchestrator } from './planning-sheet-list/hooks/usePlanningSheetListOrchestrator';
import { PlanningSheetListView } from './planning-sheet-list/PlanningSheetListView';

export default function PlanningSheetListPage() {
  const { viewModel, handlers } = usePlanningSheetListOrchestrator();

  if (!viewModel) return null;

  return (
    <PlanningSheetListView 
      viewModel={viewModel}
      handlers={handlers} 
    />
  );
}

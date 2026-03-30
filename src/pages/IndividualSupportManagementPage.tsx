/**
 * IndividualSupportManagementPage — 個別支援手順管理 (L1 Monitoring 相当)
 *
 * アーキテクチャ更新 (ADR-006 準拠):
 * 1. Page (this file): Thin Facade — Orchestrator を呼んで View に渡すだけ
 * 2. Orchestrator: useIndividualSupportOrchestrator — データ統合と接着
 * 3. UI State: useIndividualSupportUiState — UI固有の状態管理
 * 4. ViewModel Mapper: individualSupportViewModelMapper — 純粋関数によるデータ加工
 * 5. View: IndividualSupportView — 受動的な描画レイヤー
 *
 * @see docs/adr/006-screen-responsibility-boundaries.md
 * @see docs/architecture/isp-three-layer-rules.md
 */
import React from 'react';
import { useIndividualSupportOrchestrator } from './individual-support/hooks/useIndividualSupportOrchestrator';
import { IndividualSupportView } from './individual-support/IndividualSupportView';

export default function IndividualSupportManagementPage() {
  const { viewModel, handlers } = useIndividualSupportOrchestrator();

  return (
    <IndividualSupportView 
      viewModel={viewModel}
      handlers={handlers} 
    />
  );
}

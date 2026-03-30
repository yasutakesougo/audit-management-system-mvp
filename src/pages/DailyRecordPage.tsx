/**
 * DailyRecordPage — 支援記録 (L0 Daily 相当)
 *
 * アーキテクチャ更新 (ADR-006 準拠):
 * 1. Page (this file): Thin Facade
 * 2. Orchestrator: useDailyRecordOrchestrator
 * 3. UI State: useDailyRecordUiState
 * 4. ViewModel Mapper: dailyRecordViewModelMapper
 * 5. View: DailyRecordView
 *
 * @see docs/adr/006-screen-responsibility-boundaries.md
 * @see docs/architecture/isp-three-layer-rules.md
 */
import React from 'react';
import { useDailyRecordOrchestrator } from './daily-record/hooks/useDailyRecordOrchestrator';
import { DailyRecordView } from './daily-record/DailyRecordView';

export default function DailyRecordPage() {
  const { viewModel, handlers } = useDailyRecordOrchestrator();

  return (
    <DailyRecordView 
      viewModel={viewModel}
      handlers={handlers} 
    />
  );
}

import React from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { buildAbcRecordUrl, buildIcebergPdcaUrl, buildIcebergPdcaUrlWithHighlight } from '@/app/links/navigationLinks';
import type { EvidenceLinkType } from '@/domain/isp/evidenceLink';
import type { UsePlanningSheetFormReturn } from '@/features/planning-sheet/hooks/usePlanningSheetForm';
import type { SheetTabKey } from '../types';

import type { ToastState } from './useSupportPlanningSheetUiState';

type UseSupportPlanningPageHandlersParams = {
  navigate: NavigateFunction;
  setActiveTab: React.Dispatch<React.SetStateAction<SheetTabKey>>;
  sheetUserId: string | undefined;
  /** 支援計画シートID（支援手順の実施ボタンの planningSheetId として渡す） */
  planningSheetId: string | undefined;
  form: UsePlanningSheetFormReturn;
  setIsEditing: React.Dispatch<React.SetStateAction<boolean>>;
  setToast: React.Dispatch<React.SetStateAction<ToastState>>;
};

export function useSupportPlanningPageHandlers({
  navigate,
  setActiveTab,
  sheetUserId,
  planningSheetId,
  form,
  setIsEditing,
  setToast,
}: UseSupportPlanningPageHandlersParams) {
  const handleSave = React.useCallback(async () => {
    const result = await form.save();
    if (!result && form.saveError) {
      setToast({ open: true, message: form.saveError, severity: 'error' });
    }
  }, [form, setToast]);

  const handleReset = React.useCallback(() => {
    form.reset();
    setIsEditing(false);
  }, [form, setIsEditing]);

  const handleBannerNavigate = React.useCallback((href: string) => {
    if (href.startsWith('#tab:')) {
      const tabKey = href.replace('#tab:', '') as SheetTabKey;
      setActiveTab(tabKey);
    } else {
      navigate(href);
    }
  }, [navigate, setActiveTab]);

  const handleJumpToMonitoringHistory = React.useCallback(() => {
    const history = document.getElementById('monitoring-history-timeline');
    history?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleEvidenceClick = React.useCallback((type: EvidenceLinkType, referenceId: string) => {
    if (!sheetUserId) return;
    if (type === 'abc') {
      navigate(buildAbcRecordUrl(sheetUserId, { recordId: referenceId, source: 'support-planning' }));
    } else {
      navigate(buildIcebergPdcaUrlWithHighlight(sheetUserId, referenceId, {
        source: 'support-planning',
        planningSheetId: planningSheetId && planningSheetId !== 'new' ? planningSheetId : undefined,
      }));
    }
  }, [navigate, planningSheetId, sheetUserId]);

  /**
   * 支援手順の実施 → `/daily/support?wizard=user&planningSheetId=xxx`
   *
   * SPS を read-only で参照するブリッジUI へ遷移する。
   * @see docs/adr/ADR-005-isp-three-layer-separation.md — /daily/support State Responsibility
   */
  const handleNavigateToExecution = React.useCallback(() => {
    if (!sheetUserId || !planningSheetId) return;
    const params = new URLSearchParams({
      wizard: 'user',
      userId: sheetUserId,
      planningSheetId,
    });
    navigate(`/daily/support?${params.toString()}`);
  }, [navigate, sheetUserId, planningSheetId]);

  /**
   * 見直し・PDCA → `/analysis/iceberg-pdca?userId=xxx&source=support-planning`
   */
  const handleNavigateToPdca = React.useCallback(() => {
    if (!sheetUserId) return;
    navigate(buildIcebergPdcaUrl(sheetUserId, {
      source: 'support-planning',
      planningSheetId: planningSheetId && planningSheetId !== 'new' ? planningSheetId : undefined,
    }));
  }, [navigate, planningSheetId, sheetUserId]);

  return {
    handleSave,
    handleReset,
    handleBannerNavigate,
    handleJumpToMonitoringHistory,
    handleEvidenceClick,
    handleNavigateToExecution,
    handleNavigateToPdca,
  };
}

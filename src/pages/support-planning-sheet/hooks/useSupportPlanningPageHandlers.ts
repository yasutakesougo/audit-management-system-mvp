import React from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { buildAbcRecordUrl, buildIcebergPdcaUrlWithHighlight } from '@/app/links/navigationLinks';
import type { EvidenceLinkType } from '@/domain/isp/evidenceLink';
import type { UsePlanningSheetFormReturn } from '@/features/planning-sheet/hooks/usePlanningSheetForm';
import type { SheetTabKey } from '../types';

type ToastState = {
  open: boolean;
  message: string;
  severity: 'success' | 'error';
};

type UseSupportPlanningPageHandlersParams = {
  navigate: NavigateFunction;
  setActiveTab: React.Dispatch<React.SetStateAction<SheetTabKey>>;
  sheetUserId: string | undefined;
  form: UsePlanningSheetFormReturn;
  setIsEditing: React.Dispatch<React.SetStateAction<boolean>>;
  setToast: React.Dispatch<React.SetStateAction<ToastState>>;
};

export function useSupportPlanningPageHandlers({
  navigate,
  setActiveTab,
  sheetUserId,
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
      navigate(buildIcebergPdcaUrlWithHighlight(sheetUserId, referenceId, { source: 'support-planning' }));
    }
  }, [navigate, sheetUserId]);

  return {
    handleSave,
    handleReset,
    handleBannerNavigate,
    handleJumpToMonitoringHistory,
    handleEvidenceClick,
  };
}

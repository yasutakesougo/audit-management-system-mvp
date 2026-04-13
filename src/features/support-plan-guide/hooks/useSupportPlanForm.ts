/**
 * useSupportPlanForm — Lightweight Orchestrator
 *
 * SupportPlanGuidePage.tsx から状態管理・副作用・ハンドラを抽出。
 * UIレンダリングは一切含まない純粋なロジック層。
 *
 * Phase 3: SharePoint連携 (非同期 Repository) + localStorage ライトスルーキャッシュ
 *
 * Delegates responsibilities to composable sub-hooks:
 * @see ./useDraftBootstrap.ts - SP/LS initialization + URL param sync
 * @see ./useDraftAutoSave.ts - Auto-save lifecycle
 * @see ./useDraftFieldHandlers.ts - Field/phrase changes
 * @see ./useDraftManagement.ts - Draft CRUD
 * @see ./useDraftExportImport.ts - JSON/MD export/import
 * @see ./useGoalActions.ts - Goal CRUD
 * @see ./draftPersistence.ts - Pure localStorage functions
 */
import type { ConfirmDialogProps } from '@/components/ui/ConfirmDialog';
import React from 'react';

import type { IUserMaster } from '@/features/users/types';
import { filterActiveUsers } from '@/features/users/domain/userLifecycle';
import { useSupportPlanDraftRepository } from '../repositoryFactory';
import type {
    DeadlineInfo,
    SectionKey,
    SupportPlanDraft,
    SupportPlanForm,
    SupportPlanStringFieldKey,
    ToastState,
    UserOption,
} from '../types';
import {
    MAX_DRAFTS,
    NAME_LIMIT,
    REQUIRED_FIELDS,
} from '../types';
import {
    computeDeadlineInfo,
    computeFilledCount,
    createDraft,
    createEmptyForm,
    getGroupReadinessInfo,
    sanitizeValue,
    TAB_GROUPS,
    TabGroupKey,
} from '../utils/helpers';
import { buildSupportPlanMarkdown } from '../utils/markdownExport';
import type { ExportValidationResult } from '../types/export';
import { validateExportContract } from '../utils/exportValidation';

// Sub-hooks
import { useDraftAutoSave } from './useDraftAutoSave';
import { useDraftBootstrap } from './useDraftBootstrap';
import { useDraftExportImport } from './useDraftExportImport';
import { useDraftFieldHandlers } from './useDraftFieldHandlers';
import { useDraftManagement } from './useDraftManagement';
import { useGoalActions } from './useGoalActions';
import { useComplianceForm, type UseComplianceFormReturn } from './useComplianceForm';
import { useIspCreate, type UseIspCreateReturn } from './useIspCreate';
import { useIspRepositories } from './useIspRepositories';

// ────────────────────────────────────────────
// Params & Return type
// ────────────────────────────────────────────

export type UseSupportPlanFormParams = {
  isAdmin: boolean;
  locationSearch: string;
  userList: IUserMaster[];
};

export type UseSupportPlanFormReturn = {
  // ── Sync State ──
  isFetching: boolean;
  isSaving: boolean;
  syncError: string | null;
  drafts: Record<string, SupportPlanDraft>;
  activeDraftId: string;
  activeTab: SectionKey;
  previewMode: 'render' | 'source';
  toast: ToastState;
  liveMessage: string;

  // ── Derived ──
  draftList: SupportPlanDraft[];
  activeDraft: SupportPlanDraft | undefined;
  form: SupportPlanForm;
  markdown: string;
  deadlines: { creation: DeadlineInfo; monitoring: DeadlineInfo };
  auditAlertCount: number;
  filledCount: number;
  completionPercent: number;
  maxDraftsReached: boolean;
  userOptions: UserOption[];
  groupStatus: Record<TabGroupKey, { isLocked: boolean; reason?: string; progress: number; isVisible: boolean }>;
  exportValidation: ExportValidationResult;

  /** P3-D: Direct draft state setter for suggestion decision persistence */
  setDrafts: React.Dispatch<React.SetStateAction<Record<string, SupportPlanDraft>>>;

  // ── Actions ──
  setActiveTab: (tab: SectionKey) => void;
  setActiveDraftId: (id: string) => void;
  setPreviewMode: (mode: 'render' | 'source') => void;
  setToast: (toast: ToastState) => void;
  handleFieldChange: (key: SupportPlanStringFieldKey, value: string) => void;
  handleAppendPhrase: (key: SupportPlanStringFieldKey, phrase: string) => void;
  handleReset: () => void;
  handleCopyMarkdown: () => Promise<void>;
  handleDownloadMarkdown: () => void;
  handleExportJson: () => void;
  handleImportJson: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleAddDraft: () => void;
  handleMasterUserChange: (event: import('@mui/material/Select').SelectChangeEvent<string>) => void;
  handleDeleteDraft: () => void;
  handleRenameDraft: (name: string) => void;

  // ── Goal Actions (Phase 3) ──
  handleGoalChange: (goalId: string, updates: Partial<import('@/features/shared/goal/goalTypes').GoalItem>) => void;
  handleToggleDomain: (goalId: string, domainId: string) => void;
  handleAddGoal: (type: 'long' | 'short' | 'support', defaultLabel: string) => void;
  handleDeleteGoal: (goalId: string) => void;
  /** P3-B: 目標候補を採用して goals に追加 */
  handleAcceptSuggestion: (goal: import('@/features/shared/goal/goalTypes').GoalItem) => void;

  // ── Compliance (A-2) ──
  complianceForm: UseComplianceFormReturn;

  // ── ISP 正式作成 (Phase 3) ──
  ispCreate: UseIspCreateReturn;

  // ── Confirm Dialogs ──
  resetConfirmDialog: ConfirmDialogProps;
};

// ────────────────────────────────────────────
// Hook implementation
// ────────────────────────────────────────────

export function useSupportPlanForm({
  isAdmin,
  locationSearch,
  userList,
}: UseSupportPlanFormParams): UseSupportPlanFormReturn {
  // ── Repository ──
  const repository = useSupportPlanDraftRepository();
  const ispRepos = useIspRepositories();

  // ── Primary state ──
  const [drafts, setDrafts] = React.useState<Record<string, SupportPlanDraft>>({});
  const [activeDraftId, setActiveDraftId] = React.useState<string>('');
  const [activeTab, setActiveTab] = React.useState<SectionKey>('overview');
  const [previewMode, setPreviewMode] = React.useState<'render' | 'source'>('render');
  const [toast, setToast] = React.useState<ToastState>({ open: false, message: '', severity: 'success' });
  const [_lastSavedAt, setLastSavedAt] = React.useState<number | null>(null);
  const [liveMessage, setLiveMessage] = React.useState('');
  const [_selectedMasterUserId, setSelectedMasterUserId] = React.useState('');

  // ── Sync State ──
  const [isFetching, setIsFetching] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [syncError, setSyncError] = React.useState<string | null>(null);

  // ── Refs ──
  const initialised = React.useRef(false);

  // ── Normalise user list ──
  type LegacyUserRecord = IUserMaster & { UserId?: string; DisplayName?: string };
  const masterUsers: IUserMaster[] = React.useMemo(
    () =>
      (userList as LegacyUserRecord[]).map((user) => ({
        ...user,
        UserID: user.UserID ?? user.UserId ?? '',
        FullName: user.FullName ?? user.DisplayName ?? '',
      })),
    [userList],
  );

  // ── Derived values ──
  const userOptions = React.useMemo<UserOption[]>(() => {
    return filterActiveUsers(masterUsers ?? [])
      .map((user) => {
        const baseName = user.FullName?.trim() || user.UserID?.trim() || `ID:${user.Id}`;
        const sanitizedLabel = sanitizeValue(baseName, NAME_LIMIT);
        const code = user.UserID?.trim();
        const label = code ? `${sanitizedLabel}（${code}）` : sanitizedLabel;
        return { id: String(user.Id), label, user };
      })
      .sort((a, b) => a.label.localeCompare(b.label, 'ja'));
  }, [masterUsers]);

  const draftList = React.useMemo(
    () => Object.values(drafts).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [drafts],
  );
  const activeDraft = activeDraftId ? drafts[activeDraftId] : undefined;
  const form = React.useMemo(() => {
    const rawData = activeDraft?.data ?? createEmptyForm();
    return { ...createEmptyForm(), ...rawData };
  }, [activeDraft]);
  // markdown は complianceForm 初期化後に計算（P2-A: compliance/deadline 統合）
  const deadlines = React.useMemo(() => computeDeadlineInfo(form), [form]);

  const auditAlertCount = React.useMemo(() => {
    let count = 0;
    if (deadlines.creation.daysLeft !== undefined && deadlines.creation.daysLeft < 0) count += 1;
    if (deadlines.monitoring.daysLeft !== undefined && deadlines.monitoring.daysLeft < 0) count += 1;
    return count;
  }, [deadlines]);

  const filledCount = computeFilledCount(form);
  const requiredCompleted = REQUIRED_FIELDS.reduce(
    (count, key) => (form[key].trim() ? count + 1 : count),
    0,
  );
  const completionPercent = Math.round((requiredCompleted / REQUIRED_FIELDS.length) * 100);
  const maxDraftsReached = draftList.length >= MAX_DRAFTS;
  const exportValidation = React.useMemo<ExportValidationResult>(
    () => validateExportContract(form),
    [form]
  );

  // ── ステージ進捗・ロック制御 (Enhanced Guided DES) ──
  const groupStatus = React.useMemo(() => {
    const map: Record<string, { isLocked: boolean; reason?: string; progress: number; isVisible: boolean }> = {};

    const isIbdRecommended = form.supportLevel?.includes('強度');
    const hasIbdContent = !!(
      form.ibdEnvAdjustment?.trim() || 
      form.ibdPbsStrategy?.trim() ||
      form.riskManagement?.trim() || 
      form.emergencyResponsePlan?.trim()
    );

    for (const group of TAB_GROUPS) {
      const selfInfo = getGroupReadinessInfo(group.key, form);
      const isLocked = !!group.dependsOn && !getGroupReadinessInfo(group.dependsOn, form).isReady;
      
      // IBDタブの動的表示制御 (Point A)
      let isVisible = true;
      if (group.key === 'ibd') {
        isVisible = isIbdRecommended || hasIbdContent;
      }

      if (isLocked && group.dependsOn) {
        const depInfo = getGroupReadinessInfo(group.dependsOn, form);
        const depLabel = TAB_GROUPS.find((g) => g.key === group.dependsOn)?.label ?? group.dependsOn;
        
        let reason = `${depLabel} が未完了です。先に以下の項目を埋めてください：\n・${depInfo.missingLabels.join('\n・')}`;
        if (depInfo.guidance.length > 0) {
          reason += `\n\n💡 ヒント:\n${depInfo.guidance.map(g => `・${g.tip}`).join('\n')}`;
        }

        map[group.key] = {
          isLocked: true,
          reason,
          progress: selfInfo.completionProgress,
          isVisible,
        };
      } else {
        map[group.key] = {
          isLocked: false,
          progress: selfInfo.completionProgress,
          isVisible,
        };
      }
    }
    return map as Record<TabGroupKey, { isLocked: boolean; reason?: string; progress: number; isVisible: boolean }>;
  }, [form]);

  // ════════════════════════════════════════════
  // EFFECTS (delegated)
  // ════════════════════════════════════════════

  useDraftBootstrap({
    repository,
    locationSearch,
    userOptions,
    draftList,
    setDrafts,
    setActiveDraftId,
    setActiveTab,
    setToast,
    setIsFetching,
    setSyncError,
    setLastSavedAt,
    initialised,
  });

  // Fallback sync: ensure at least 1 draft + activeDraftId is valid
  React.useEffect(() => {
    if (!initialised.current) return;
    const ids = Object.keys(drafts);
    if (ids.length === 0) {
      const fallback = createDraft('利用者 1');
      setDrafts({ [fallback.id]: fallback });
      setActiveDraftId(fallback.id);
      return;
    }
    if (!activeDraftId || !drafts[activeDraftId]) {
      setActiveDraftId(ids[0]);
    }
  }, [drafts, activeDraftId]);

  useDraftAutoSave({
    drafts,
    activeDraftId,
    isAdmin,
    repository,
    initialised,
    setLastSavedAt,
    setLiveMessage,
    setIsSaving,
    setSyncError,
    liveMessage,
  });

  // ════════════════════════════════════════════
  // HANDLERS (delegated)
  // ════════════════════════════════════════════

  const { handleFieldChange, handleAppendPhrase, handleReset, resetConfirmDialog } = useDraftFieldHandlers({
    activeDraftId,
    isAdmin,
    drafts,
    setDrafts,
    setActiveTab,
    setToast,
  });

  const { handleAddDraft, handleMasterUserChange, handleDeleteDraft, handleRenameDraft } = useDraftManagement({
    activeDraftId,
    drafts,
    draftList,
    maxDraftsReached,
    userOptions,
    repository,
    setDrafts,
    setActiveDraftId,
    setActiveTab,
    setToast,
    setSyncError,
    setSelectedMasterUserId,
  });

  // ── Compliance form (A-2) ── ※ markdown 計算に必要なため Export/Import より先に初期化
  const complianceForm = useComplianceForm({
    activeDraft,
    activeDraftId,
    isAdmin,
    setDrafts,
  });

  // ── Markdown (P2-A: form + compliance + deadlines 統合) ──
  const markdown = React.useMemo(
    () => buildSupportPlanMarkdown({
      form,
      compliance: complianceForm.compliance,
      deadlines,
    }),
    [form, complianceForm.compliance, deadlines],
  );

  const { handleCopyMarkdown, handleExportJson, handleDownloadMarkdown, handleImportJson } = useDraftExportImport({
    activeDraftId,
    drafts,
    markdown,
    activeDraft,
    repository,
    setDrafts,
    setActiveDraftId,
    setActiveTab,
    setToast,
    setSyncError,
  });

  const { handleGoalChange, handleToggleDomain, handleAddGoal, handleDeleteGoal, handleAcceptSuggestion } = useGoalActions({
    activeDraftId,
    isAdmin,
    setDrafts,
  });

  // ── ISP 正式作成 (Phase 3: UserSnapshot 注入) ──
  const ispCreate = useIspCreate({
    activeDraft,
    userList: masterUsers,
    ispRepo: ispRepos.ispRepo,
    onSuccess: () => setToast({ open: true, message: '支援計画を正式作成しました', severity: 'success' }),
    onError: (msg) => setToast({ open: true, message: msg, severity: 'error' }),
  });

  // ════════════════════════════════════════════
  // Return
  // ════════════════════════════════════════════

  return {
    isFetching,
    isSaving,
    syncError,
    drafts,
    activeDraftId,
    activeTab,
    previewMode,
    toast,
    liveMessage,
    draftList,
    activeDraft,
    form,
    markdown,
    deadlines,
    auditAlertCount,
    filledCount,
    completionPercent,
    maxDraftsReached,
    userOptions,
    exportValidation,
    setActiveTab,
    setActiveDraftId,
    setPreviewMode,
    setToast,
    handleFieldChange,
    handleAppendPhrase,
    handleReset,
    handleCopyMarkdown,
    handleDownloadMarkdown,
    handleExportJson,
    handleImportJson,
    handleAddDraft,
    handleMasterUserChange,
    handleDeleteDraft,
    handleRenameDraft,
    handleGoalChange,
    handleToggleDomain,
    handleAddGoal,
    handleDeleteGoal,
    handleAcceptSuggestion,
    setDrafts,
    groupStatus,
    complianceForm,
    ispCreate,
    resetConfirmDialog,
  };
}

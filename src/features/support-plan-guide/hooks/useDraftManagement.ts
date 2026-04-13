/**
 * useDraftManagement — Draft lifecycle handlers
 *
 * Extracted from useSupportPlanForm for single-responsibility.
 * Handles: add, delete, rename drafts, and master user selection.
 */

import type { SelectChangeEvent } from '@mui/material/Select';
import type { SupportPlanDraftRepository } from '../domain/SupportPlanDraftRepository';
import type { SectionKey, SupportPlanDraft, SupportPlanForm, ToastState, UserOption } from '../types';
import { NAME_LIMIT } from '../types';
import { createDraft, createDraftForUser, createEmptyForm, sanitizeValue } from '../utils/helpers';

export interface DraftManagementParams {
  activeDraftId: string;
  drafts: Record<string, SupportPlanDraft>;
  draftList: SupportPlanDraft[];
  maxDraftsReached: boolean;
  userOptions: UserOption[];
  repository: SupportPlanDraftRepository;
  setDrafts: React.Dispatch<React.SetStateAction<Record<string, SupportPlanDraft>>>;
  setActiveDraftId: (id: string) => void;
  setActiveTab: (tab: SectionKey) => void;
  setToast: (toast: ToastState) => void;
  setSyncError: (error: string | null) => void;
  setSelectedMasterUserId: (id: string) => void;
}

export function useDraftManagement({
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
}: DraftManagementParams) {
  const handleAddDraft = () => {
    if (maxDraftsReached) {
      setToast({ open: true, message: 'これ以上追加できません（最大32名）', severity: 'info' });
      return;
    }
    const nextIndex = draftList.length + 1;
    const newDraft = createDraft(`利用者 ${nextIndex}`);

    // Optimistic: update local state immediately
    setDrafts((prev) => ({ ...prev, [newDraft.id]: newDraft }));
    setActiveDraftId(newDraft.id);
    setActiveTab('overview');
    setToast({ open: true, message: `${newDraft.name}を追加しました`, severity: 'success' });

    // Background SP save
    repository.saveDraft(newDraft).catch((error: unknown) => {
      const msg = error instanceof Error ? error.message : 'SharePoint保存に失敗しました';
      setSyncError(msg);
      console.error('SP save for new draft failed:', error);
    });
  };

  const handleMasterUserChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value;
    if (!value) {
      setSelectedMasterUserId('');
      return;
    }

    setSelectedMasterUserId(value);
    const option = userOptions.find((candidate) => candidate.id === value);
    const user = option?.user;
    if (!user) {
      setSelectedMasterUserId('');
      return;
    }

    const existing = draftList.find(
      (draft) => draft.userId != null && String(draft.userId) === value,
    );
    if (existing) {
      setActiveDraftId(existing.id);
      setActiveTab('overview');
      setToast({
        open: true,
        message: `${user.FullName}のドラフトを開きました`,
        severity: 'info',
      });
      setSelectedMasterUserId('');
      return;
    }

    if (maxDraftsReached) {
      setToast({ open: true, message: 'これ以上追加できません（最大32名）', severity: 'info' });
      setSelectedMasterUserId('');
      return;
    }

    const newDraft = createDraftForUser(user);

    // Optimistic: update local state immediately
    setDrafts((prev) => ({
      ...prev,
      [newDraft.id]: newDraft,
    }));
    setActiveDraftId(newDraft.id);
    setActiveTab('overview');
    setToast({
      open: true,
      message: `${user.FullName}のドラフトを作成しました`,
      severity: 'success',
    });
    setSelectedMasterUserId('');

    // Background SP save
    repository.saveDraft(newDraft).catch((error: unknown) => {
      const msg = error instanceof Error ? error.message : 'SharePoint保存に失敗しました';
      setSyncError(msg);
      console.error('SP save for user draft failed:', error);
    });
  };

  const handleDeleteDraft = () => {
    if (!activeDraftId || draftList.length <= 1) {
      setToast({ open: true, message: '少なくとも1名のドラフトが必要です', severity: 'info' });
      return;
    }
    const targetName = drafts[activeDraftId]?.name ?? '利用者';
    const targetId = activeDraftId;

    // Optimistic: remove from local state immediately
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[targetId];
      return next;
    });
    setActiveDraftId('');
    setToast({ open: true, message: `${targetName}を削除しました`, severity: 'success' });

    // Background SP delete
    repository.deleteDraft(targetId).catch((error: unknown) => {
      const msg = error instanceof Error ? error.message : 'SharePoint削除に失敗しました';
      setSyncError(msg);
      console.error('SP delete draft failed:', error);
    });
  };

  const handleRenameDraft = (name: string) => {
    if (!activeDraftId) return;
    let nextName = sanitizeValue(name, NAME_LIMIT);
    if (!nextName.trim()) {
      nextName = '未設定の利用者';
    }

    setDrafts((prev) => {
      const target = prev[activeDraftId];
      if (!target) return prev;
      const updatedData: SupportPlanForm = {
        ...createEmptyForm(),
        ...target.data,
        serviceUserName: nextName,
      };
      return {
        ...prev,
        [activeDraftId]: {
          ...target,
          name: nextName,
          data: updatedData,
          updatedAt: new Date().toISOString(),
        },
      };
    });
    // SP save is handled by the auto-save effect (drafts changed → debounced sync)
  };

  return { handleAddDraft, handleMasterUserChange, handleDeleteDraft, handleRenameDraft };
}

/**
 * useDraftFieldHandlers — Form field change handlers
 *
 * Extracted from useSupportPlanForm for single-responsibility.
 * Handles individual field changes, phrase appending, and form reset.
 */

import type {
    SectionKey,
    SupportPlanDraft,
    SupportPlanForm,
    SupportPlanStringFieldKey,
    ToastState,
} from '../types';
import { FIELD_LIMITS } from '../types';
import { createEmptyForm, sanitizeValue } from '../utils/helpers';

export interface DraftFieldHandlersParams {
  activeDraftId: string;
  isAdmin: boolean;
  drafts: Record<string, SupportPlanDraft>;
  setDrafts: React.Dispatch<React.SetStateAction<Record<string, SupportPlanDraft>>>;
  setActiveTab: (tab: SectionKey) => void;
  setToast: (toast: ToastState) => void;
}

export function useDraftFieldHandlers({
  activeDraftId,
  isAdmin,
  drafts,
  setDrafts,
  setActiveTab,
  setToast,
}: DraftFieldHandlersParams) {
  const activeDraft = activeDraftId ? drafts[activeDraftId] : undefined;

  const handleFieldChange = (key: SupportPlanStringFieldKey, value: string) => {
    if (!activeDraftId || !isAdmin) return;
    setDrafts((prev) => {
      const target = prev[activeDraftId];
      if (!target) return prev;
      const updatedData: SupportPlanForm = {
        ...target.data,
        [key]: sanitizeValue(value, FIELD_LIMITS[key]),
      };
      return {
        ...prev,
        [activeDraftId]: {
          ...target,
          data: updatedData,
          updatedAt: new Date().toISOString(),
        },
      };
    });
  };

  const handleAppendPhrase = (key: SupportPlanStringFieldKey, phrase: string) => {
    if (!activeDraftId || !isAdmin) return;
    setDrafts((prev) => {
      const target = prev[activeDraftId];
      if (!target) return prev;
      const currentValue = target.data[key];
      const separator = currentValue ? (currentValue.trimEnd().endsWith('\n') ? '' : '\n') : '';
      const nextValue = `${currentValue ? currentValue.trimEnd() : ''}${separator}${phrase}`.trimStart();
      return {
        ...prev,
        [activeDraftId]: {
          ...target,
          data: {
            ...target.data,
            [key]: sanitizeValue(nextValue, FIELD_LIMITS[key]),
          },
          updatedAt: new Date().toISOString(),
        },
      };
    });
  };

  const handleReset = () => {
    if (!activeDraftId) return;
    if (!window.confirm(`${activeDraft?.name ?? 'この利用者'}の入力内容をすべてリセットしますか？`)) return;
    setDrafts((prev) => {
      const target = prev[activeDraftId];
      if (!target) return prev;
      const resetForm = createEmptyForm();
      resetForm.serviceUserName = sanitizeValue(target.name, FIELD_LIMITS.serviceUserName);
      return {
        ...prev,
        [activeDraftId]: {
          ...target,
          data: resetForm,
          updatedAt: new Date().toISOString(),
        },
      };
    });
    setActiveTab('overview');
    setToast({ open: true, message: `${activeDraft?.name ?? '利用者'}のフォームを初期化しました`, severity: 'success' });
  };

  return { handleFieldChange, handleAppendPhrase, handleReset };
}

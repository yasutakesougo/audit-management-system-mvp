import { useCallback, useState } from 'react';
import { useAnnounce } from '@/a11y/LiveAnnouncer';
import type { CreateScheduleEventInput } from '../../data';
import {
  toCreateScheduleInput,
  validateScheduleForm,
  type ScheduleFormState,
  type ScheduleUserOption,
} from '../../domain/scheduleFormState';
import {
  buildScheduleFailureAnnouncement,
  buildScheduleSuccessAnnouncement,
} from '../../utils/scheduleAnnouncements';

export type UseScheduleActionOrchestratorInput = {
  mode: 'create' | 'edit';
  eventId?: string;
  onSubmit: (input: CreateScheduleEventInput) => Promise<void> | void;
  onDelete?: (id: string) => Promise<void> | void;
  onClose: () => void;
  users: ScheduleUserOption[];
};

export function useScheduleActionOrchestrator(input: UseScheduleActionOrchestratorInput) {
  const { mode, eventId, onSubmit, onDelete, onClose, users } = input;
  const announce = useAnnounce();
  
  const [executing, setExecuting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saveErrors, setSaveErrors] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});

  const failureSaveMessage = mode === 'edit'
    ? 'スケジュールの更新に失敗しました。もう一度お試しください。'
    : 'スケジュールの作成に失敗しました。もう一度お試しください。';
  const failureDeleteMessage = 'スケジュールの削除に失敗しました。もう一度お試しください。';

  const handleSave = useCallback(
    async (formState: ScheduleFormState) => {
      // 1. Validation
      const validation = validateScheduleForm(formState);
      if (!validation.isValid) {
        setSaveErrors(validation.errors);
        setFieldErrors(validation.fieldErrors);
        if (validation.errors.length > 0) {
          announce(validation.errors[0], 'assertive');
        }
        return false;
      }

      // 2. Build payload
      const selectedUser = users.find(u => u.id === formState.userId) ?? null;
      const formInput = toCreateScheduleInput(formState, selectedUser);

      // 3. Execution
      setExecuting(true);
      try {
        await onSubmit(formInput);
        
        // 4. Success handling
        const successAnnouncement = buildScheduleSuccessAnnouncement({
          input: formInput,
          userName: selectedUser?.name,
          mode,
        });
        announce(successAnnouncement);
        
        setExecuting(false);
        setSaveErrors([]);
        setFieldErrors({});
        onClose();
        return true;
      } catch (error) {
        console.error('[ScheduleActionOrchestrator] save failed', error);
        
        // 5. Failure handling
        const failureAnnouncement = buildScheduleFailureAnnouncement({
          input: formInput,
          userName: selectedUser?.name,
          mode,
        });
        const finalErrorMsg = failureAnnouncement || failureSaveMessage;
        setSaveErrors([finalErrorMsg]);
        announce(finalErrorMsg, 'assertive');
        
        setExecuting(false);
        return false;
      }
    },
    [announce, failureSaveMessage, mode, onClose, onSubmit, users]
  );

  const handleDelete = useCallback(async () => {
    if (!eventId || !onDelete) return false;

    setDeleting(true);
    setSaveErrors([]);
    try {
      await onDelete(eventId);
      announce('スケジュールを削除しました。');
      setDeleting(false);
      onClose();
      return true;
    } catch (error) {
      console.error('[ScheduleActionOrchestrator] delete failed', error);
      setSaveErrors([failureDeleteMessage]);
      announce(failureDeleteMessage, 'assertive');
      setDeleting(false);
      return false;
    }
  }, [announce, eventId, onDelete, onClose]);

  const resetErrors = useCallback(() => {
    setSaveErrors([]);
    setFieldErrors({});
  }, []);

  return {
    handleSave,
    handleDelete,
    executing,
    deleting,
    saveErrors,
    fieldErrors,
    resetErrors,
  };
}

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

export type UseScheduleSaveOrchestratorInput = {
  mode: 'create' | 'edit';
  onSubmit: (input: CreateScheduleEventInput) => Promise<void> | void;
  onClose: () => void;
  users: ScheduleUserOption[];
};

export function useScheduleSaveOrchestrator(input: UseScheduleSaveOrchestratorInput) {
  const { mode, onSubmit, onClose, users } = input;
  const announce = useAnnounce();
  
  const [executing, setExecuting] = useState(false);
  const [saveErrors, setSaveErrors] = useState<string[]>([]);

  const failureMessage = mode === 'edit'
    ? 'スケジュールの更新に失敗しました。もう一度お試しください。'
    : 'スケジュールの作成に失敗しました。もう一度お試しください。';

  const handleSave = useCallback(
    async (formState: ScheduleFormState) => {
      // 1. Validation
      const validation = validateScheduleForm(formState);
      if (!validation.isValid) {
        setSaveErrors(validation.errors);
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
        onClose();
        return true;
      } catch (error) {
        console.error('[ScheduleSaveOrchestrator] save failed', error);
        
        // 5. Failure handling
        const failureAnnouncement = buildScheduleFailureAnnouncement({
          input: formInput,
          userName: selectedUser?.name,
          mode,
        });
        const finalErrorMsg = failureAnnouncement || failureMessage;
        setSaveErrors([finalErrorMsg]);
        announce(finalErrorMsg, 'assertive');
        
        setExecuting(false);
        return false;
      }
    },
    [announce, failureMessage, mode, onClose, onSubmit, users]
  );

  const resetErrors = useCallback(() => {
    setSaveErrors([]);
  }, []);

  return {
    handleSave,
    executing,
    saveErrors,
    resetErrors,
  };
}

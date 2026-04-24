import { useState, useCallback } from 'react';
import type { IUserMaster, IUserMasterCreateDto } from '../../types';

export interface UserEditPageStateDeps {
  initialUser?: IUserMaster;
}

export interface UserEditPageState {
  formData: Partial<IUserMasterCreateDto>;
  isDirty: boolean;
  isSaving: boolean;
  error: string | null;
  
  setFieldValue: <K extends keyof IUserMasterCreateDto>(field: K, value: IUserMasterCreateDto[K]) => void;
  setSaving: (saving: boolean) => void;
  setError: (error: string | null) => void;
  reset: (user: IUserMaster) => void;
}

/**
 * useUserEditPageState
 * 
 * ユーザー編集フォームの状態管理を担当する PageState Hook。
 * UI の入力状態とバリデーションフラグを保持する。
 */
export function useUserEditPageState(deps: UserEditPageStateDeps = {}): UserEditPageState {
  const { initialUser } = deps;
  
  const [formData, setFormData] = useState<Partial<IUserMasterCreateDto>>(() => {
    if (!initialUser) return {};
    // domain user to DTO (simple mapping for now)
    return {
      UserID: initialUser.UserID,
      FullName: initialUser.FullName,
      UsageStatus: initialUser.UsageStatus,
      GrantMunicipality: initialUser.GrantMunicipality,
      RecipientCertNumber: initialUser.RecipientCertNumber,
      // Add other fields as needed
    };
  });
  
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setFieldValue = useCallback(<K extends keyof IUserMasterCreateDto>(
    field: K, 
    value: IUserMasterCreateDto[K]
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setIsDirty(true);
  }, []);

  const reset = useCallback((user: IUserMaster) => {
    setFormData({
      UserID: user.UserID,
      FullName: user.FullName,
      UsageStatus: user.UsageStatus,
      GrantMunicipality: user.GrantMunicipality,
      RecipientCertNumber: user.RecipientCertNumber,
    });
    setIsDirty(false);
    setError(null);
  }, []);

  return {
    formData,
    isDirty,
    isSaving,
    error,
    setFieldValue,
    setSaving: setIsSaving,
    setError,
    reset
  };
}

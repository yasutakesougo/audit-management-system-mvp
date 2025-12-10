import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export type DialogSearchParamControls = {
  isOpen: boolean;
  openDialog: () => void;
  closeDialog: () => void;
};

export function useDialogSearchParam(paramKey: string, activeValue: string): DialogSearchParamControls {
  const [searchParams, setSearchParams] = useSearchParams();
  const isOpen = searchParams.get(paramKey) === activeValue;

  const openDialog = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.set(paramKey, activeValue);
    setSearchParams(next, { replace: true });
  }, [activeValue, paramKey, searchParams, setSearchParams]);

  const closeDialog = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    if (next.get(paramKey) === activeValue) {
      next.delete(paramKey);
      setSearchParams(next, { replace: true });
    }
  }, [activeValue, paramKey, searchParams, setSearchParams]);

  return useMemo(
    () => ({
      isOpen,
      openDialog,
      closeDialog,
    }),
    [isOpen, openDialog, closeDialog],
  );
}

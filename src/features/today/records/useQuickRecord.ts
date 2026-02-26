import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export type QuickRecordMode = 'unfilled' | 'user';

export type QuickRecordState = {
  isOpen: boolean;
  mode: QuickRecordMode | null;
  userId: string | null;
  openUnfilled: () => void;
  openUser: (userId: string) => void;
  close: () => void;
};

export const useQuickRecord = (): QuickRecordState => {
  const [searchParams, setSearchParams] = useSearchParams();

  const modeRaw = searchParams.get('mode');
  const mode = (modeRaw === 'unfilled' || modeRaw === 'user') ? modeRaw : null;
  const userId = searchParams.get('userId');

  const openUnfilled = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('mode', 'unfilled');
        next.delete('userId');
        return next;
      },
      { replace: true }
    );
  }, [setSearchParams]);

  const openUser = useCallback(
    (id: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('mode', 'user');
          next.set('userId', id);
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const close = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('mode');
        next.delete('userId');
        return next;
      },
      { replace: true }
    );
  }, [setSearchParams]);

  return {
    isOpen: mode !== null,
    mode,
    userId,
    openUnfilled,
    openUser,
    close,
  };
};

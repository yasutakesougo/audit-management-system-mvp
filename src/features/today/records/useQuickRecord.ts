import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const AUTO_NEXT_STORAGE_KEY = 'ams_quick_auto_next';

export type QuickRecordMode = 'unfilled' | 'user';

export type QuickRecordState = {
  isOpen: boolean;
  mode: QuickRecordMode | null;
  userId: string | null;
  openUnfilled: (targetUserId?: string) => void;
  openUser: (userId: string) => void;
  close: () => void;
  autoNextEnabled: boolean;
  setAutoNextEnabled: (enabled: boolean) => void;
};

export const useQuickRecord = (): QuickRecordState => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [autoNextEnabled, setAutoNextEnabledState] = useState(() => {
    try {
      const stored = localStorage.getItem(AUTO_NEXT_STORAGE_KEY);
      return stored !== null ? stored === '1' : true;
    } catch {
      return true;
    }
  });

  const setAutoNextEnabled = useCallback((enabled: boolean) => {
    setAutoNextEnabledState(enabled);
    try {
      localStorage.setItem(AUTO_NEXT_STORAGE_KEY, enabled ? '1' : '0');
    } catch {
      // Ignore quota/access errors
    }
  }, []);

  const modeRaw = searchParams.get('mode');
  const mode = (modeRaw === 'unfilled' || modeRaw === 'user') ? modeRaw : null;
  const userId = searchParams.get('userId');

  const openUnfilled = useCallback((targetUserId?: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('mode', 'unfilled');
        if (targetUserId) {
          next.set('userId', targetUserId);
        } else {
          next.delete('userId');
        }
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
    autoNextEnabled,
    setAutoNextEnabled,
  };
};

import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const AUTO_NEXT_STORAGE_KEY = 'ams_quick_auto_next';

const parseAutoNextParam = (param: string | null): boolean | undefined => {
  if (param === '1' || param === 'true') return true;
  if (param === '0' || param === 'false') return false;
  return undefined;
};

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

  const urlAutoNext = parseAutoNextParam(searchParams.get('autoNext'));

  const [localAutoNext, setLocalAutoNextState] = useState(() => {
    try {
      const stored = localStorage.getItem(AUTO_NEXT_STORAGE_KEY);
      return stored !== null ? stored === '1' : true;
    } catch {
      return true;
    }
  });

  const effectiveAutoNext = urlAutoNext ?? localAutoNext;

  const setAutoNextEnabled = useCallback((enabled: boolean) => {
    setLocalAutoNextState(enabled);
    try {
      localStorage.setItem(AUTO_NEXT_STORAGE_KEY, enabled ? '1' : '0');
    } catch {
      // Ignore quota/access errors
    }

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (next.get('mode') === 'unfilled') {
          next.set('autoNext', enabled ? '1' : '0');
        }
        return next;
      },
      { replace: true }
    );
  }, [setSearchParams]);

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
        next.set('autoNext', effectiveAutoNext ? '1' : '0');
        return next;
      },
      { replace: true }
    );
  }, [setSearchParams, effectiveAutoNext]);

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
    autoNextEnabled: effectiveAutoNext,
    setAutoNextEnabled,
  };
};

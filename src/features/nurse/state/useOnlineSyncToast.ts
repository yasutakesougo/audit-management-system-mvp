import { formatFlushSummaryToast, type SnackbarSeverity } from '@/features/nurse/toast/formatFlushSummaryToast';
import React from 'react';
import { flushNurseQueue } from './useNurseSync';

type ShowFn = (message: string, severity?: SnackbarSeverity) => void;

export const useOnlineSyncToast = (show: ShowFn) => {
  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return () => undefined;
    }
    const handleOnline = async () => {
      try {
        const summary = await flushNurseQueue(undefined, { source: 'online', suppressToast: true });
        const payload = formatFlushSummaryToast(summary);
        show(payload.message, payload.severity);
      } catch {
        show('オンライン復帰同期に失敗しました', 'error');
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [show]);
};

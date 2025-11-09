import { useEffect, type FC } from 'react';
import type { AlertColor } from '@mui/material/Alert';

export type NurseToastPayload = {
  message: string;
  severity: AlertColor;
  testId?: string;
  retry?: string | null;
  retryAction?: string | null;
};

type NurseToastBridgeProps = {
  onToast: (payload: NurseToastPayload) => void;
};

const EVENT_NAME = 'nurse:toast';

type NurseToastEvent = CustomEvent<Partial<NurseToastPayload>>;

const isCustomEvent = (event: Event): event is NurseToastEvent => 'detail' in event;

const NurseToastBridge: FC<NurseToastBridgeProps> = ({ onToast }) => {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handler = (event: Event) => {
      if (!isCustomEvent(event) || !event.detail) {
        return;
      }

      const detail = event.detail;
      if (!detail.message || !detail.severity) {
        return;
      }

      onToast({
        message: detail.message,
        severity: detail.severity,
        testId: detail.testId,
        retryAction: detail.retryAction ?? detail.retry ?? null,
      });
    };

    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, [onToast]);

  return null;
};

export default NurseToastBridge;

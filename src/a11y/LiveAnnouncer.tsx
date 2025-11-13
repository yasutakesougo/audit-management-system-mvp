import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

type LiveMode = 'polite' | 'assertive';

type AnnounceFn = (message: string, mode?: LiveMode) => void;

const LiveContext = createContext<AnnounceFn>(() => {});

export function useAnnounce(): AnnounceFn {
  return useContext(LiveContext);
}

export default function LiveAnnouncer({ children }: { children: ReactNode }): JSX.Element {
  const [politeMessage, setPoliteMessage] = useState('');
  const [assertiveMessage, setAssertiveMessage] = useState('');
  const lastMessageRef = useRef('');

  const announce = useCallback<AnnounceFn>((message, mode = 'polite') => {
    if (!message || message === lastMessageRef.current) {
      return;
    }

    lastMessageRef.current = message;
    setPoliteMessage('');
    setAssertiveMessage('');

    setTimeout(() => {
      if (mode === 'assertive') {
        setAssertiveMessage(message);
      } else {
        setPoliteMessage(message);
      }

      if (typeof window !== 'undefined') {
        (window as typeof window & { __lastLive__?: string }).__lastLive__ = message;
      }
    }, 0);
  }, []);

  return (
    <LiveContext.Provider value={announce}>
      {children}
      <div
        data-testid="live-polite"
        role="status"
        aria-live="polite"
        style={{ position: 'absolute', width: 1, height: 1, clip: 'rect(0 0 0 0)', clipPath: 'inset(50%)', overflow: 'hidden' }}
      >
        {politeMessage}
      </div>
      <div
        data-testid="live-assertive"
        role="status"
        aria-live="assertive"
        style={{ position: 'absolute', width: 1, height: 1, clip: 'rect(0 0 0 0)', clipPath: 'inset(50%)', overflow: 'hidden' }}
      >
        {assertiveMessage}
      </div>
    </LiveContext.Provider>
  );
}

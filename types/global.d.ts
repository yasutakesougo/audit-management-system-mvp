declare global {
  interface Window {
    __USERS_DEMO_PRESET__?: 'normal' | 'empty' | 'error';
    __USERS_DEMO__?: {
      setPreset: (preset: 'normal' | 'empty' | 'error') => void;
      getPreset: () => 'normal' | 'empty' | 'error';
      reset: () => void;
    };
    __NAVSHELL_HUD__?: {
      show: (text?: string) => void;
      hide: () => void;
    };
    __MSW_NURSE_MODE__?: 'ok' | 'partial' | 'error';
    __MSW_NURSE_SUMMARY__?: {
      sent?: number;
      remaining?: number;
      okCount?: number;
      errorCount?: number;
      partialCount?: number;
      totalCount?: number;
      entries?: Array<{
        userId: string;
        status: 'ok' | 'partial' | 'error';
        kind: 'observation' | 'meds';
        error?: unknown;
      }>;
    };
    __NURSE_MINUTE_BASIS__?: 'utc' | 'local';
  }
}

export { };

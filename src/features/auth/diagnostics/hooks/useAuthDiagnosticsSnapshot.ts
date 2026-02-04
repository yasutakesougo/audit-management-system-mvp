import { useEffect, useState } from 'react';
import { authDiagnostics } from '../collector';

export interface AuthDiagnosticsSnapshot {
  total: number;
  byReason: Record<string, number>;
  byOutcome: Record<'blocked' | 'recovered' | 'manual-fix', number>;
  recoveryRate: number;
}

/**
 * Hook: Real-time Auth Diagnostics Snapshot
 * - Polls diagnostics data every 5 seconds (DEV mode)
 * - Returns current snapshot with recovery rate & reason counts
 */
export function useAuthDiagnosticsSnapshot() {
  const [snapshot, setSnapshot] = useState<AuthDiagnosticsSnapshot | null>(null);

  useEffect(() => {
    // Initial snapshot
    const updateSnapshot = () => {
      const stats = authDiagnostics.snapshot();
      setSnapshot(stats);
    };

    updateSnapshot();

    // Auto-refresh in DEV mode
    const interval = setInterval(updateSnapshot, 5000);

    return () => clearInterval(interval);
  }, []);

  return snapshot;
}


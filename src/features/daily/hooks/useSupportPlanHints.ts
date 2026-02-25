// src/features/daily/hooks/useSupportPlanHints.ts
import { extractSupportPlanHints, type SupportPlanHints } from '@/features/support-plan/supportPlanAdapter';
import { useEffect, useMemo, useState } from 'react';

/**
 * Hook to retrieve individual support plan hints for display in daily records.
 * Listens to 'storage' events to keep hints synced across tabs/windows.
 */
export function useSupportPlanHints() {
  const [map, setMap] = useState<Record<string, SupportPlanHints>>({});

  useEffect(() => {
    // Initial load
    setMap(extractSupportPlanHints());

    const updateMap = () => setMap(extractSupportPlanHints());

    // Reactive sync (Storage API for other tabs, Custom Event for same tab)
    window.addEventListener('storage', updateMap);
    window.addEventListener('support-plan-updated', updateMap);

    return () => {
      window.removeEventListener('storage', updateMap);
      window.removeEventListener('support-plan-updated', updateMap);
    };
  }, []);

  return useMemo(() => map, [map]);
}

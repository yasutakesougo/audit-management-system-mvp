import { useEffect, useState } from 'react';
export type NightlySignal = {
  type: string;
  severity: string;
  message: string;
  [key: string]: unknown;
};

export type NightlyDecision = {
  date: string;
  interpretation: {
    signals: NightlySignal[];
  };
};

import latestDecision from '../sharepoint/latest-decision.json';

export function useNightlyDecision() {
  const [decision, setDecision] = useState<NightlyDecision | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // We use static import as the SSOT for now, matching HealthPage pattern
    setDecision(latestDecision as unknown as NightlyDecision);
    setLoading(false);
  }, []);

  return { decision, loading };
}

export function useTransportConcurrencySignals() {
  const { decision } = useNightlyDecision();

  if (!decision) return [];

  return decision.interpretation.signals.filter(
    (s) => s.type === 'concurrency'
  );
}

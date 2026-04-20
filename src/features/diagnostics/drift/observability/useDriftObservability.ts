import React from 'react';
import { auditLog } from '@/lib/debugLogger';
import type { IDriftEventRepository } from '../domain/DriftEventRepository';
import { useDriftEventRepository } from '../infra/driftEventRepositoryFactory';
import {
  aggregateTopDriftFields,
  aggregateTopDriftLists,
  aggregateUnresolvedCount,
  type DriftTopItem,
} from './aggregation';

export type DriftObservabilityPeriod = 'daily' | 'weekly';

export type DriftObservabilitySnapshot = {
  topDriftFields: DriftTopItem[];
  topDriftLists: DriftTopItem[];
  unresolvedCount: number;
  lastUpdatedAt: string | null;
};

export type UseDriftObservabilityOptions = {
  repository?: IDriftEventRepository;
  nowProvider?: () => Date;
};

const EMPTY_SNAPSHOT: DriftObservabilitySnapshot = {
  topDriftFields: [],
  topDriftLists: [],
  unresolvedCount: 0,
  lastUpdatedAt: null,
};

const DEFAULT_NOW_PROVIDER = (): Date => new Date();

export const getPeriodStart = (
  period: DriftObservabilityPeriod,
  now: Date = new Date(),
): Date => {
  if (period === 'daily') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
};

export const buildSinceIso = (
  period: DriftObservabilityPeriod,
  now: Date = new Date(),
): string => getPeriodStart(period, now).toISOString();

const safeCompute = <T,>(label: string, compute: () => T, fallback: T): T => {
  try {
    return compute();
  } catch (error) {
    auditLog.warn('diagnostics:drift', `Drift observability aggregation failed: ${label}`, error);
    return fallback;
  }
};

export const useDriftObservability = (options: UseDriftObservabilityOptions = {}) => {
  const driftRepository = useDriftEventRepository();
  const repository = options.repository ?? driftRepository;
  const nowProvider = options.nowProvider ?? DEFAULT_NOW_PROVIDER;
  const [period, setPeriod] = React.useState<DriftObservabilityPeriod>('weekly');
  const [loading, setLoading] = React.useState(false);
  const [snapshot, setSnapshot] = React.useState<DriftObservabilitySnapshot>(EMPTY_SNAPSHOT);

  React.useEffect(() => {
    let active = true;

    const run = async () => {
      if (!repository) {
        if (active) setSnapshot(EMPTY_SNAPSHOT);
        return;
      }

      setLoading(true);

      const since = buildSinceIso(period, nowProvider());
      let events: unknown[] = [];

      try {
        events = await repository.getEvents({ since });
      } catch (error) {
        // Fail-open: observability read failure must not break diagnostics UI.
        auditLog.warn('diagnostics:drift', 'Failed to load drift events for observability (fail-open).', {
          period,
          since,
          error: String(error),
        });
        events = [];
      }

      if (!active) return;

      setSnapshot({
        topDriftFields: safeCompute('topDriftFields', () => aggregateTopDriftFields(events), []),
        topDriftLists: safeCompute('topDriftLists', () => aggregateTopDriftLists(events), []),
        unresolvedCount: safeCompute('unresolvedCount', () => aggregateUnresolvedCount(events), 0),
        lastUpdatedAt: new Date().toISOString(),
      });
      setLoading(false);
    };

    run().catch((error) => {
      if (!active) return;
      auditLog.warn('diagnostics:drift', 'Unexpected drift observability failure (fail-open).', error);
      setSnapshot(EMPTY_SNAPSHOT);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [period, repository, nowProvider]);

  return {
    period,
    setPeriod,
    loading,
    ...snapshot,
  };
};

import React from 'react';
import { useSP } from '@/lib/spClient';
import { auditLog } from '@/lib/debugLogger';
import { reportDiagnosticsReport, mapPatrolEventToSignal, type PatrolEvent } from '../mapping';
import { reportSpHealthEvent } from '../spHealthSignalStore';
import { useDriftEventRepository } from '@/features/diagnostics/drift/infra/driftEventRepositoryFactory';

/**
 * useNightlySignalIngestion — Nightly Patrol 結果を UI に取り込む Hook
 */
export function useNightlySignalIngestion() {
  const sp = useSP();
  const driftRepository = useDriftEventRepository();
  const ranRef = React.useRef(false);

  React.useEffect(() => {
    if (!sp || ranRef.current) return;
    ranRef.current = true;

    let cancelled = false;
    const controller = new AbortController();
    const isAbortError = (err: unknown) =>
      (err as Error)?.name === 'AbortError' ||
      (err as { code?: number | string })?.code === 20 ||
      (err as { code?: number | string })?.code === 'ABORT_ERR';

    const ingest = async () => {
      // 1. Diagnostics_Reports の取得
      try {
        const { getLatestDiagnosticsReport } = await import('@/sharepoint/diagnosticsReports');
        const report = await getLatestDiagnosticsReport(sp, controller.signal);
        if (cancelled) return;

        if (report) {
          reportDiagnosticsReport(report);
          auditLog.debug('health:ingestion', 'Diagnostics report ingested.');
        }
      } catch (error) {
        if (cancelled || isAbortError(error)) return;
        auditLog.warn('health:ingestion', 'Failed to fetch diagnostics reports (skipping).', error);
      }

      // 2. DriftEventsLog の取得
      try {
        const driftLogs = await driftRepository.getEvents(undefined, controller.signal);
        if (cancelled) return;

        for (const log of driftLogs.slice(0, 10)) {
          const event: PatrolEvent = {
            severity: log.severity || 'watch',
            code: log.resolutionType || 'unknown',
            listName: log.listName,
            message: `Drift detected in ${log.fieldName || 'unknown field'}`,
            occurredAt: log.detectedAt || new Date().toISOString(),
          };
          const signal = mapPatrolEventToSignal(event);
          if (signal) {
            reportSpHealthEvent(signal);
          }
        }
        auditLog.debug('health:ingestion', 'Drift logs ingested.');
      } catch (error) {
        if (cancelled || isAbortError(error)) return;
        auditLog.warn('health:ingestion', 'Failed to fetch drift logs (skipping).', error);
      }

      if (cancelled) return;
      auditLog.info('health:ingestion', 'Nightly signals ingestion process completed.');
    };

    ingest();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [driftRepository, sp]);
}

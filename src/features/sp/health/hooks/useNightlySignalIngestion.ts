import React from 'react';
import { useSP } from '@/lib/spClient';
import { auditLog } from '@/lib/debugLogger';
import {
import { reportDiagnosticsReport, mapPatrolEventToSignal, type PatrolEvent } from '../mapping';
import { reportSpHealthEvent } from '../spHealthSignalStore';
import { SharePointDriftEventRepository } from '@/features/diagnostics/drift/infra/SharePointDriftEventRepository';

/**
 * useNightlySignalIngestion — Nightly Patrol 結果を UI に取り込む Hook
 * 
 * アプリ起動時に1回実行され、SharePoint 上の最新の診断レポートと
 * ドリフトログを取得して健康シグナルストアへ報告します。
 */
export function useNightlySignalIngestion() {
  const sp = useSP();
  const ranRef = React.useRef(false);
  const driftRepository = React.useMemo(() => new SharePointDriftEventRepository(sp), [sp]);

  React.useEffect(() => {
    if (!sp || ranRef.current) return;
    ranRef.current = true;

    const ingest = async () => {
      // 1. Diagnostics_Reports の取得
      try {
        const { getLatestDiagnosticsReport } = await import('@/sharepoint/diagnosticsReports');
        const report = await getLatestDiagnosticsReport(sp);

        if (report) {
          reportDiagnosticsReport(report);
          auditLog.debug('health:ingestion', 'Diagnostics report ingested.');
        }
      } catch (error) {
        auditLog.warn('health:ingestion', 'Failed to fetch diagnostics reports (skipping).', error);
      }

      // 2. DriftEventsLog の取得
      try {
        const driftLogs = await driftRepository.getEvents();

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
        auditLog.warn('health:ingestion', 'Failed to fetch drift logs (skipping).', error);
      }

      auditLog.info('health:ingestion', 'Nightly signals ingestion process completed.');
    };

    ingest();
  }, [driftRepository, sp]);
}

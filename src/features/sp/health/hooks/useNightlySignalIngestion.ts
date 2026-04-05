import React from 'react';
import { useSP } from '@/lib/spClient';
import { auditLog } from '@/lib/debugLogger';
import {
  DIAGNOSTICS_REPORTS_LIST_TITLE,
  DIAGNOSTICS_REPORTS_SELECT_FIELDS,
  DRIFT_LOG_LIST_TITLE,
} from '@/sharepoint/fields';
import { reportDiagnosticsReport, mapPatrolEventToSignal, type PatrolEvent } from '../mapping';
import { reportSpHealthEvent } from '../spHealthSignalStore';
import type { DiagnosticsReportItem } from '@/sharepoint/diagnosticsReports';

/**
 * useNightlySignalIngestion — Nightly Patrol 結果を UI に取り込む Hook
 * 
 * アプリ起動時に1回実行され、SharePoint 上の最新の診断レポートと
 * ドリフトログを取得して健康シグナルストアへ報告します。
 */
export function useNightlySignalIngestion() {
  const sp = useSP();
  const ranRef = React.useRef(false);

  React.useEffect(() => {
    if (!sp || ranRef.current) return;
    ranRef.current = true;

    const ingest = async () => {
      try {
        // 1. Diagnostics_Reports の取得（直近1回分）
        const diagReports = await sp.getListItemsByTitle(
          DIAGNOSTICS_REPORTS_LIST_TITLE,
          [...DIAGNOSTICS_REPORTS_SELECT_FIELDS],
          undefined,
          'Modified desc',
          1
        );

        if (diagReports.length > 0) {
          reportDiagnosticsReport(diagReports[0] as unknown as DiagnosticsReportItem);
        }

        // 2. DriftEventsLog の取得（直近10件、24時間以内）
        const driftLogs = await sp.getListItemsByTitle(
          DRIFT_LOG_LIST_TITLE,
          ['Id', 'ListName', 'FieldName', 'DetectedAt', 'Severity', 'ResolutionType', 'ErrorMessage'],
          undefined,
          'Created desc',
          10
        );

        interface DriftLogItem {
          Severity?: { Value: string } | string;
          ResolutionType?: string;
          ListName?: string;
          FieldName?: string;
          DetectedAt?: string;
          ErrorMessage?: string;
          Created?: string;
        }

        const driftLogsTyped = driftLogs as unknown as DriftLogItem[];
        for (const log of driftLogsTyped) {
          const sev = log.Severity;
          const severity = (typeof sev === 'object' && sev !== null && 'Value' in sev)
            ? (sev as { Value: string }).Value
            : (typeof sev === 'string' ? sev : 'watch');

          const event: PatrolEvent = {
            severity: severity,
            code: log.ResolutionType || 'unknown',
            listName: log.ListName,
            message: log.ErrorMessage || `Drift detected in ${log.FieldName || 'unknown field'}`,
            occurredAt: log.DetectedAt || log.Created || new Date().toISOString(),
          };
          const signal = mapPatrolEventToSignal(event);
          if (signal) {
            reportSpHealthEvent(signal);
          }
        }

        auditLog.info('health:ingestion', 'Nightly signals ingested successfully.');
      } catch (error) {
        // Fail-open
        auditLog.warn('health:ingestion', 'Failed to ingest nightly signals (fail-open).', error);
      }
    };

    ingest();
  }, [sp]);
}

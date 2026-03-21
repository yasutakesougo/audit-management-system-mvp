import React from 'react';
import type { EvidenceLinkMap } from '@/domain/isp/evidenceLink';
import { createEmptyEvidenceLinkMap } from '@/domain/isp/evidenceLink';
import type { AbcRecord } from '@/domain/abc/abcRecord';
import type { IcebergPdcaItem } from '@/features/ibd/analysis/pdca/types';
import { localAbcRecordRepository } from '@/infra/localStorage/localAbcRecordRepository';
import { localEvidenceLinkRepository } from '@/infra/localStorage/localEvidenceLinkRepository';

type UsePlanningEvidenceStateResult = {
  evidenceLinks: EvidenceLinkMap;
  setEvidenceLinks: (updated: EvidenceLinkMap) => void;
  abcRecords: AbcRecord[];
  pdcaItems: IcebergPdcaItem[];
};

export function usePlanningEvidenceState(
  planningSheetId: string | undefined,
  userId: string | undefined,
): UsePlanningEvidenceStateResult {
  const [evidenceLinks, setEvidenceLinksRaw] = React.useState<EvidenceLinkMap>(createEmptyEvidenceLinkMap());
  const [abcRecords, setAbcRecords] = React.useState<AbcRecord[]>([]);
  const [pdcaItems, setPdcaItems] = React.useState<IcebergPdcaItem[]>([]);

  React.useEffect(() => {
    if (planningSheetId && planningSheetId !== 'new') {
      const stored = localEvidenceLinkRepository.get(planningSheetId);
      setEvidenceLinksRaw(stored);
    }
  }, [planningSheetId]);

  const setEvidenceLinks = React.useCallback((updated: EvidenceLinkMap) => {
    setEvidenceLinksRaw(updated);
    if (planningSheetId && planningSheetId !== 'new') {
      localEvidenceLinkRepository.save(planningSheetId, updated);
    }
  }, [planningSheetId]);

  React.useEffect(() => {
    let disposed = false;
    if (!userId) {
      setAbcRecords([]);
      setPdcaItems([]);
      return;
    }

    localAbcRecordRepository.getByUserId(userId).then((records) => {
      if (!disposed) setAbcRecords(records);
    });

    try {
      const raw = localStorage.getItem('iceberg-pdca-items');
      if (raw) {
        const all: IcebergPdcaItem[] = JSON.parse(raw);
        if (!disposed) setPdcaItems(all.filter((item) => item.userId === userId));
      }
    } catch {
      // ignore parse errors
    }

    return () => { disposed = true; };
  }, [userId]);

  return {
    evidenceLinks,
    setEvidenceLinks,
    abcRecords,
    pdcaItems,
  };
}

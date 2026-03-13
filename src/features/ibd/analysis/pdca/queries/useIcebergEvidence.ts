/**
 * useIcebergEvidence — Iceberg PDCA データを evidence 集計形式で提供するフック
 *
 * useIcebergPdcaListQuery → aggregateIcebergEvidence の橋渡し。
 * RegulatoryDashboardPage と SupportPlanGuidePage の両方から利用可能。
 *
 * @param userId - ターゲットユーザーID
 * @returns IcebergEvidenceBySheet | null（ロード中は null）
 */
import { useMemo } from 'react';

import { aggregateIcebergEvidence } from '@/domain/regulatory/aggregateIcebergEvidence';
import type { IcebergEvidenceBySheet } from '@/domain/regulatory/findingEvidenceSummary';
import { useIcebergPdcaListQuery } from './useIcebergPdcaList';

export interface UseIcebergEvidenceResult {
  /** 集計済み evidence データ（未ロード or 無効userId は null） */
  data: IcebergEvidenceBySheet | null;
  /** データロード中かどうか */
  isLoading: boolean;
}

export function useIcebergEvidence(
  userId: string | null | undefined,
): UseIcebergEvidenceResult {
  const { data: items, isLoading } = useIcebergPdcaListQuery(userId);

  const evidence = useMemo(() => {
    if (!items || items.length === 0) return null;
    return aggregateIcebergEvidence(items);
  }, [items]);

  return {
    data: evidence,
    isLoading,
  };
}

/**
 * ServiceProvision → Cross-Module スナップショット変換
 *
 * listByDate で当日分を一括取得し、UserCode → ServiceProvisionSummary の Map を返す。
 * Hook 不使用（純粋関数 + async）。cross-module 側から直接呼べる。
 */
import type { ServiceProvisionRecord } from '@/features/service-provision/domain/types';
import type { ServiceProvisionRepository } from '@/features/service-provision/domain/ServiceProvisionRepository';
import type { ServiceProvisionSummary } from './types';

/**
 * ServiceProvisionRecord → ServiceProvisionSummary 変換
 */
export function toProvisionSummary(record: ServiceProvisionRecord): ServiceProvisionSummary {
  return {
    hasRecord: true,
    status: record.status,
    startHHMM: record.startHHMM,
    endHHMM: record.endHHMM,
    additions: {
      transport: record.hasTransport,
      meal: record.hasMeal,
      bath: record.hasBath,
      extended: record.hasExtended,
      absentSupport: record.hasAbsentSupport,
    },
    notePreview: record.note ? record.note.slice(0, 50) : undefined,
  };
}

/**
 * 当日分を一括取得して UserCode → Summary の Map を返す
 *
 * 32名でも listByDate 1回（1リクエスト）で済む。
 */
export async function fetchProvisionSummaryMap(
  repository: ServiceProvisionRepository,
  recordDateISO: string,
): Promise<Map<string, ServiceProvisionSummary>> {
  const records = await repository.listByDate(recordDateISO);
  const map = new Map<string, ServiceProvisionSummary>();

  for (const record of records) {
    map.set(record.userCode, toProvisionSummary(record));
  }

  return map;
}

/**
 * hasRecord: false の空サマリ（レコード未入力ユーザー用）
 */
export const EMPTY_PROVISION_SUMMARY: ServiceProvisionSummary = {
  hasRecord: false,
};

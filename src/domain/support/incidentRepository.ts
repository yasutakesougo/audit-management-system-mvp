// ---------------------------------------------------------------------------
// IncidentRepository — 危機対応記録の永続化インターフェース
//
// Ports & Adapters パターン: Domain 層にインターフェースを定義し、
// Infra 層 (LocalStorage / SharePoint) にアダプタを実装する。
// ---------------------------------------------------------------------------

import type { HighRiskIncident, RiskSeverity } from './highRiskIncident';

// ---------------------------------------------------------------------------
// Extended Types
// ---------------------------------------------------------------------------

/** インシデント種別 */
export type IncidentType = 'behavior' | 'injury' | 'property' | 'elopement' | 'other';

/**
 * 完全なインシデント記録。
 * 既存 HighRiskIncident を拡張し、報告者・対応・フォローアップ情報を追加。
 */
export type IncidentRecord = HighRiskIncident & {
  /** 報告日時 (ISO 8601) */
  reportedAt: string;
  /** 報告者名 */
  reportedBy: string;
  /** インシデント種別 */
  incidentType: IncidentType;
  /** 即時対応の内容 */
  immediateResponse: string;
  /** 関係者一覧 */
  relatedStaff: string[];
  /** 結果・転帰 */
  outcome: string;
  /** フォローアップ要否 */
  followUpRequired: boolean;
  /** フォローアップメモ */
  followUpNotes?: string;
};

// ---------------------------------------------------------------------------
// Repository Interface
// ---------------------------------------------------------------------------

/**
 * インシデント記録リポジトリ。
 * 実装は infra/ 層 (LocalStorage, SharePoint, etc.) に置く。
 */
export interface IncidentRepository {
  /** レコードを保存（新規 or 更新） */
  save(record: IncidentRecord): Promise<IncidentRecord>;

  /** 全レコードを取得（新しい順） */
  getAll(): Promise<IncidentRecord[]>;

  /** ユーザー別にレコードを取得 */
  getByUserId(userId: string): Promise<IncidentRecord[]>;

  /** ID でレコードを取得 */
  getById(id: string): Promise<IncidentRecord | null>;

  /** レコードを削除 */
  delete(id: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Helper: IncidentRecord 生成
// ---------------------------------------------------------------------------

/** HighRiskIncident から IncidentRecord を生成する */
export function createIncidentRecord(
  incident: HighRiskIncident,
  extra: {
    reportedBy: string;
    incidentType?: IncidentType;
    immediateResponse?: string;
    relatedStaff?: string[];
    outcome?: string;
    followUpRequired?: boolean;
    followUpNotes?: string;
  },
): IncidentRecord {
  return {
    ...incident,
    reportedAt: new Date().toISOString(),
    reportedBy: extra.reportedBy,
    incidentType: extra.incidentType ?? 'behavior',
    immediateResponse: extra.immediateResponse ?? '',
    relatedStaff: extra.relatedStaff ?? [],
    outcome: extra.outcome ?? '',
    followUpRequired: extra.followUpRequired ?? false,
    followUpNotes: extra.followUpNotes,
  };
}

// ---------------------------------------------------------------------------
// Summary Types (for dashboard aggregation)
// ---------------------------------------------------------------------------

/** インシデントサマリー（ダッシュボード表示用） */
export type IncidentSummary = {
  total: number;
  bySeverity: Record<RiskSeverity, number>;
  byType: Record<IncidentType, number>;
  pendingFollowUp: number;
  last30Days: number;
};

/** IncidentRecord[] からサマリーを算出する */
export function computeIncidentSummary(records: IncidentRecord[]): IncidentSummary {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const bySeverity: Record<RiskSeverity, number> = { '低': 0, '中': 0, '高': 0, '重大インシデント': 0 };
  const byType: Record<IncidentType, number> = {
    behavior: 0, injury: 0, property: 0, elopement: 0, other: 0,
  };
  let pendingFollowUp = 0;
  let last30Days = 0;

  for (const r of records) {
    bySeverity[r.severity]++;
    byType[r.incidentType]++;
    if (r.followUpRequired) pendingFollowUp++;
    if (new Date(r.occurredAt) >= thirtyDaysAgo) last30Days++;
  }

  return {
    total: records.length,
    bySeverity,
    byType,
    pendingFollowUp,
    last30Days,
  };
}

// ---------------------------------------------------------------------------
// ComplianceRepository — 適正化運用の永続化インターフェース
//
// Ports & Adapters パターン: Domain 層にインターフェースを定義し、
// Infra 層 (LocalStorage / SharePoint) にアダプタを実装する。
//
// 委員会記録・指針版管理・研修記録の3つをまとめた統合リポジトリ。
// ---------------------------------------------------------------------------

import type { CommitteeMeetingRecord } from './complianceCommittee';
import type { GuidelineVersion, GuidelineStatus } from './guidelineVersion';
import type { TrainingRecord, TrainingStatus } from './trainingRecord';

// ---------------------------------------------------------------------------
// Repository Interfaces
// ---------------------------------------------------------------------------

/** 委員会記録リポジトリ */
export interface CommitteeRepository {
  save(record: CommitteeMeetingRecord): Promise<CommitteeMeetingRecord>;
  getAll(): Promise<CommitteeMeetingRecord[]>;
  getById(id: string): Promise<CommitteeMeetingRecord | null>;
  delete(id: string): Promise<void>;
}

/** 指針版管理リポジトリ */
export interface GuidelineRepository {
  save(version: GuidelineVersion): Promise<GuidelineVersion>;
  getAll(): Promise<GuidelineVersion[]>;
  getById(id: string): Promise<GuidelineVersion | null>;
  getCurrent(): Promise<GuidelineVersion | null>;
  delete(id: string): Promise<void>;
  updateStatus(id: string, status: GuidelineStatus): Promise<GuidelineVersion | null>;
}

/** 研修記録リポジトリ */
export interface TrainingRepository {
  save(record: TrainingRecord): Promise<TrainingRecord>;
  getAll(): Promise<TrainingRecord[]>;
  getById(id: string): Promise<TrainingRecord | null>;
  delete(id: string): Promise<void>;
  updateStatus(id: string, status: TrainingStatus): Promise<TrainingRecord | null>;
}

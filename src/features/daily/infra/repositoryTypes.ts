/**
 * Repository types — backward-compatible re-exports.
 *
 * Original definitions have been promoted to proper domain Ports:
 * - ProcedureRepository → domain/ProcedureRepository.ts
 * - BehaviorRepository  → domain/BehaviorRepository.ts (already existed)
 *
 * This file re-exports them so that existing consumers
 * (e.g. useTimeBasedSupportRecordPage.ts) continue to compile.
 */
import type { BehaviorObservation } from '../domain/daily/types';
export type { ProcedureRepository, ProcedureStep } from '../domain/ProcedureRepository';

export type BehaviorRecord = BehaviorObservation;

export interface BehaviorRepository {
  fetchByUser(userId: string): Promise<void>;
  add(record: Omit<BehaviorRecord, 'id'>): Promise<BehaviorRecord>;
}

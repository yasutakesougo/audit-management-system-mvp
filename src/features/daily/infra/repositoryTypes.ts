import type { ScheduleItem } from '../components/split-stream/ProcedurePanel';
import type { BehaviorObservation } from '../domain/daily/types';

export type ProcedureStep = ScheduleItem;
export type BehaviorRecord = BehaviorObservation;

export interface ProcedureRepository {
  getByUser(userId: string): ProcedureStep[];
  save(userId: string, steps: ProcedureStep[]): void;
}

export interface BehaviorRepository {
  fetchByUser(userId: string): Promise<void>;
  add(record: Omit<BehaviorRecord, 'id'>): Promise<BehaviorRecord>;
}

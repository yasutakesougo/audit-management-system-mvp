import type { ABCRecord } from './abc';

/**
 * ABC 行動観察記録の永続化ポート。
 *
 * Shadow Model 側の UI 補助状態とは分離し、
 * 記録そのものの正本導線を担う。
 */
export interface BehaviorObservationRepository {
  add(record: ABCRecord): ABCRecord;
  listByUser(userId: string): ABCRecord[];
  listAll(): ABCRecord[];
  clearAll(): void;
}

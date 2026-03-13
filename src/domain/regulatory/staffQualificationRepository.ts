// ---------------------------------------------------------------------------
// StaffQualificationRepository — P4 研修・資格・観察の Repository port
// ---------------------------------------------------------------------------

import type { StaffTrainingHistory } from './staffTrainingHistory';
import type { QualificationAssignment } from './qualificationAssignment';
import type { WeeklyObservationRecord } from './weeklyObservation';

export interface StaffTrainingHistoryRepository {
  save(record: StaffTrainingHistory): Promise<StaffTrainingHistory>;
  getAll(): Promise<StaffTrainingHistory[]>;
  listByStaff(staffId: string): Promise<StaffTrainingHistory[]>;
  delete(id: string): Promise<void>;
}

export interface QualificationAssignmentRepository {
  save(record: QualificationAssignment): Promise<QualificationAssignment>;
  getAll(): Promise<QualificationAssignment[]>;
  listByStaff(staffId: string): Promise<QualificationAssignment[]>;
  listByUser(userId: string): Promise<QualificationAssignment[]>;
  delete(id: string): Promise<void>;
}

export interface WeeklyObservationRepository {
  save(record: WeeklyObservationRecord): Promise<WeeklyObservationRecord>;
  getAll(): Promise<WeeklyObservationRecord[]>;
  listByStaffPair(observerId: string, targetStaffId: string): Promise<WeeklyObservationRecord[]>;
  listByUser(userId: string): Promise<WeeklyObservationRecord[]>;
  delete(id: string): Promise<void>;
}

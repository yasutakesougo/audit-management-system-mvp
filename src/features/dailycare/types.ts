export type DailyStatus = 'Present' | 'Absent' | 'Online';

export interface UserMaster {
  id: string;
  name: string;
  recipientId: string;
  isEligibleForMealAddon: boolean;
  defaultServiceTime: { start: string; end: string };
}

export interface Contract {
  userId: string;
  contractedVolume: number;
  serviceYearMonth: string;
}

export interface DailyRecord {
  date: string;
  status: DailyStatus;
  startTime?: string;
  endTime?: string;
  transportationAddon: { 往: boolean; 復: boolean };
  mealAddon: boolean;
  bathingAddon: boolean;
  otherAddons: Record<string, unknown>;
  isAbsenceSupportApplied?: boolean;
  absenceSupportMemo?: string;
  absenceContactTime?: string;
  memo: string;
  isUserConfirmed: boolean;
  confirmedTimestamp?: string;
}

export interface CalculatedDailyRecord extends DailyRecord {
  calculatedHours: number;
  isAbsenceSupportDisabled: boolean;
}

export interface MonthlySummary {
  presentDays: number;
  absentDays: number;
  onlineDays: number;
  transportOutbound: number;
  transportInbound: number;
  mealAddonCount: number;
  bathingAddonCount: number;
  otherAddonCounts: Record<string, number>;
  absenceSupportCount: number;
}


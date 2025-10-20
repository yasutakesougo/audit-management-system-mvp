import { create } from 'zustand';
import {
  addDays,
  differenceInMinutes,
  endOfMonth,
  format,
  parse,
  startOfDay,
  startOfMonth,
} from 'date-fns';
import type {
  CalculatedDailyRecord,
  Contract,
  DailyRecord,
  MonthlySummary,
  UserMaster,
} from './types';

const ABSENCE_SUPPORT_LIMIT_DEFAULT = 2;

const ZERO_SUMMARY: MonthlySummary = {
  presentDays: 0,
  absentDays: 0,
  onlineDays: 0,
  transportOutbound: 0,
  transportInbound: 0,
  mealAddonCount: 0,
  bathingAddonCount: 0,
  otherAddonCounts: {},
  absenceSupportCount: 0,
};

type DailyCareState = {
  user?: UserMaster;
  contract?: Contract;
  records: CalculatedDailyRecord[];
  monthlySummary: MonthlySummary;
  absenceSupportLimit: number;
  initializeMonth: (user: UserMaster, contract: Contract) => void;
  updateRecord: (date: string, changes: Partial<DailyRecord>) => void;
  reset: () => void;
};

function timeStringToMinutes(time?: string): number | undefined {
  if (!time) return undefined;
  const parsed = parse(time, 'HH:mm', new Date());
  return differenceInMinutes(parsed, startOfDay(parsed));
}

function calculateHours(status: DailyRecord['status'], start?: string, end?: string): number {
  if (status === 'Absent') return 0;
  const startMinutes = timeStringToMinutes(start);
  const endMinutes = timeStringToMinutes(end);
  if (
    typeof startMinutes === 'undefined' ||
    typeof endMinutes === 'undefined' ||
    endMinutes <= startMinutes
  ) {
    return 0;
  }
  const diffMinutes = endMinutes - startMinutes;
  return Math.round((diffMinutes / 60) * 100) / 100;
}

function buildDefaultRecord(date: string, user: UserMaster): CalculatedDailyRecord {
  const status: DailyRecord['status'] = 'Present';
  const startTime = user.defaultServiceTime.start;
  const endTime = user.defaultServiceTime.end;
  return {
    date,
    status,
    startTime,
    endTime,
    transportationAddon: { 往: false, 復: false },
    mealAddon: user.isEligibleForMealAddon,
    bathingAddon: false,
    otherAddons: {},
    isAbsenceSupportApplied: false,
    absenceSupportMemo: undefined,
    absenceContactTime: undefined,
    memo: '',
    isUserConfirmed: false,
    confirmedTimestamp: undefined,
    calculatedHours: calculateHours(status, startTime, endTime),
    isAbsenceSupportDisabled: true,
  };
}

function generateMonthRecords(user: UserMaster, contract: Contract): CalculatedDailyRecord[] {
  const [year, month] = contract.serviceYearMonth.split('-').map(Number);
  if (!year || !month) {
    throw new Error(`Invalid serviceYearMonth: ${contract.serviceYearMonth}`);
  }
  const firstDay = startOfMonth(new Date(year, month - 1, 1));
  const lastDay = endOfMonth(firstDay);
  const records: CalculatedDailyRecord[] = [];
  for (let day = firstDay; day <= lastDay; day = addDays(day, 1)) {
    records.push(buildDefaultRecord(format(day, 'yyyy-MM-dd'), user));
  }
  return records;
}

function normalizeRecord(
  record: CalculatedDailyRecord,
  changes: Partial<DailyRecord>,
  user?: UserMaster,
): CalculatedDailyRecord {
  const next = { ...record, ...changes };
  if (changes.transportationAddon) {
    next.transportationAddon = {
      往: Boolean(changes.transportationAddon.往),
      復: Boolean(changes.transportationAddon.復),
    };
  }
  if (typeof next.mealAddon === 'boolean' && user && !user.isEligibleForMealAddon) {
    next.mealAddon = false;
  }
  if (next.status === 'Absent') {
    next.startTime = undefined;
    next.endTime = undefined;
    next.transportationAddon = { 往: false, 復: false };
    next.mealAddon = false;
    next.bathingAddon = false;
  } else {
    next.isAbsenceSupportApplied = false;
    next.absenceSupportMemo = undefined;
    next.absenceContactTime = undefined;
  }
  if (typeof next.isUserConfirmed === 'boolean') {
    if (next.isUserConfirmed) {
      next.confirmedTimestamp = next.confirmedTimestamp ?? new Date().toISOString();
    } else {
      next.confirmedTimestamp = undefined;
    }
  }
  next.calculatedHours = calculateHours(next.status, next.startTime, next.endTime);
  return next;
}

function enforceAbsenceSupportLimit(
  records: CalculatedDailyRecord[],
  limit: number,
): CalculatedDailyRecord[] {
  if (limit <= 0) {
    return records.map(record => ({
      ...record,
      isAbsenceSupportApplied: false,
      isAbsenceSupportDisabled: true,
    }));
  }
  let appliedCount = 0;
  return records.map(record => {
    if (record.status !== 'Absent') {
      return {
        ...record,
        isAbsenceSupportApplied: false,
        isAbsenceSupportDisabled: true,
      };
    }
    let isApplied = Boolean(record.isAbsenceSupportApplied);
    if (isApplied) {
      if (appliedCount < limit) {
        appliedCount += 1;
      } else {
        isApplied = false;
      }
    }
    const disabled = appliedCount >= limit && !isApplied;
    return {
      ...record,
      isAbsenceSupportApplied: isApplied,
      isAbsenceSupportDisabled: disabled,
    };
  });
}

function computeMonthlySummary(records: CalculatedDailyRecord[]): MonthlySummary {
  if (!records.length) return { ...ZERO_SUMMARY };
  return records.reduce<MonthlySummary>(
    (summary, record) => {
      switch (record.status) {
        case 'Present':
          summary.presentDays += 1;
          break;
        case 'Absent':
          summary.absentDays += 1;
          break;
        case 'Online':
          summary.onlineDays += 1;
          break;
      }
      if (record.transportationAddon.往) summary.transportOutbound += 1;
      if (record.transportationAddon.復) summary.transportInbound += 1;
      if (record.mealAddon) summary.mealAddonCount += 1;
      if (record.bathingAddon) summary.bathingAddonCount += 1;
      if (record.isAbsenceSupportApplied) summary.absenceSupportCount += 1;
      Object.entries(record.otherAddons).forEach(([key, value]) => {
        if (!value) return;
        summary.otherAddonCounts[key] = (summary.otherAddonCounts[key] ?? 0) + 1;
      });
      return summary;
    },
    {
      presentDays: 0,
      absentDays: 0,
      onlineDays: 0,
      transportOutbound: 0,
      transportInbound: 0,
      mealAddonCount: 0,
      bathingAddonCount: 0,
      otherAddonCounts: {},
      absenceSupportCount: 0,
    },
  );
}

export const useDailyCareStore = create<DailyCareState>((set, get) => ({
  user: undefined,
  contract: undefined,
  records: [],
  monthlySummary: { ...ZERO_SUMMARY },
  absenceSupportLimit: ABSENCE_SUPPORT_LIMIT_DEFAULT,
  initializeMonth: (user, contract) => {
    const initialRecords = enforceAbsenceSupportLimit(
      generateMonthRecords(user, contract),
      ABSENCE_SUPPORT_LIMIT_DEFAULT,
    );
    set({
      user,
      contract,
      records: initialRecords,
      monthlySummary: computeMonthlySummary(initialRecords),
    });
  },
  updateRecord: (date, changes) => {
    const { records, user, absenceSupportLimit } = get();
    const index = records.findIndex(record => record.date === date);
    if (index === -1) return;
    const updated = normalizeRecord(records[index], changes, user);
    const nextRecords = [...records];
    nextRecords[index] = updated;
    const enforced = enforceAbsenceSupportLimit(nextRecords, absenceSupportLimit);
    set({
      records: enforced,
      monthlySummary: computeMonthlySummary(enforced),
    });
  },
  reset: () =>
    set({
      user: undefined,
      contract: undefined,
      records: [],
      monthlySummary: { ...ZERO_SUMMARY },
      absenceSupportLimit: ABSENCE_SUPPORT_LIMIT_DEFAULT,
    }),
}));

export type { DailyCareState };

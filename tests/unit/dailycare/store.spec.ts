import { beforeEach, describe, expect, it } from 'vitest';
import { useDailyCareStore } from '../../../src/features/dailycare/store';
import { sampleContract, sampleUser } from '../../../src/features/dailycare/sampleData';

describe('useDailyCareStore', () => {
  beforeEach(() => {
    useDailyCareStore.getState().reset();
    useDailyCareStore.getState().initializeMonth(sampleUser, sampleContract);
  });

  it('initializes all days with default service times and summary', () => {
    const { records, monthlySummary } = useDailyCareStore.getState();
    expect(records.length).toBe(30);
    expect(records[0].status).toBe('Present');
    expect(records[0].startTime).toBe(sampleUser.defaultServiceTime.start);
    expect(records[0].endTime).toBe(sampleUser.defaultServiceTime.end);
    expect(monthlySummary.presentDays).toBe(30);
    expect(monthlySummary.absenceSupportCount).toBe(0);
  });

  it('recalculates hours when service times change', () => {
    const firstDate = useDailyCareStore.getState().records[0].date;
    useDailyCareStore.getState().updateRecord(firstDate, { startTime: '10:00', endTime: '15:30' });
    const updated = useDailyCareStore.getState().records.find(record => record.date === firstDate);
    expect(updated?.calculatedHours).toBe(5.5);
  });

  it('enforces absence support limit and summary updates', () => {
    const dates = useDailyCareStore.getState().records.slice(0, 3).map(record => record.date);
    dates.forEach(date => {
      useDailyCareStore.getState().updateRecord(date, { status: 'Absent' });
    });
    useDailyCareStore.getState().updateRecord(dates[0], { isAbsenceSupportApplied: true });
    useDailyCareStore.getState().updateRecord(dates[1], { isAbsenceSupportApplied: true });
    useDailyCareStore.getState().updateRecord(dates[2], { isAbsenceSupportApplied: true });

    const state = useDailyCareStore.getState();
    const [first, second, third] = dates.map(date => state.records.find(record => record.date === date)!);

    expect(first.isAbsenceSupportApplied).toBe(true);
    expect(first.isAbsenceSupportDisabled).toBe(false);
    expect(second.isAbsenceSupportApplied).toBe(true);
    expect(second.isAbsenceSupportDisabled).toBe(false);
    expect(third.isAbsenceSupportApplied).toBe(false);
    expect(third.isAbsenceSupportDisabled).toBe(true);
    expect(state.monthlySummary.absenceSupportCount).toBe(2);
  });
});


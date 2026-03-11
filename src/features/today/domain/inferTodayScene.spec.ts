/**
 * inferTodayScene — unit tests
 */
import { describe, expect, it } from 'vitest';
import { inferTodayScene } from './inferTodayScene';

function makeDate(hour: number, minute: number): Date {
  const d = new Date(2026, 2, 11); // March 11, 2026
  d.setHours(hour, minute, 0, 0);
  return d;
}

describe('inferTodayScene', () => {
  it('returns morning-briefing before 9:30', () => {
    expect(inferTodayScene(makeDate(8, 0))).toBe('morning-briefing');
    expect(inferTodayScene(makeDate(9, 29))).toBe('morning-briefing');
  });

  it('returns arrival-intake from 9:30 to 10:19', () => {
    expect(inferTodayScene(makeDate(9, 30))).toBe('arrival-intake');
    expect(inferTodayScene(makeDate(10, 19))).toBe('arrival-intake');
  });

  it('returns before-am-activity from 10:20 to 10:29', () => {
    expect(inferTodayScene(makeDate(10, 20))).toBe('before-am-activity');
    expect(inferTodayScene(makeDate(10, 29))).toBe('before-am-activity');
  });

  it('returns am-activity from 10:30 to 11:44', () => {
    expect(inferTodayScene(makeDate(10, 30))).toBe('am-activity');
    expect(inferTodayScene(makeDate(11, 44))).toBe('am-activity');
  });

  it('returns lunch-transition from 11:45 to 12:59', () => {
    expect(inferTodayScene(makeDate(11, 45))).toBe('lunch-transition');
    expect(inferTodayScene(makeDate(12, 59))).toBe('lunch-transition');
  });

  it('returns before-pm-activity from 13:00 to 13:44', () => {
    expect(inferTodayScene(makeDate(13, 0))).toBe('before-pm-activity');
    expect(inferTodayScene(makeDate(13, 44))).toBe('before-pm-activity');
  });

  it('returns pm-activity from 13:45 to 15:19', () => {
    expect(inferTodayScene(makeDate(13, 45))).toBe('pm-activity');
    expect(inferTodayScene(makeDate(15, 19))).toBe('pm-activity');
  });

  it('returns post-activity from 15:20 to 15:39', () => {
    expect(inferTodayScene(makeDate(15, 20))).toBe('post-activity');
    expect(inferTodayScene(makeDate(15, 39))).toBe('post-activity');
  });

  it('returns before-departure from 15:40 to 15:59', () => {
    expect(inferTodayScene(makeDate(15, 40))).toBe('before-departure');
    expect(inferTodayScene(makeDate(15, 59))).toBe('before-departure');
  });

  it('returns day-closing from 16:00', () => {
    expect(inferTodayScene(makeDate(16, 0))).toBe('day-closing');
    expect(inferTodayScene(makeDate(17, 30))).toBe('day-closing');
  });

  // Edge: midnight / early morning
  it('returns morning-briefing for early morning', () => {
    expect(inferTodayScene(makeDate(6, 0))).toBe('morning-briefing');
  });
});

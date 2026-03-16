/**
 * Tests for TimeFlow support record utility functions
 *
 * Covers: normalizeTemplateTime, countRecordedSlots, convertMasterTemplates
 */
import { describe, expect, it } from 'vitest';
import {
  normalizeTemplateTime,
  countRecordedSlots,
  buildDefaultMasterTemplates,
  convertMasterTemplates,
} from '@/features/daily/components/time-flow/timeFlowUtils';
import type { SupportRecord } from '@/features/daily/components/time-flow/timeFlowTypes';

// ─────────────────────────────────────────────────────────────────────────────
// normalizeTemplateTime
// ─────────────────────────────────────────────────────────────────────────────
describe('normalizeTemplateTime', () => {
  it('normalizes HH:MM format', () => {
    expect(normalizeTemplateTime('9:30')).toBe('09:30');
  });

  it('normalizes full-width colon', () => {
    expect(normalizeTemplateTime('9：30')).toBe('09:30');
  });

  it('normalizes hour-only input', () => {
    expect(normalizeTemplateTime('9')).toBe('09:00');
  });

  it('clamps hours to 0-23', () => {
    expect(normalizeTemplateTime('25:00')).toBe('23:00');
  });

  it('clamps minutes to 0-59', () => {
    expect(normalizeTemplateTime('10:75')).toBe('10:59');
  });

  it('returns 00:00 for empty string', () => {
    expect(normalizeTemplateTime('')).toBe('00:00');
  });

  it('returns 00:00 for whitespace-only', () => {
    expect(normalizeTemplateTime('   ')).toBe('00:00');
  });

  it('pads single-digit hours and minutes', () => {
    expect(normalizeTemplateTime('1:5')).toBe('01:05');
  });

  it('returns raw string for unrecognized format', () => {
    expect(normalizeTemplateTime('invalid')).toBe('invalid');
  });

  it('handles 0:0', () => {
    expect(normalizeTemplateTime('0:0')).toBe('00:00');
  });

  it('handles 23:59 maximum', () => {
    expect(normalizeTemplateTime('23:59')).toBe('23:59');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// countRecordedSlots
// ─────────────────────────────────────────────────────────────────────────────
describe('countRecordedSlots', () => {
  const createRecord = (status: '記録済み' | '未記録' | '作成中'): SupportRecord =>
    ({
      id: 1,
      supportPlanId: 'plan-1',
      userId: 'u-1',
      userName: 'Test',
      date: '2026-03-14',
      timeSlot: '09:00 活動',
      activityKey: '09:00',
      activityName: '活動',
      userActivities: { planned: '', actual: '', notes: '' },
      staffActivities: { planned: '', actual: '', notes: '' },
      userCondition: { mood: '普通' },
      specialNotes: {},
      reporter: { name: 'A', role: 'staff' },
      status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }) as SupportRecord;

  it('counts only 記録済み records', () => {
    const records = [
      createRecord('記録済み'),
      createRecord('未記録'),
      createRecord('記録済み'),
      createRecord('作成中'),
    ];
    expect(countRecordedSlots(records)).toBe(2);
  });

  it('returns 0 for empty array', () => {
    expect(countRecordedSlots([])).toBe(0);
  });

  it('returns 0 when no 記録済み records exist', () => {
    const records = [createRecord('未記録'), createRecord('作成中')];
    expect(countRecordedSlots(records)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildDefaultMasterTemplates
// ─────────────────────────────────────────────────────────────────────────────
describe('buildDefaultMasterTemplates', () => {
  it('returns an array of templates', () => {
    const templates = buildDefaultMasterTemplates();
    expect(templates.length).toBeGreaterThan(0);
  });

  it('each template has a unique id', () => {
    const templates = buildDefaultMasterTemplates();
    const ids = templates.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('each template has iconEmoji', () => {
    const templates = buildDefaultMasterTemplates();
    templates.forEach(t => {
      expect(t.iconEmoji).toBeDefined();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// convertMasterTemplates
// ─────────────────────────────────────────────────────────────────────────────
describe('convertMasterTemplates', () => {
  it('converts master templates to flow format', () => {
    const master = buildDefaultMasterTemplates();
    const flow = convertMasterTemplates(master);
    expect(flow.length).toBe(master.length);
    flow.forEach(f => {
      expect(f).toHaveProperty('time');
      expect(f).toHaveProperty('title');
      expect(f).toHaveProperty('personTodo');
      expect(f).toHaveProperty('supporterTodo');
      expect(f).toHaveProperty('stage');
    });
  });

  it('sorts by time ascending', () => {
    const master = buildDefaultMasterTemplates();
    const flow = convertMasterTemplates(master);
    for (let i = 1; i < flow.length; i++) {
      expect(flow[i].time >= flow[i - 1].time).toBe(true);
    }
  });
});

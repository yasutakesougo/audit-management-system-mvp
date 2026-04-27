import { describe, it, expect } from 'vitest';
import { validateScheduleForm, type ScheduleFormState } from '../scheduleFormState';

describe('validateScheduleForm', () => {
  const validBaseForm: ScheduleFormState = {
    title: 'Test Schedule',
    category: 'User',
    userId: 'user123',
    startLocal: '2024-04-27T10:00',
    endLocal: '2024-04-27T11:00',
    serviceType: 'absence',
    locationName: 'Office',
    notes: 'Some notes',
    assignedStaffId: 'staff1',
    vehicleId: 'v1',
    status: 'Planned',
    statusReason: '',
  };

  it('passes for a valid form', () => {
    const result = validateScheduleForm(validBaseForm);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails if title is empty', () => {
    const form = { ...validBaseForm, title: '' };
    const result = validateScheduleForm(form);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('予定タイトルを入力してください');
  });

  it('fails if startLocal is empty', () => {
    const form = { ...validBaseForm, startLocal: '' };
    const result = validateScheduleForm(form);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('開始日時を入力してください');
  });

  it('fails if endLocal is earlier than startLocal', () => {
    const form = { 
      ...validBaseForm, 
      startLocal: '2024-04-27T11:00',
      endLocal: '2024-04-27T10:00' 
    };
    const result = validateScheduleForm(form);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('終了日時は開始日時より後にしてください');
  });

  it('fails if category is User and serviceType is missing', () => {
    const form = { ...validBaseForm, category: 'User' as const, serviceType: '' };
    const result = validateScheduleForm(form);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('サービス種別を選択してください');
  });

  it('fails if category is LivingSupport and serviceType is missing', () => {
    const form = { ...validBaseForm, category: 'LivingSupport' as const, serviceType: '' };
    const result = validateScheduleForm(form);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('サービス種別を選択してください');
  });

  it('passes if category is Org and serviceType is missing', () => {
    const form = { ...validBaseForm, category: 'Org' as const, serviceType: '' };
    const result = validateScheduleForm(form);
    expect(result.isValid).toBe(true);
  });
});

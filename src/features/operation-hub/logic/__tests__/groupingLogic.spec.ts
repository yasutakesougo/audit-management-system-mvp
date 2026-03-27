import type { Staff } from '@/types';
import { describe, expect, it } from 'vitest';
import { classifyEmployment, resolveGroupLabel } from '../groupingLogic';

const makeStaff = (overrides: Partial<Staff> = {}): Staff => ({
  id: overrides.id ?? 1,
  staffId: overrides.staffId ?? 'S001',
  name: overrides.name ?? '職員A',
  certifications: overrides.certifications ?? [],
  workDays: overrides.workDays ?? [],
  baseWorkingDays: overrides.baseWorkingDays ?? [],
  ...overrides,
});

describe('operation-hub groupingLogic', () => {
  describe('classifyEmployment', () => {
    it('returns その他 when staff is undefined', () => {
      expect(classifyEmployment(undefined)).toBe('その他');
    });

    it('prioritizes employmentType over role', () => {
      const staff = makeStaff({
        employmentType: '非常勤スタッフ',
        role: '管理者',
      });
      expect(classifyEmployment(staff)).toBe('非常勤');
    });

    it('classifies 管理者 as 施設長', () => {
      const staff = makeStaff({ role: '管理者' });
      expect(classifyEmployment(staff)).toBe('施設長');
    });

    it('classifies 正社員 as 常勤', () => {
      const staff = makeStaff({ role: '正社員' });
      expect(classifyEmployment(staff)).toBe('常勤');
    });

    it('falls back to その他 for unknown labels', () => {
      const staff = makeStaff({ role: '派遣スタッフ' });
      expect(classifyEmployment(staff)).toBe('その他');
    });
  });

  describe('resolveGroupLabel', () => {
    it('maps each employment type to UI group label', () => {
      expect(resolveGroupLabel('施設長')).toBe('施設長');
      expect(resolveGroupLabel('常勤')).toBe('常勤職員');
      expect(resolveGroupLabel('非常勤')).toBe('非常勤職員');
      expect(resolveGroupLabel('その他')).toBe('その他リソース');
    });
  });
});

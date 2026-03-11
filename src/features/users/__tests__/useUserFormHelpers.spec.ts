import { describe, expect, it } from 'vitest';
import {
    deriveTransportDays,
    parseTransportSchedule,
    serializeTransportSchedule,
    toCreateDto,
} from '../useUserFormHelpers';
import type { FormValues } from '../useUserFormTypes';

// ---------------------------------------------------------------------------
// Test helper — provides sensible defaults so individual tests only override
// the one field they're interested in.
// ---------------------------------------------------------------------------

const makeFormValues = (overrides: Partial<FormValues> = {}): FormValues => ({
  FullName: '田中 太郎',
  Furigana: 'たなか たろう',
  FullNameKana: 'タナカ タロウ',
  ContractDate: '2024-01-01',
  ServiceStartDate: '2024-04-01',
  ServiceEndDate: '',
  IsHighIntensitySupportTarget: false,
  IsSupportProcedureTarget: false,
  IsActive: true,
  TransportSchedule: {},
  RecipientCertNumber: '',
  RecipientCertExpiry: '',
  UsageStatus: '利用中',
  GrantMunicipality: '',
  GrantPeriodStart: '',
  GrantPeriodEnd: '',
  DisabilitySupportLevel: '',
  GrantedDaysPerMonth: '',
  UserCopayLimit: '',
  TransportAdditionType: '',
  MealAddition: '',
  CopayPaymentMethod: '',
  ...overrides,
});

// ---------------------------------------------------------------------------
// parseTransportSchedule
// ---------------------------------------------------------------------------

describe('useUserFormHelpers', () => {
  describe('parseTransportSchedule', () => {
    it('should return {} for null input', () => {
      const result = parseTransportSchedule(null);
      expect(result).toEqual({});
    });

    it('should return {} for undefined input', () => {
      const result = parseTransportSchedule(undefined);
      expect(result).toEqual({});
    });

    it('should return {} for empty string input', () => {
      const result = parseTransportSchedule('');
      expect(result).toEqual({});
    });

    it('should parse valid JSON with 2 days and return the correct shape', () => {
      const schedule = {
        月: { to: 'office_shuttle', from: '' },
        火: { to: '', from: 'office_shuttle' },
      };
      const result = parseTransportSchedule(JSON.stringify(schedule));
      expect(result).toEqual(schedule);
    });

    it('should return {} for invalid JSON string', () => {
      const result = parseTransportSchedule('{not-valid-json]');
      expect(result).toEqual({});
    });

    it('should return {} when JSON is an array (not an object)', () => {
      const result = parseTransportSchedule('["月","火"]');
      expect(result).toEqual({});
    });

    it('should return {} when JSON is the literal null value', () => {
      // JSON.parse('null') === null — the object-check catches it
      const result = parseTransportSchedule('null');
      expect(result).toEqual({});
    });

    it('should return {} when JSON is a number', () => {
      // JSON.parse('42') returns a number, typeof !== 'object' check fires
      const result = parseTransportSchedule('42');
      expect(result).toEqual({});
    });
  });

  // ---------------------------------------------------------------------------
  // serializeTransportSchedule
  // ---------------------------------------------------------------------------

  describe('serializeTransportSchedule', () => {
    it('should return null for an empty schedule', () => {
      const result = serializeTransportSchedule({});
      expect(result).toBeNull();
    });

    it('should return null when a day entry has both to and from empty strings', () => {
      const result = serializeTransportSchedule({ 月: { to: '', from: '' } });
      expect(result).toBeNull();
    });

    it('should return a JSON string when only "to" is set', () => {
      const schedule = { 月: { to: 'office_shuttle', from: '' } };
      const result = serializeTransportSchedule(schedule);
      expect(result).toBe(JSON.stringify({ 月: { to: 'office_shuttle', from: '' } }));
    });

    it('should return a JSON string when only "from" is set', () => {
      const schedule = { 火: { to: '', from: 'family' } };
      const result = serializeTransportSchedule(schedule);
      expect(result).toBe(JSON.stringify({ 火: { to: '', from: 'family' } }));
    });

    it('should exclude fully-empty entries and include non-empty entries', () => {
      const schedule = {
        月: { to: 'office_shuttle', from: '' }, // non-empty → keep
        火: { to: '', from: '' },               // empty → exclude
        水: { to: '', from: 'family' },         // non-empty → keep
      };
      const result = serializeTransportSchedule(schedule);
      expect(result).toBe(
        JSON.stringify({
          月: { to: 'office_shuttle', from: '' },
          水: { to: '', from: 'family' },
        }),
      );
    });

    it('should round-trip with parseTransportSchedule', () => {
      const original = {
        月: { to: 'office_shuttle', from: '' },
        金: { to: 'family', from: 'office_shuttle' },
      };
      const serialized = serializeTransportSchedule(original);
      expect(serialized).not.toBeNull();
      const parsed = parseTransportSchedule(serialized);
      expect(parsed).toEqual(original);
    });

    it('should return null when given an array at runtime (explicit guard — mirrors Night Run 6)', () => {
      // TypeScript prevents this at compile time; cast simulates a runtime coercion
      // (e.g., data arrives from SharePoint as an array and is incorrectly cast upstream).
      // Without the explicit guard the behaviour was accidentally correct via empty-filter;
      // this test locks it as intentional.
      const arrayInput = ['月', '火'] as unknown as Record<string, import('../useUserFormTypes').DayTransport>;
      expect(serializeTransportSchedule(arrayInput)).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // deriveTransportDays
  // ---------------------------------------------------------------------------

  describe('deriveTransportDays', () => {
    it('should return empty arrays for an empty schedule', () => {
      const result = deriveTransportDays({});
      expect(result.attendanceDays).toEqual([]);
      expect(result.transportToDays).toEqual([]);
      expect(result.transportFromDays).toEqual([]);
    });

    it('should put a day in attendanceDays AND transportToDays when to is office_shuttle', () => {
      const result = deriveTransportDays({ 月: { to: 'office_shuttle', from: '' } });
      expect(result.attendanceDays).toContain('月');
      expect(result.transportToDays).toContain('月');
      expect(result.transportFromDays).not.toContain('月');
    });

    it('should put a day in attendanceDays AND transportFromDays when from is office_shuttle', () => {
      const result = deriveTransportDays({ 火: { to: '', from: 'office_shuttle' } });
      expect(result.attendanceDays).toContain('火');
      expect(result.transportFromDays).toContain('火');
      expect(result.transportToDays).not.toContain('火');
    });

    it('should put a day in all three arrays when both to and from are office_shuttle', () => {
      const result = deriveTransportDays({ 水: { to: 'office_shuttle', from: 'office_shuttle' } });
      expect(result.attendanceDays).toContain('水');
      expect(result.transportToDays).toContain('水');
      expect(result.transportFromDays).toContain('水');
    });

    it('should put a non-shuttle to value only in attendanceDays, not in transportToDays', () => {
      // 'family' counts as attendance but does NOT trigger the shuttle lists
      const result = deriveTransportDays({ 木: { to: 'family', from: '' } });
      expect(result.attendanceDays).toContain('木');
      expect(result.transportToDays).not.toContain('木');
      expect(result.transportFromDays).not.toContain('木');
    });

    it('should output arrays in WEEKDAY ORDER (月火水木金) regardless of key insertion order', () => {
      // Keys are inserted in reverse order intentionally
      const schedule = {
        金: { to: 'office_shuttle', from: '' },
        水: { to: 'office_shuttle', from: '' },
        月: { to: 'office_shuttle', from: '' },
      };
      const result = deriveTransportDays(schedule);
      expect(result.attendanceDays).toEqual(['月', '水', '金']);
      expect(result.transportToDays).toEqual(['月', '水', '金']);
    });

    it('should ignore schedule keys that are not in WEEKDAYS (e.g. 土)', () => {
      const result = deriveTransportDays({ 土: { to: 'office_shuttle', from: 'office_shuttle' } });
      expect(result.attendanceDays).toEqual([]);
      expect(result.transportToDays).toEqual([]);
      expect(result.transportFromDays).toEqual([]);
    });

    it('should not include a day whose both to and from are empty strings', () => {
      const result = deriveTransportDays({ 月: { to: '', from: '' } });
      expect(result.attendanceDays).toEqual([]);
      expect(result.transportToDays).toEqual([]);
      expect(result.transportFromDays).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // toCreateDto
  // ---------------------------------------------------------------------------

  describe('toCreateDto', () => {
    it('should produce correct DTO for minimal FormValues (only FullName set)', () => {
      const values = makeFormValues({
        FullName: '山田 花子',
        Furigana: '',
        FullNameKana: '',
        ContractDate: '',
        ServiceStartDate: '',
        ServiceEndDate: '',
        IsHighIntensitySupportTarget: false,
        IsSupportProcedureTarget: false,
        IsActive: true,
        TransportSchedule: {},
        RecipientCertNumber: '',
        RecipientCertExpiry: '',
        UsageStatus: '',
        GrantMunicipality: '',
        GrantPeriodStart: '',
        GrantPeriodEnd: '',
        DisabilitySupportLevel: '',
        GrantedDaysPerMonth: '',
        UserCopayLimit: '',
        TransportAdditionType: '',
        MealAddition: '',
        CopayPaymentMethod: '',
      });
      const dto = toCreateDto(values);

      expect(dto.FullName).toBe('山田 花子');
      // All optional string fields that were empty must be null
      expect(dto.Furigana).toBeNull();
      expect(dto.FullNameKana).toBeNull();
      expect(dto.ContractDate).toBeNull();
      expect(dto.ServiceStartDate).toBeNull();
      expect(dto.ServiceEndDate).toBeNull();
      expect(dto.RecipientCertNumber).toBeNull();
      expect(dto.RecipientCertExpiry).toBeNull();
      expect(dto.UsageStatus).toBeNull();
      // Transport
      expect(dto.TransportToDays).toBeNull();
      expect(dto.TransportFromDays).toBeNull();
      expect(dto.AttendanceDays).toBeNull();
      expect(dto.TransportSchedule).toBeNull();
      // severeFlag is always hardcoded false
      expect(dto.severeFlag).toBe(false);
    });

    it('should trim surrounding whitespace from FullName', () => {
      const dto = toCreateDto(makeFormValues({ FullName: '  田中 太郎  ' }));
      expect(dto.FullName).toBe('田中 太郎');
    });

    it('should map whitespace-only optional string fields to null', () => {
      const dto = toCreateDto(
        makeFormValues({
          Furigana: '   ',
          FullNameKana: '\t',
          ContractDate: '  ',
          RecipientCertNumber: ' ',
        }),
      );
      expect(dto.Furigana).toBeNull();
      expect(dto.FullNameKana).toBeNull();
      expect(dto.ContractDate).toBeNull();
      expect(dto.RecipientCertNumber).toBeNull();
    });

    it('should trim and include non-empty optional string fields', () => {
      const dto = toCreateDto(
        makeFormValues({
          Furigana: '  やまだ はなこ  ',
          GrantMunicipality: ' 東京都 ',
        }),
      );
      expect(dto.Furigana).toBe('やまだ はなこ');
      expect(dto.GrantMunicipality).toBe('東京都');
    });

    it('should pass boolean flags through to the DTO correctly', () => {
      const dto = toCreateDto(
        makeFormValues({
          IsHighIntensitySupportTarget: true,
          IsSupportProcedureTarget: true,
          IsActive: false,
        }),
      );
      expect(dto.IsHighIntensitySupportTarget).toBe(true);
      expect(dto.IsSupportProcedureTarget).toBe(true);
      expect(dto.IsActive).toBe(false);
    });

    it('should populate transport arrays and serialized JSON when office_shuttle days are set', () => {
      const dto = toCreateDto(
        makeFormValues({
          TransportSchedule: {
            月: { to: 'office_shuttle', from: '' },
            水: { to: '', from: 'office_shuttle' },
            金: { to: 'office_shuttle', from: 'office_shuttle' },
          },
        }),
      );
      expect(dto.TransportToDays).toEqual(['月', '金']);
      expect(dto.TransportFromDays).toEqual(['水', '金']);
      expect(dto.AttendanceDays).toEqual(['月', '水', '金']);
      expect(typeof dto.TransportSchedule).toBe('string');
      // The serialized JSON should be parseable back to the same shape
      const parsed = JSON.parse(dto.TransportSchedule as string) as Record<string, unknown>;
      expect(Object.keys(parsed)).toContain('月');
      expect(Object.keys(parsed)).toContain('水');
      expect(Object.keys(parsed)).toContain('金');
    });

    it('should populate AttendanceDays but keep TransportToDays null for non-shuttle to value', () => {
      const dto = toCreateDto(
        makeFormValues({
          TransportSchedule: {
            火: { to: 'family', from: '' },
          },
        }),
      );
      expect(dto.AttendanceDays).toEqual(['火']);
      // 'family' is NOT office_shuttle → no transport days
      expect(dto.TransportToDays).toBeNull();
      expect(dto.TransportFromDays).toBeNull();
    });

    it('should always set severeFlag to false regardless of other inputs', () => {
      // Even if someone tried to force it through FormValues, it's hardcoded
      const dto1 = toCreateDto(makeFormValues({ IsHighIntensitySupportTarget: true }));
      const dto2 = toCreateDto(makeFormValues({ IsHighIntensitySupportTarget: false }));
      expect(dto1.severeFlag).toBe(false);
      expect(dto2.severeFlag).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // transport schedule pipeline (round-trip)
  // Validates the full parse → derive → serialize → DTO chain end-to-end.
  // These tests guard against regressions across the entire pipeline, not just
  // individual helpers in isolation.
  // ---------------------------------------------------------------------------

  describe('transport schedule pipeline (round-trip)', () => {
    it('array JSON through parseTransportSchedule yields empty schedule — Night Run 6 regression', () => {
      // This is the specific bug closed in Night Run 6.
      // Array-shaped JSON must be rejected all the way through the pipeline.
      const parsed = parseTransportSchedule('["月","火"]');
      expect(parsed).toEqual({});
      // Derived values from an empty schedule must all be empty
      const derived = deriveTransportDays(parsed);
      expect(derived.attendanceDays).toEqual([]);
      expect(derived.transportToDays).toEqual([]);
      expect(derived.transportFromDays).toEqual([]);
    });

    it('array JSON stored in FormValues produces all-null transport DTO fields', () => {
      // Simulates a corrupt SharePoint value being fed back through the form.
      // parseTransportSchedule rejects it → toCreateDto receives {} → all null.
      const corruptJson = '["月","火","水"]';
      const schedule = parseTransportSchedule(corruptJson);
      const dto = toCreateDto(makeFormValues({ TransportSchedule: schedule }));
      expect(dto.TransportToDays).toBeNull();
      expect(dto.TransportFromDays).toBeNull();
      expect(dto.AttendanceDays).toBeNull();
      expect(dto.TransportSchedule).toBeNull();
    });

    it('null JSON stored in FormValues produces all-null transport DTO fields', () => {
      const schedule = parseTransportSchedule(null);
      const dto = toCreateDto(makeFormValues({ TransportSchedule: schedule }));
      expect(dto.TransportToDays).toBeNull();
      expect(dto.TransportFromDays).toBeNull();
      expect(dto.AttendanceDays).toBeNull();
      expect(dto.TransportSchedule).toBeNull();
    });

    it('corrupt JSON stored in FormValues produces all-null transport DTO fields', () => {
      const schedule = parseTransportSchedule('{bad json]');
      const dto = toCreateDto(makeFormValues({ TransportSchedule: schedule }));
      expect(dto.TransportToDays).toBeNull();
      expect(dto.TransportFromDays).toBeNull();
      expect(dto.AttendanceDays).toBeNull();
      expect(dto.TransportSchedule).toBeNull();
    });

    it('valid schedule round-trips: serialize → parse → toCreateDto produces correct DTO', () => {
      // Build a schedule, serialize it (as SharePoint would store it),
      // parse it back (as the form would load it), then produce the DTO.
      // The DTO transport arrays must match the original schedule exactly.
      const original = {
        月: { to: 'office_shuttle', from: '' },
        水: { to: '', from: 'office_shuttle' },
        金: { to: 'office_shuttle', from: 'office_shuttle' },
      };
      const serialized = serializeTransportSchedule(original);
      expect(serialized).not.toBeNull();

      const reparsed = parseTransportSchedule(serialized);
      expect(reparsed).toEqual(original);

      const dto = toCreateDto(makeFormValues({ TransportSchedule: reparsed }));
      expect(dto.AttendanceDays).toEqual(['月', '水', '金']);
      expect(dto.TransportToDays).toEqual(['月', '金']);
      expect(dto.TransportFromDays).toEqual(['水', '金']);
      expect(typeof dto.TransportSchedule).toBe('string');
    });
  });
});

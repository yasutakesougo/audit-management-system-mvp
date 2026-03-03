/**
 * ドメインスキーマ（Zod）の契約テスト
 *
 * 対象:
 *  - audit/schema.ts (auditInsertSchema, auditListItemSchema)
 *  - schedules/domain/schema.ts (ScheduleCoreSchema, ScheduleDetailSchema, ScheduleFullSchema, CreateScheduleInputSchema)
 *  - service-provision/domain/schema.ts (upsertProvisionInputSchema, recordDateISOSchema)
 *
 * 各スキーマに対して:
 *  1. 正常系データがパースできること
 *  2. 必須フィールド欠損で ZodError がスローされること
 *  3. enum フィールドに不正な値で ZodError がスローされること
 *  4. nullable/optional フィールドが null / undefined を許可すること
 *  5. エッジケース（空文字列、境界値など）
 */
import { describe, expect, it } from 'vitest';

// ── audit ───────────────────────────────────────────────────────
import {
    auditInsertSchema,
    auditListItemSchema,
} from '@/features/audit/schema';

// ── schedules ───────────────────────────────────────────────────
import {
    CreateScheduleInputSchema,
    ScheduleCategorySchema,
    ScheduleCoreSchema,
    ScheduleDetailSchema,
    ScheduleFullSchema,
    ScheduleStatusSchema,
    ScheduleVisibilitySchema,
} from '@/features/schedules/domain/schema';

// ── service-provision ───────────────────────────────────────────
import {
    recordDateISOSchema,
    upsertProvisionInputSchema,
} from '@/features/service-provision/domain/schema';


// ═══════════════════════════════════════════════════════════════
// audit/schema.ts
// ═══════════════════════════════════════════════════════════════

describe('audit/schema', () => {
  const validInsert = {
    Title: 'audit-001',
    ts: '2026-03-03T09:00:00.000Z',
    actor: 'user@example.com',
    action: 'create',
    entity: 'DailyRecord',
    entity_id: 'DR-001',
    channel: 'user' as const,
    after_json: '{"key":"value"}',
    entry_hash: 'abc123def456',
  };

  describe('auditInsertSchema', () => {
    it('parses valid audit insert data', () => {
      expect(() => auditInsertSchema.parse(validInsert)).not.toThrow();
    });

    it('accepts all valid channel values', () => {
      const channels = ['system', 'user', 'auto', 'UI', 'API', 'SPO', 'MSAL', 'System'] as const;
      for (const channel of channels) {
        expect(() => auditInsertSchema.parse({ ...validInsert, channel })).not.toThrow();
      }
    });

    it('rejects invalid channel value', () => {
      expect(() => auditInsertSchema.parse({ ...validInsert, channel: 'invalid' })).toThrow();
    });

    it('rejects empty Title', () => {
      expect(() => auditInsertSchema.parse({ ...validInsert, Title: '' })).toThrow();
    });

    it('rejects empty actor', () => {
      expect(() => auditInsertSchema.parse({ ...validInsert, actor: '' })).toThrow();
    });

    it('rejects empty action', () => {
      expect(() => auditInsertSchema.parse({ ...validInsert, action: '' })).toThrow();
    });

    it('rejects empty entry_hash', () => {
      expect(() => auditInsertSchema.parse({ ...validInsert, entry_hash: '' })).toThrow();
    });

    it('allows null entity_id', () => {
      const result = auditInsertSchema.parse({ ...validInsert, entity_id: null });
      expect(result.entity_id).toBeNull();
    });

    it('allows null after_json', () => {
      const result = auditInsertSchema.parse({ ...validInsert, after_json: null });
      expect(result.after_json).toBeNull();
    });

    it('rejects missing required fields', () => {
      expect(() => auditInsertSchema.parse({})).toThrow();
    });
  });

  describe('auditListItemSchema', () => {
    const validListItem = {
      Id: 1,
      Title: 'audit-001',
      ts: '2026-03-03T09:00:00.000Z',
      actor: 'user@example.com',
      action: 'create',
      entity: 'DailyRecord',
      entity_id: 'DR-001',
      channel: 'user',
      after_json: '{"key":"value"}',
      entry_hash: 'abc123def456',
    };

    it('parses valid audit list item', () => {
      expect(() => auditListItemSchema.parse(validListItem)).not.toThrow();
    });

    it('requires numeric Id', () => {
      expect(() => auditListItemSchema.parse({ ...validListItem, Id: 'not-number' })).toThrow();
    });

    it('allows null entity_id and after_json', () => {
      const result = auditListItemSchema.parse({
        ...validListItem,
        entity_id: null,
        after_json: null,
      });
      expect(result.entity_id).toBeNull();
      expect(result.after_json).toBeNull();
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// schedules/domain/schema.ts
// ═══════════════════════════════════════════════════════════════

describe('schedules/domain/schema', () => {
  const validCore = {
    id: 'sch-001',
    title: '朝会',
    start: '2026-03-03T09:00:00.000Z',
    end: '2026-03-03T10:00:00.000Z',
    etag: '"v1"',
  };

  describe('enum schemas', () => {
    it('ScheduleVisibilitySchema accepts valid values', () => {
      expect(ScheduleVisibilitySchema.parse('org')).toBe('org');
      expect(ScheduleVisibilitySchema.parse('team')).toBe('team');
      expect(ScheduleVisibilitySchema.parse('private')).toBe('private');
    });

    it('ScheduleVisibilitySchema rejects invalid value', () => {
      expect(() => ScheduleVisibilitySchema.parse('public')).toThrow();
    });

    it('ScheduleCategorySchema accepts valid values', () => {
      for (const cat of ['User', 'Staff', 'Org', 'LivingSupport']) {
        expect(() => ScheduleCategorySchema.parse(cat)).not.toThrow();
      }
    });

    it('ScheduleCategorySchema rejects invalid value', () => {
      expect(() => ScheduleCategorySchema.parse('unknown')).toThrow();
    });

    it('ScheduleStatusSchema accepts valid values', () => {
      for (const s of ['Planned', 'Postponed', 'Cancelled']) {
        expect(() => ScheduleStatusSchema.parse(s)).not.toThrow();
      }
    });
  });

  describe('ScheduleCoreSchema', () => {
    it('parses valid core schedule', () => {
      const result = ScheduleCoreSchema.parse(validCore);
      expect(result.id).toBe('sch-001');
      expect(result.title).toBe('朝会');
    });

    it('accepts optional category', () => {
      const result = ScheduleCoreSchema.parse({ ...validCore, category: 'User' });
      expect(result.category).toBe('User');
    });

    it('accepts optional allDay boolean', () => {
      const result = ScheduleCoreSchema.parse({ ...validCore, allDay: true });
      expect(result.allDay).toBe(true);
    });

    it('rejects missing id', () => {
      const { id: _, ...noId } = validCore;
      expect(() => ScheduleCoreSchema.parse(noId)).toThrow();
    });

    it('rejects missing etag', () => {
      const { etag: _, ...noEtag } = validCore;
      expect(() => ScheduleCoreSchema.parse(noEtag)).toThrow();
    });

    it('rejects missing title', () => {
      const { title: _, ...noTitle } = validCore;
      expect(() => ScheduleCoreSchema.parse(noTitle)).toThrow();
    });
  });

  describe('ScheduleDetailSchema', () => {
    it('parses core fields plus detail extensions', () => {
      const detail = {
        ...validCore,
        visibility: 'org',
        userId: 'U-001',
        locationName: '会議室A',
        notes: 'テスト用メモ',
        acceptedOn: null,
        acceptedBy: null,
        acceptedNote: null,
        statusReason: null,
      };
      const result = ScheduleDetailSchema.parse(detail);
      expect(result.visibility).toBe('org');
      expect(result.userId).toBe('U-001');
      expect(result.acceptedOn).toBeNull();
    });

    it('allows string or number for userLookupId', () => {
      expect(ScheduleDetailSchema.parse({ ...validCore, userLookupId: '123' }).userLookupId).toBe('123');
      expect(ScheduleDetailSchema.parse({ ...validCore, userLookupId: 123 }).userLookupId).toBe(123);
    });
  });

  describe('ScheduleFullSchema', () => {
    it('parses full schema with metadata', () => {
      const full = {
        ...validCore,
        source: 'demo',
        createdAt: '2026-03-01T08:00:00Z',
        updatedAt: '2026-03-03T09:00:00Z',
        entryHash: 'hash-123',
        ownerUserId: 'admin',
        staffNames: ['田中', '佐藤'],
      };
      const result = ScheduleFullSchema.parse(full);
      expect(result.source).toBe('demo');
      expect(result.staffNames).toEqual(['田中', '佐藤']);
    });
  });

  describe('CreateScheduleInputSchema', () => {
    const validCreate = {
      title: '新規予定',
      category: 'User' as const,
      startLocal: '2026-03-03T09:00',
      endLocal: '2026-03-03T10:00',
    };

    it('parses valid create input with minimum fields', () => {
      expect(() => CreateScheduleInputSchema.parse(validCreate)).not.toThrow();
    });

    it('rejects missing category', () => {
      const { category: _, ...noCategory } = validCreate;
      expect(() => CreateScheduleInputSchema.parse(noCategory)).toThrow();
    });

    it('rejects invalid category', () => {
      expect(() => CreateScheduleInputSchema.parse({ ...validCreate, category: 'Invalid' })).toThrow();
    });

    it('accepts all optional fields', () => {
      const full = {
        ...validCreate,
        serviceType: 'absence',
        userId: 'U-001',
        userName: '田中太郎',
        locationName: '会議室A',
        notes: 'メモ',
        status: 'Planned',
        visibility: 'org',
        acceptedOn: null,
        acceptedBy: null,
        acceptedNote: null,
      };
      const result = CreateScheduleInputSchema.parse(full);
      expect(result.serviceType).toBe('absence');
      expect(result.acceptedOn).toBeNull();
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// service-provision/domain/schema.ts
// ═══════════════════════════════════════════════════════════════

describe('service-provision/domain/schema', () => {
  describe('recordDateISOSchema', () => {
    it('accepts valid YYYY-MM-DD format', () => {
      expect(recordDateISOSchema.parse('2026-03-03')).toBe('2026-03-03');
    });

    it('rejects ISO datetime format (has time)', () => {
      expect(() => recordDateISOSchema.parse('2026-03-03T09:00:00')).toThrow();
    });

    it('rejects invalid date format', () => {
      expect(() => recordDateISOSchema.parse('03-03-2026')).toThrow();
      expect(() => recordDateISOSchema.parse('2026/03/03')).toThrow();
    });

    it('rejects empty string', () => {
      expect(() => recordDateISOSchema.parse('')).toThrow();
    });
  });

  describe('upsertProvisionInputSchema', () => {
    const validInput = {
      userCode: 'U-001',
      recordDateISO: '2026-03-03',
      status: '提供' as const,
    };

    it('parses valid minimum input', () => {
      const result = upsertProvisionInputSchema.parse(validInput);
      expect(result.userCode).toBe('U-001');
      expect(result.status).toBe('提供');
    });

    it('accepts all valid status values', () => {
      for (const status of ['提供', '欠席', 'その他'] as const) {
        expect(() => upsertProvisionInputSchema.parse({ ...validInput, status })).not.toThrow();
      }
    });

    it('rejects invalid status', () => {
      expect(() => upsertProvisionInputSchema.parse({ ...validInput, status: '未定' })).toThrow();
    });

    it('rejects empty userCode', () => {
      expect(() => upsertProvisionInputSchema.parse({ ...validInput, userCode: '' })).toThrow();
    });

    it('accepts optional boolean flags', () => {
      const full = {
        ...validInput,
        hasTransport: true,
        hasMeal: false,
        hasBath: true,
        hasExtended: false,
        hasAbsentSupport: false,
      };
      const result = upsertProvisionInputSchema.parse(full);
      expect(result.hasTransport).toBe(true);
      expect(result.hasMeal).toBe(false);
    });

    it('accepts time range as HHMM integers', () => {
      const result = upsertProvisionInputSchema.parse({
        ...validInput,
        startHHMM: 900,
        endHHMM: 1700,
      });
      expect(result.startHHMM).toBe(900);
      expect(result.endHHMM).toBe(1700);
    });

    it('accepts null for startHHMM and endHHMM', () => {
      const result = upsertProvisionInputSchema.parse({
        ...validInput,
        startHHMM: null,
        endHHMM: null,
      });
      expect(result.startHHMM).toBeNull();
    });

    it('rejects startHHMM > 2359', () => {
      expect(() => upsertProvisionInputSchema.parse({
        ...validInput,
        startHHMM: 2400,
      })).toThrow();
    });

    it('rejects negative startHHMM', () => {
      expect(() => upsertProvisionInputSchema.parse({
        ...validInput,
        startHHMM: -1,
      })).toThrow();
    });

    it('rejects non-integer startHHMM', () => {
      expect(() => upsertProvisionInputSchema.parse({
        ...validInput,
        startHHMM: 9.5,
      })).toThrow();
    });

    it('accepts note up to 2000 chars', () => {
      const longNote = 'あ'.repeat(2000);
      const result = upsertProvisionInputSchema.parse({
        ...validInput,
        note: longNote,
      });
      expect(result.note?.length).toBe(2000);
    });

    it('rejects note exceeding 2000 chars', () => {
      const tooLong = 'あ'.repeat(2001);
      expect(() => upsertProvisionInputSchema.parse({
        ...validInput,
        note: tooLong,
      })).toThrow();
    });

    it('accepts valid source values', () => {
      for (const source of ['Unified', 'Daily', 'Attendance', 'Import'] as const) {
        expect(() => upsertProvisionInputSchema.parse({ ...validInput, source })).not.toThrow();
      }
    });

    it('rejects invalid source', () => {
      expect(() => upsertProvisionInputSchema.parse({
        ...validInput,
        source: 'Manual',
      })).toThrow();
    });
  });
});

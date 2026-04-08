/**
 * Daily drift 耐性テスト
 *
 * DAILY_RECORD_CANONICAL_CANDIDATES / DAILY_RECORD_ROW_AGGREGATE_CANDIDATES が
 * resolveInternalNamesDetailed を通して正しく drift を吸収できることを確認する。
 *
 * - Canonical: SharePoint が RecordDate → cr013_date にリネームした場合でも解決できる
 * - RowAggregate: cr013_usercode / cr013_personId 等の代替名を解決できる
 * - 必須フィールドが解決済みなら areEssentialFieldsResolved が true を返す
 */
import { describe, it, expect } from 'vitest';
import { resolveInternalNamesDetailed, areEssentialFieldsResolved } from '@/lib/sp/helpers';
import {
  DAILY_RECORD_CANONICAL_CANDIDATES,
  DAILY_RECORD_CANONICAL_ESSENTIALS,
  DAILY_RECORD_ROW_AGGREGATE_CANDIDATES,
  DAILY_RECORD_ROW_AGGREGATE_ESSENTIALS,
  DAILY_ACTIVITY_RECORDS_CANDIDATES,
  DAILY_ACTIVITY_RECORDS_ESSENTIALS,
} from '../dailyFields';

// ── Canonical ────────────────────────────────────────────────────────────────

describe('DAILY_RECORD_CANONICAL_CANDIDATES drift', () => {
  it('標準名がそのまま解決される（drift なし）', () => {
    const available = new Set([
      'Id', 'Title', 'RecordDate', 'ReporterName', 'ReporterRole',
      'UserRowsJSON', 'UserCount', 'ApprovalStatus', 'ApprovedBy', 'ApprovedAt',
    ]);
    const { resolved, missing, fieldStatus } = resolveInternalNamesDetailed(
      available,
      DAILY_RECORD_CANONICAL_CANDIDATES as unknown as Record<string, string[]>,
    );

    expect(resolved.title).toBe('Title');
    expect(resolved.recordDate).toBe('RecordDate');
    expect(resolved.userRowsJSON).toBe('UserRowsJSON');
    expect(missing).toHaveLength(0);
    expect(fieldStatus.title.isDrifted).toBe(false);
    expect(fieldStatus.recordDate.isDrifted).toBe(false);
  });

  it('cr013_date が RecordDate の代替として解決される', () => {
    const available = new Set([
      'Id', 'Title', 'cr013_date', 'cr013_reporterName',
      'cr013_userRowsJSON', 'cr013_userCount',
    ]);
    const { resolved, missing } = resolveInternalNamesDetailed(
      available,
      DAILY_RECORD_CANONICAL_CANDIDATES as unknown as Record<string, string[]>,
    );

    expect(resolved.recordDate).toBe('cr013_date');
    expect(resolved.reporterName).toBe('cr013_reporterName');
    expect(resolved.userRowsJSON).toBe('cr013_userRowsJSON');
    // title='Title' は存在するため missing に含まれない
    expect(missing).not.toContain('recordDate');
    expect(missing).not.toContain('reporterName');
    expect(missing).not.toContain('userRowsJSON');
  });

  it('必須フィールド (title, recordDate, userRowsJSON) が揃えば isHealthy=true', () => {
    const available = new Set([
      'Title', 'cr013_date', 'cr013_userRowsJSON',
    ]);
    const { resolved } = resolveInternalNamesDetailed(
      available,
      DAILY_RECORD_CANONICAL_CANDIDATES as unknown as Record<string, string[]>,
    );
    const essentials = DAILY_RECORD_CANONICAL_ESSENTIALS as unknown as string[];
    expect(areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials)).toBe(true);
  });

  it('UserRowsJSON が完全に欠落していれば isHealthy=false', () => {
    const available = new Set(['Title', 'RecordDate', 'ReporterName']);
    const { resolved } = resolveInternalNamesDetailed(
      available,
      DAILY_RECORD_CANONICAL_CANDIDATES as unknown as Record<string, string[]>,
    );
    const essentials = DAILY_RECORD_CANONICAL_ESSENTIALS as unknown as string[];
    expect(areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials)).toBe(false);
  });

  it('suffixed RecordDate0 が drift として解決される', () => {
    const available = new Set(['Title', 'RecordDate0', 'UserRowsJSON']);
    const { resolved, fieldStatus } = resolveInternalNamesDetailed(
      available,
      DAILY_RECORD_CANONICAL_CANDIDATES as unknown as Record<string, string[]>,
    );

    expect(resolved.recordDate).toBe('RecordDate0');
    expect(fieldStatus.recordDate.isDrifted).toBe(true);
    // 必須は解決できているため isHealthy=true
    const essentials = DAILY_RECORD_CANONICAL_ESSENTIALS as unknown as string[];
    expect(areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials)).toBe(true);
  });
});

// ── RowAggregate ─────────────────────────────────────────────────────────────

describe('DAILY_RECORD_ROW_AGGREGATE_CANDIDATES drift', () => {
  it('標準名がそのまま解決される（drift なし）', () => {
    const available = new Set([
      'Title', 'ParentID', 'UserCode', 'RecordDate', 'Status', 'ReporterName', 'Payload', 'Kind', 'Group', 'SpecialNote',
    ]);
    const { resolved, missing } = resolveInternalNamesDetailed(
      available,
      DAILY_RECORD_ROW_AGGREGATE_CANDIDATES as unknown as Record<string, string[]>,
    );

    expect(resolved.UserID).toBe('UserCode');
    expect(resolved.recordDate).toBe('RecordDate');
    expect(missing).toHaveLength(0);
  });

  it('cr013_personId が UserID として解決される', () => {
    const available = new Set([
      'Title', 'cr013_personId', 'cr013_date',
    ]);
    const { resolved, fieldStatus } = resolveInternalNamesDetailed(
      available,
      DAILY_RECORD_ROW_AGGREGATE_CANDIDATES as unknown as Record<string, string[]>,
    );

    expect(resolved.UserID).toBe('cr013_personId');
    expect(resolved.recordDate).toBe('cr013_date');
    expect(fieldStatus.UserID.isDrifted).toBe(true);
    expect(fieldStatus.recordDate.isDrifted).toBe(true);
  });

  it('必須フィールド (userId, recordDate) が揃えば isHealthy=true', () => {
    const available = new Set(['Title', 'cr013_usercode', 'cr013_recorddate']);
    const { resolved } = resolveInternalNamesDetailed(
      available,
      DAILY_RECORD_ROW_AGGREGATE_CANDIDATES as unknown as Record<string, string[]>,
    );
    const essentials = DAILY_RECORD_ROW_AGGREGATE_ESSENTIALS as unknown as string[];
    expect(areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials)).toBe(true);
  });

  it('userId が完全に欠落していれば isHealthy=false', () => {
    const available = new Set(['Title', 'RecordDate']);
    const { resolved } = resolveInternalNamesDetailed(
      available,
      DAILY_RECORD_ROW_AGGREGATE_CANDIDATES as unknown as Record<string, string[]>,
    );
    const essentials = DAILY_RECORD_ROW_AGGREGATE_ESSENTIALS as unknown as string[];
    expect(areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials)).toBe(false);
  });
});

// ── DailyActivityRecords ─────────────────────────────────────────────────────

function resolveActivity(available: Set<string>) {
  return resolveInternalNamesDetailed(
    available,
    DAILY_ACTIVITY_RECORDS_CANDIDATES as unknown as Record<string, string[]>,
  );
}

function isActivityHealthy(resolved: Record<string, string | undefined>) {
  const essentials = DAILY_ACTIVITY_RECORDS_ESSENTIALS as unknown as string[];
  return areEssentialFieldsResolved(resolved, essentials);
}

// ── 1. 標準名 ────────────────────────────────────────────────────────────────

describe('DAILY_ACTIVITY_RECORDS_CANDIDATES — 標準名', () => {
  const available = new Set([
    'Id', 'UserCode', 'RecordDate', 'TimeSlot', 'Observation', 'version', 'duration',
  ]);

  it('必須4フィールドがすべて解決される', () => {
    const { resolved, missing } = resolveActivity(available);
    expect(resolved.userId).toBe('UserCode');
    expect(resolved.recordDate).toBe('RecordDate');
    expect(resolved.timeSlot).toBe('TimeSlot');
    expect(resolved.observation).toBe('Observation');
    expect(missing).not.toContain('userId');
    expect(missing).not.toContain('recordDate');
    expect(missing).not.toContain('timeSlot');
    expect(missing).not.toContain('observation');
  });

  it('drift フラグが false（完全一致）', () => {
    const { fieldStatus } = resolveActivity(available);
    expect(fieldStatus.userId.isDrifted).toBe(false);
    expect(fieldStatus.recordDate.isDrifted).toBe(false);
    expect(fieldStatus.timeSlot.isDrifted).toBe(false);
    expect(fieldStatus.observation.isDrifted).toBe(false);
  });

  it('isHealthy=true', () => {
    const { resolved } = resolveActivity(available);
    expect(isActivityHealthy(resolved as Record<string, string | undefined>)).toBe(true);
  });
});

// ── 2. userId の drift パターン ──────────────────────────────────────────────

describe('DAILY_ACTIVITY_RECORDS_CANDIDATES — userId drift', () => {
  it('cr013_personId が userId として解決される', () => {
    const available = new Set(['cr013_personId', 'RecordDate', 'TimeSlot', 'Observation']);
    const { resolved, fieldStatus } = resolveActivity(available);
    expect(resolved.userId).toBe('cr013_personId');
    expect(fieldStatus.userId.isDrifted).toBe(true);
  });

  it('UserId が userId として解決される', () => {
    const available = new Set(['UserId', 'RecordDate', 'TimeSlot', 'Observation']);
    const { resolved } = resolveActivity(available);
    expect(resolved.userId).toBe('UserId');
  });

  it('UserID が userId として解決される', () => {
    const available = new Set(['UserID', 'RecordDate', 'TimeSlot', 'Observation']);
    const { resolved } = resolveActivity(available);
    expect(resolved.userId).toBe('UserID');
  });
});

// ── 3. recordDate の drift パターン ─────────────────────────────────────────

describe('DAILY_ACTIVITY_RECORDS_CANDIDATES — recordDate drift', () => {
  it('cr013_date が recordDate として解決される', () => {
    const available = new Set(['UserCode', 'cr013_date', 'TimeSlot', 'Observation']);
    const { resolved, fieldStatus } = resolveActivity(available);
    expect(resolved.recordDate).toBe('cr013_date');
    expect(fieldStatus.recordDate.isDrifted).toBe(true);
  });

  it('Date が recordDate として解決される', () => {
    const available = new Set(['UserCode', 'Date', 'TimeSlot', 'Observation']);
    const { resolved } = resolveActivity(available);
    expect(resolved.recordDate).toBe('Date');
  });

  it('cr013_recorddate が recordDate として解決される', () => {
    const available = new Set(['UserCode', 'cr013_recorddate', 'TimeSlot', 'Observation']);
    const { resolved } = resolveActivity(available);
    expect(resolved.recordDate).toBe('cr013_recorddate');
  });
});

// ── 4. observation の drift パターン ────────────────────────────────────────

describe('DAILY_ACTIVITY_RECORDS_CANDIDATES — observation drift', () => {
  it('Notes が observation として解決される（drift）', () => {
    const available = new Set(['UserCode', 'RecordDate', 'TimeSlot', 'Notes']);
    const { resolved, fieldStatus } = resolveActivity(available);
    expect(resolved.observation).toBe('Notes');
    expect(fieldStatus.observation.isDrifted).toBe(true);
    expect(isActivityHealthy(resolved as Record<string, string | undefined>)).toBe(true);
  });

  it('cr013_observation が observation として解決される', () => {
    const available = new Set(['UserCode', 'RecordDate', 'TimeSlot', 'cr013_observation']);
    const { resolved } = resolveActivity(available);
    expect(resolved.observation).toBe('cr013_observation');
  });
});

// ── 5. FAIL/WARN 境界 ────────────────────────────────────────────────────────

describe('DAILY_ACTIVITY_RECORDS_ESSENTIALS FAIL/WARN 境界', () => {
  it('必須4点のみでも isHealthy=true（最小構成）', () => {
    const available = new Set(['UserCode', 'RecordDate', 'TimeSlot', 'Observation']);
    const { resolved } = resolveActivity(available);
    expect(isActivityHealthy(resolved as Record<string, string | undefined>)).toBe(true);
  });

  it('userId が完全欠落すれば isHealthy=false（FAIL）', () => {
    const available = new Set(['RecordDate', 'TimeSlot', 'Observation']);
    const { resolved } = resolveActivity(available);
    expect(isActivityHealthy(resolved as Record<string, string | undefined>)).toBe(false);
  });

  it('recordDate が完全欠落すれば isHealthy=false（FAIL）', () => {
    const available = new Set(['UserCode', 'TimeSlot', 'Observation']);
    const { resolved } = resolveActivity(available);
    expect(isActivityHealthy(resolved as Record<string, string | undefined>)).toBe(false);
  });

  it('timeSlot が完全欠落すれば isHealthy=false（FAIL）', () => {
    const available = new Set(['UserCode', 'RecordDate', 'Observation']);
    const { resolved } = resolveActivity(available);
    expect(isActivityHealthy(resolved as Record<string, string | undefined>)).toBe(false);
  });

  it('observation が完全欠落すれば isHealthy=false（FAIL）', () => {
    const available = new Set(['UserCode', 'RecordDate', 'TimeSlot']);
    const { resolved } = resolveActivity(available);
    expect(isActivityHealthy(resolved as Record<string, string | undefined>)).toBe(false);
  });

  it('behavior / duration / order 欠落でも isHealthy=true（WARN 水準・optional）', () => {
    const available = new Set(['UserCode', 'RecordDate', 'TimeSlot', 'Observation']);
    const { resolved, missing } = resolveActivity(available);
    expect(isActivityHealthy(resolved as Record<string, string | undefined>)).toBe(true);
    expect(missing).toContain('behavior');
    expect(missing).toContain('duration');
    expect(missing).toContain('order');
  });

  it('drift 経由4点でも isHealthy=true', () => {
    const available = new Set(['cr013_personId', 'cr013_date', 'TimeSlot', 'Notes']);
    const { resolved } = resolveActivity(available);
    expect(isActivityHealthy(resolved as Record<string, string | undefined>)).toBe(true);
  });

  it('unresolved フィールドは missing に残る（silent drop しない）', () => {
    const available = new Set(['SomeUnknownFieldOnly']);
    const { missing } = resolveActivity(available);
    expect(missing).toContain('userId');
    expect(missing).toContain('recordDate');
    expect(missing).toContain('timeSlot');
    expect(missing).toContain('observation');
    expect(missing).toContain('behavior');
  });
});

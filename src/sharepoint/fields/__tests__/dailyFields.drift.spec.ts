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
      'Title', 'UserCode', 'RecordDate', 'Status', 'ReporterName', 'Payload', 'Kind', 'Group', 'SpecialNote',
    ]);
    const { resolved, missing } = resolveInternalNamesDetailed(
      available,
      DAILY_RECORD_ROW_AGGREGATE_CANDIDATES as unknown as Record<string, string[]>,
    );

    expect(resolved.userId).toBe('UserCode');
    expect(resolved.recordDate).toBe('RecordDate');
    expect(missing).toHaveLength(0);
  });

  it('cr013_personId が userId として解決される', () => {
    const available = new Set([
      'Title', 'cr013_personId', 'cr013_date',
    ]);
    const { resolved, fieldStatus } = resolveInternalNamesDetailed(
      available,
      DAILY_RECORD_ROW_AGGREGATE_CANDIDATES as unknown as Record<string, string[]>,
    );

    expect(resolved.userId).toBe('cr013_personId');
    expect(resolved.recordDate).toBe('cr013_date');
    expect(fieldStatus.userId.isDrifted).toBe(true);
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

describe('DAILY_ACTIVITY_RECORDS_CANDIDATES drift', () => {
  const cands = DAILY_ACTIVITY_RECORDS_CANDIDATES as unknown as Record<string, string[]>;

  it('標準名 (UserCode, RecordDate, TimeSlot, Observation) が解決される', () => {
    const available = new Set([
      'Id', 'UserCode', 'RecordDate', 'TimeSlot', 'Observation', 'version', 'duration',
    ]);
    const { resolved } = resolveInternalNamesDetailed(available, cands);
    
    expect(resolved.userId).toBe('UserCode');
    expect(resolved.recordDate).toBe('RecordDate');
    expect(resolved.timeSlot).toBe('TimeSlot');
    expect(resolved.observation).toBe('Observation');
  });

  it('cr013_personId / cr013_date が代替名として解決される (drift)', () => {
    const available = new Set(['cr013_personId', 'cr013_date', 'TimeSlot', 'Observation']);
    const { resolved, fieldStatus } = resolveInternalNamesDetailed(available, cands);
    
    expect(resolved.userId).toBe('cr013_personId');
    expect(fieldStatus.userId.isDrifted).toBe(true);
    
    expect(resolved.recordDate).toBe('cr013_date');
    expect(fieldStatus.recordDate.isDrifted).toBe(true);
  });

  it('必須チェック（userId, recordDate, timeSlot, observation）が機能する', () => {
    const available = new Set(['UserCode', 'RecordDate', 'TimeSlot', 'Observation']);
    const { resolved } = resolveInternalNamesDetailed(available, cands);
    const essentials = DAILY_ACTIVITY_RECORDS_ESSENTIALS as unknown as string[];
    
    expect(areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials)).toBe(true);
  });

  it('Observation が欠落し Notes がある場合に代替解決される (WARN)', () => {
    const available = new Set(['UserCode', 'RecordDate', 'TimeSlot', 'Notes']);
    const { resolved, fieldStatus } = resolveInternalNamesDetailed(available, cands);
    
    expect(resolved.observation).toBe('Notes');
    expect(fieldStatus.observation.isDrifted).toBe(true); // Candidates 配列の 2 番目以降なので drift 扱い
  });

  it('必須の TimeSlot が欠落している場合に FAIL 判定', () => {
    const available = new Set(['UserCode', 'RecordDate', 'Observation']);
    const { resolved } = resolveInternalNamesDetailed(available, cands);
    const essentials = DAILY_ACTIVITY_RECORDS_ESSENTIALS as unknown as string[];
    
    expect(areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials)).toBe(false);
  });
});

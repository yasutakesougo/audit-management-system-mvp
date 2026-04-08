/**
 * Schedule Events drift 耐性テスト
 *
 * SCHEDULE_EVENTS_CANDIDATES が resolveInternalNamesDetailed を通して
 * 各種 drift シナリオを正しく吸収できることを確認する。
 *
 * シナリオ:
 *  1. 標準名 (Title, EventDate, EndDate) が解決される
 *  2. start が StartDate / Start に drift した場合を吸収
 *  3. end が EndDateTime / Finish に drift した場合を吸収
 *  4. userId が TargetUser / UserCode / UserId に drift した場合を吸収
 *  5. cr014_ / cr013_ プレフィックス付き列名 (status, rowKey) を drift として解決
 *  6. 必須3フィールド (title/start/end) が揃えば isHealthy=true
 *  7. 必須フィールド欠落で isHealthy=false（各ケース）
 *  8. optional フィールド欠落でも isHealthy=true（WARN 水準）
 *  9. unresolved キーが missing として検知される（silent drop しない）
 */
import { describe, it, expect } from 'vitest';
import { resolveInternalNamesDetailed, areEssentialFieldsResolved } from '@/lib/sp/helpers';
import {
  SCHEDULE_EVENTS_CANDIDATES,
  SCHEDULE_EVENTS_ESSENTIALS,
} from '../scheduleFields';

function resolve(available: Set<string>) {
  return resolveInternalNamesDetailed(
    available,
    SCHEDULE_EVENTS_CANDIDATES as unknown as Record<string, string[]>,
  );
}

function isHealthy(resolved: Record<string, string | undefined>) {
  const essentials = SCHEDULE_EVENTS_ESSENTIALS as unknown as string[];
  return areEssentialFieldsResolved(resolved, essentials);
}

// ── 1. 標準名 ────────────────────────────────────────────────────────────────

describe('SCHEDULE_EVENTS_CANDIDATES — 標準名', () => {
  const available = new Set([
    'Id', 'Title', 'EventDate', 'EndDate',
    'Status', 'ServiceType', 'TargetUserId', 'AssignedStaffId',
    'RowKey', 'Note',
  ]);

  it('必須3フィールドがすべて解決される', () => {
    const { resolved, missing } = resolve(available);
    expect(resolved.title).toBe('Title');
    expect(resolved.start).toBe('EventDate');
    expect(resolved.end).toBe('EndDate');
    expect(missing).not.toContain('title');
    expect(missing).not.toContain('start');
    expect(missing).not.toContain('end');
  });

  it('drift フラグが false（完全一致）', () => {
    const { fieldStatus } = resolve(available);
    expect(fieldStatus.title.isDrifted).toBe(false);
    expect(fieldStatus.start.isDrifted).toBe(false);
    expect(fieldStatus.end.isDrifted).toBe(false);
  });

  it('isHealthy=true', () => {
    const { resolved } = resolve(available);
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(true);
  });
});

// ── 2. start の drift パターン ───────────────────────────────────────────────

describe('SCHEDULE_EVENTS_CANDIDATES — start drift', () => {
  it('StartDate が start として解決される', () => {
    const available = new Set(['Title', 'StartDate', 'EndDate']);
    const { resolved, fieldStatus } = resolve(available);
    expect(resolved.start).toBe('StartDate');
    expect(fieldStatus.start.isDrifted).toBe(true);
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(true);
  });

  it('Start が start として解決される', () => {
    const available = new Set(['Title', 'Start', 'EndDate']);
    const { resolved } = resolve(available);
    expect(resolved.start).toBe('Start');
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(true);
  });

  it('StartTime が start として解決される', () => {
    const available = new Set(['Title', 'StartTime', 'EndDate']);
    const { resolved } = resolve(available);
    expect(resolved.start).toBe('StartTime');
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(true);
  });
});

// ── 3. end の drift パターン ─────────────────────────────────────────────────

describe('SCHEDULE_EVENTS_CANDIDATES — end drift', () => {
  it('EndDateTime が end として解決される', () => {
    const available = new Set(['Title', 'EventDate', 'EndDateTime']);
    const { resolved, fieldStatus } = resolve(available);
    expect(resolved.end).toBe('EndDateTime');
    expect(fieldStatus.end.isDrifted).toBe(true);
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(true);
  });

  it('Finish が end として解決される', () => {
    const available = new Set(['Title', 'EventDate', 'Finish']);
    const { resolved } = resolve(available);
    expect(resolved.end).toBe('Finish');
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(true);
  });

  it('EndTime が end として解決される', () => {
    const available = new Set(['Title', 'EventDate', 'EndTime']);
    const { resolved } = resolve(available);
    expect(resolved.end).toBe('EndTime');
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(true);
  });
});

// ── 4. userId の drift パターン ──────────────────────────────────────────────

describe('SCHEDULE_EVENTS_CANDIDATES — userId drift', () => {
  it('TargetUser が userId として解決される', () => {
    const available = new Set(['Title', 'EventDate', 'EndDate', 'TargetUser']);
    const { resolved } = resolve(available);
    expect(resolved.userId).toBe('TargetUser');
  });

  it('UserCode が userId として解決される', () => {
    const available = new Set(['Title', 'EventDate', 'EndDate', 'UserCode']);
    const { resolved } = resolve(available);
    expect(resolved.userId).toBe('UserCode');
  });

  it('UserId が userId として解決される', () => {
    const available = new Set(['Title', 'EventDate', 'EndDate', 'UserId']);
    const { resolved } = resolve(available);
    expect(resolved.userId).toBe('UserId');
  });
});

// ── 5. cr014_ / cr013_ プレフィックス drift ──────────────────────────────────

describe('SCHEDULE_EVENTS_CANDIDATES — cr prefix drift', () => {
  it('cr014_status が status として解決される', () => {
    const available = new Set(['Title', 'EventDate', 'EndDate', 'cr014_status']);
    const { resolved, fieldStatus } = resolve(available);
    expect(resolved.status).toBe('cr014_status');
    expect(fieldStatus.status.isDrifted).toBe(true);
  });

  it('cr014_rowKey が rowKey として解決される（isDrifted=true: 先頭候補は RowKey）', () => {
    const available = new Set(['Title', 'EventDate', 'EndDate', 'cr014_rowKey']);
    const { resolved, fieldStatus } = resolve(available);
    expect(resolved.rowKey).toBe('cr014_rowKey');
    expect(fieldStatus.rowKey.isDrifted).toBe(true);
  });

  it('cr013_usercode が userId として解決される', () => {
    const available = new Set(['Title', 'EventDate', 'EndDate', 'cr013_usercode']);
    const { resolved } = resolve(available);
    expect(resolved.userId).toBe('cr013_usercode');
  });
});

// ── 6 & 7. FAIL/WARN 境界 ────────────────────────────────────────────────────

describe('SCHEDULE_EVENTS_ESSENTIALS FAIL/WARN 境界', () => {
  it('必須3点のみでも isHealthy=true（最小構成）', () => {
    const available = new Set(['Title', 'EventDate', 'EndDate']);
    const { resolved } = resolve(available);
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(true);
  });

  it('title が完全欠落すれば isHealthy=false（FAIL）', () => {
    const available = new Set(['EventDate', 'EndDate']);
    const { resolved } = resolve(available);
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(false);
  });

  it('start が完全欠落すれば isHealthy=false（FAIL）', () => {
    const available = new Set(['Title', 'EndDate']);
    const { resolved } = resolve(available);
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(false);
  });

  it('end が完全欠落すれば isHealthy=false（FAIL）', () => {
    const available = new Set(['Title', 'EventDate']);
    const { resolved } = resolve(available);
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(false);
  });

  it('userId / status 欠落でも isHealthy=true（WARN 水準・optional）', () => {
    const available = new Set(['Title', 'EventDate', 'EndDate']);
    const { resolved, missing } = resolve(available);
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(true);
    expect(missing).toContain('userId');
    expect(missing).toContain('status');
  });

  it('rowKey / notes 欠落でも isHealthy=true（WARN 水準・optional）', () => {
    const available = new Set(['Title', 'EventDate', 'EndDate']);
    const { resolved } = resolve(available);
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(true);
  });

  it('start / end が drift 経由でも isHealthy=true', () => {
    const available = new Set(['Title', 'StartDate', 'EndDateTime']);
    const { resolved } = resolve(available);
    expect(isHealthy(resolved as Record<string, string | undefined>)).toBe(true);
  });

  it('unresolved フィールドは missing に残る（silent drop しない）', () => {
    const available = new Set(['SomeUnknownFieldOnly']);
    const { missing } = resolve(available);
    expect(missing).toContain('title');
    expect(missing).toContain('start');
    expect(missing).toContain('end');
    expect(missing).toContain('userId');
    expect(missing).toContain('rowKey');
  });
});

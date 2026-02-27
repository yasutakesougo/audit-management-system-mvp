import { describe, expect, it } from 'vitest';

import {
  buildDailyUserSnapshot,
  detectCrossModuleIssues,
} from '@/features/cross-module/dailyUserSnapshot';
import type {
  DailyUserSnapshot,
  DailyUserSnapshotInput,
  ServiceProvisionSummary,
} from '@/features/cross-module/types';
import {
  toProvisionSummary,
  EMPTY_PROVISION_SUMMARY,
} from '@/features/cross-module/serviceProvisionSnapshot';
import type { ServiceProvisionRecord } from '@/features/service-provision/domain/types';

// ─── toProvisionSummary ──────────────────────────────────────

describe('toProvisionSummary', () => {
  const baseRecord: ServiceProvisionRecord = {
    id: 1,
    entryKey: 'I022|2026-02-27',
    userCode: 'I022',
    recordDateISO: '2026-02-27',
    status: '提供',
    startHHMM: 930,
    endHHMM: 1530,
    hasTransport: true,
    hasMeal: true,
    hasBath: false,
    hasExtended: false,
    hasAbsentSupport: false,
    note: 'テストメモです。これは50文字を超える長いメモで、プレビューでは切り捨てられるべきです。',
    source: 'Unified',
  };

  it('レコードからサマリを正しく変換', () => {
    const summary = toProvisionSummary(baseRecord);

    expect(summary.hasRecord).toBe(true);
    expect(summary.status).toBe('提供');
    expect(summary.startHHMM).toBe(930);
    expect(summary.endHHMM).toBe(1530);
    expect(summary.additions?.transport).toBe(true);
    expect(summary.additions?.meal).toBe(true);
    expect(summary.additions?.bath).toBe(false);
  });

  it('メモプレビューは50文字で切り捨て', () => {
    const summary = toProvisionSummary(baseRecord);

    expect(summary.notePreview).toBeDefined();
    expect(summary.notePreview!.length).toBeLessThanOrEqual(50);
  });

  it('メモが空ならプレビューはundefined', () => {
    const summary = toProvisionSummary({ ...baseRecord, note: '' });
    expect(summary.notePreview).toBeUndefined();
  });
});

describe('EMPTY_PROVISION_SUMMARY', () => {
  it('hasRecord が false', () => {
    expect(EMPTY_PROVISION_SUMMARY.hasRecord).toBe(false);
  });
});

// ─── detectCrossModuleIssues: ServiceProvision ルール ─────────

describe('detectCrossModuleIssues — ServiceProvision rules', () => {
  const base: DailyUserSnapshot = {
    userId: 'I022',
    userName: 'テスト太郎',
    date: '2026-02-27',
  };

  // ── Rule 5: 欠席なのに提供実績が「提供」 ──────────────────

  it('欠席 + 提供実績「提供」→ error (absence-provision-provided)', () => {
    const snapshot: DailyUserSnapshot = {
      ...base,
      attendanceStatus: '当日欠席',
      serviceProvision: {
        hasRecord: true,
        status: '提供',
      },
    };

    const issues = detectCrossModuleIssues(snapshot);
    const found = issues.find((i) => i.id === 'absence-provision-provided');

    expect(found).toBeDefined();
    expect(found!.severity).toBe('error');
    expect(found!.type).toBe('attendance_provision_mismatch');
    expect(found!.involvedModules).toContain('attendance');
    expect(found!.involvedModules).toContain('provision');
  });

  it('欠席 + 提供実績「欠席」→ エラーなし（整合）', () => {
    const snapshot: DailyUserSnapshot = {
      ...base,
      attendanceStatus: '当日欠席',
      serviceProvision: {
        hasRecord: true,
        status: '欠席',
      },
    };

    const issues = detectCrossModuleIssues(snapshot);
    const found = issues.find((i) => i.id === 'absence-provision-provided');
    expect(found).toBeUndefined();
  });

  // ── Rule 6: 通所中/退所済なのに提供実績未入力 ─────────────

  it('退所済 + 提供実績なし → warning (attended-no-provision-record)', () => {
    const snapshot: DailyUserSnapshot = {
      ...base,
      attendanceStatus: '退所済',
      // serviceProvision は未設定
    };

    const issues = detectCrossModuleIssues(snapshot);
    const found = issues.find((i) => i.id === 'attended-no-provision-record');

    expect(found).toBeDefined();
    expect(found!.severity).toBe('warning');
    expect(found!.type).toBe('attendance_provision_mismatch');
  });

  it('通所中 + 提供実績なし → warning', () => {
    const snapshot: DailyUserSnapshot = {
      ...base,
      attendanceStatus: '通所中',
      serviceProvision: undefined,
    };

    const issues = detectCrossModuleIssues(snapshot);
    const found = issues.find((i) => i.id === 'attended-no-provision-record');
    expect(found).toBeDefined();
  });

  it('退所済 + 提供実績あり → warningなし（整合）', () => {
    const snapshot: DailyUserSnapshot = {
      ...base,
      attendanceStatus: '退所済',
      serviceProvision: {
        hasRecord: true,
        status: '提供',
      },
    };

    const issues = detectCrossModuleIssues(snapshot);
    const found = issues.find((i) => i.id === 'attended-no-provision-record');
    expect(found).toBeUndefined();
  });

  it('未確認（欠席でも通所でもない）→ provision関連ルールは発火しない', () => {
    const snapshot: DailyUserSnapshot = {
      ...base,
      attendanceStatus: '未確認',
    };

    const issues = detectCrossModuleIssues(snapshot);
    const provisionIssues = issues.filter((i) =>
      i.type === 'attendance_provision_mismatch',
    );
    expect(provisionIssues).toHaveLength(0);
  });
});

// ─── buildDailyUserSnapshot: ServiceProvision 合流 ───────────

describe('buildDailyUserSnapshot — ServiceProvision integration', () => {
  it('serviceProvisionData が渡されたらスナップショットに反映', () => {
    const input: DailyUserSnapshotInput = {
      userId: 'I022',
      userName: 'テスト太郎',
      date: '2026-02-27',
      serviceProvisionData: {
        hasRecord: true,
        status: '提供',
        startHHMM: 930,
        endHHMM: 1530,
      },
    };

    const snapshot = buildDailyUserSnapshot(input);

    expect(snapshot.serviceProvision).toBeDefined();
    expect(snapshot.serviceProvision!.hasRecord).toBe(true);
    expect(snapshot.serviceProvision!.status).toBe('提供');
    expect(snapshot.serviceProvision!.startHHMM).toBe(930);
  });

  it('serviceProvisionData が未設定ならスナップショットにも反映されない', () => {
    const input: DailyUserSnapshotInput = {
      userId: 'I022',
      userName: 'テスト太郎',
      date: '2026-02-27',
    };

    const snapshot = buildDailyUserSnapshot(input);
    expect(snapshot.serviceProvision).toBeUndefined();
  });

  it('欠席 + 提供「提供」のフル統合テスト → error issue が生成される', () => {
    const input: DailyUserSnapshotInput = {
      userId: 'I022',
      userName: 'テスト太郎',
      date: '2026-02-27',
      attendanceData: {
        status: '当日欠席',
      },
      serviceProvisionData: {
        hasRecord: true,
        status: '提供',
      },
    };

    const snapshot = buildDailyUserSnapshot(input);
    const errorIssues = snapshot.crossModuleIssues?.filter(
      (i) => i.severity === 'error',
    );

    expect(errorIssues).toBeDefined();
    expect(errorIssues!.length).toBeGreaterThanOrEqual(1);
    expect(
      errorIssues!.some((i) => i.id === 'absence-provision-provided'),
    ).toBe(true);
  });
});

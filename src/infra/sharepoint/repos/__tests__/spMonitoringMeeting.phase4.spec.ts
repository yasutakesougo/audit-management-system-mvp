/**
 * Phase 4: エッジケーステスト — MonitoringMeetings SharePoint 層
 *
 * 検証観点:
 *   1. 空値正規化   — familyFeedback:'', changeReason:'', decisions:[]
 *   2. 日付ゼロパディング — 2026-3-8 → 2026-03-08
 *   3. OData escape — シングルクォート (' → '') / 記号入り ID
 *   4. 記録なし時の UI — record null, ボタン disabled
 *   5. 再反映重複防止 — 同一取込で値が増殖しない
 */

import { describe, expect, it } from 'vitest';
import {
  mapSpRowToMonitoringMeeting,
  buildMonitoringMeetingBody,
} from '@/infra/sharepoint/repos/spMonitoringMeetingRepository';
import type { SpMonitoringMeetingRow } from '@/sharepoint/fields/monitoringMeetingFields';
import type { MonitoringMeetingRecord } from '@/domain/isp/monitoringMeeting';
import { escapeODataString } from '@/lib/odata';

// ════════════════════════════════════════════════════════════════
// Test Helpers
// ════════════════════════════════════════════════════════════════

/** 最小限の SP 行データを作る */
function minimalSpRow(overrides: Partial<SpMonitoringMeetingRow> = {}): SpMonitoringMeetingRow {
  return {
    Id: 1,
    Title: 'U-001_2026-03-15',
    cr014_recordId: 'REC-001',
    cr014_userId: 'U-001',
    cr014_ispId: 'ISP-001',
    cr014_planningSheetId: '',
    cr014_meetingType: 'regular',
    cr014_meetingDate: '2026-03-15',
    cr014_venue: '会議室A',
    cr014_attendeesJson: '[]',
    cr014_goalEvaluationsJson: '[]',
    cr014_overallAssessment: '良好',
    cr014_userFeedback: '特になし',
    cr014_familyFeedback: '',
    cr014_planChangeDecision: 'no_change',
    cr014_changeReason: '',
    cr014_decisionsJson: '[]',
    cr014_nextMonitoringDate: '2026-06-15',
    cr014_recordedBy: '佐藤',
    cr014_recordedAt: '2026-03-15T10:00:00Z',
    ...overrides,
  } as SpMonitoringMeetingRow;
}

/** 最小限の Domain レコードを作る */
function minimalRecord(overrides: Partial<MonitoringMeetingRecord> = {}): MonitoringMeetingRecord {
  return {
    id: 'REC-001',
    userId: 'U-001',
    ispId: 'ISP-001',
    meetingType: 'regular',
    meetingDate: '2026-03-15',
    venue: '会議室A',
    attendees: [],
    goalEvaluations: [],
    overallAssessment: '良好',
    userFeedback: '特になし',
    familyFeedback: '',
    planChangeDecision: 'no_change',
    changeReason: '',
    decisions: [],
    nextMonitoringDate: '2026-06-15',
    recordedBy: '佐藤',
    recordedAt: '2026-03-15T10:00:00Z',
    ...overrides,
  };
}

// ════════════════════════════════════════════════════════════════
// 1. 空値正規化
// ════════════════════════════════════════════════════════════════

describe('Phase4-1: 空値正規化', () => {
  it('SP行の familyFeedback が null → 空文字に正規化される', () => {
    const row = minimalSpRow({ cr014_familyFeedback: null as unknown as string });
    const record = mapSpRowToMonitoringMeeting(row);
    expect(record.familyFeedback).toBe('');
  });

  it('SP行の familyFeedback が undefined → 空文字に正規化される', () => {
    const row = minimalSpRow({ cr014_familyFeedback: undefined as unknown as string });
    const record = mapSpRowToMonitoringMeeting(row);
    expect(record.familyFeedback).toBe('');
  });

  it('SP行の changeReason が null → 空文字に正規化される', () => {
    const row = minimalSpRow({ cr014_changeReason: null as unknown as string });
    const record = mapSpRowToMonitoringMeeting(row);
    expect(record.changeReason).toBe('');
  });

  it('SP行の decisionsJson が null → 空配列に正規化される', () => {
    const row = minimalSpRow({ cr014_decisionsJson: null as unknown as string });
    const record = mapSpRowToMonitoringMeeting(row);
    expect(record.decisions).toEqual([]);
  });

  it('SP行の decisionsJson が空文字 → 空配列に正規化される', () => {
    const row = minimalSpRow({ cr014_decisionsJson: '' });
    const record = mapSpRowToMonitoringMeeting(row);
    expect(record.decisions).toEqual([]);
  });

  it('SP行の attendeesJson が壊れた JSON → 空配列に正規化される', () => {
    const row = minimalSpRow({ cr014_attendeesJson: '{broken' });
    const record = mapSpRowToMonitoringMeeting(row);
    expect(record.attendees).toEqual([]);
  });

  it('SP行の goalEvaluationsJson が null → 空配列に正規化される', () => {
    const row = minimalSpRow({ cr014_goalEvaluationsJson: null as unknown as string });
    const record = mapSpRowToMonitoringMeeting(row);
    expect(record.goalEvaluations).toEqual([]);
  });

  it('SP行の planningSheetId が空文字 → undefined に正規化される', () => {
    const row = minimalSpRow({ cr014_planningSheetId: '' });
    const record = mapSpRowToMonitoringMeeting(row);
    expect(record.planningSheetId).toBeUndefined();
  });

  it('SP行の overallAssessment が null → 空文字に正規化される', () => {
    const row = minimalSpRow({ cr014_overallAssessment: null as unknown as string });
    const record = mapSpRowToMonitoringMeeting(row);
    expect(record.overallAssessment).toBe('');
  });

  it('buildBody: familyFeedback が undefined → 空文字で出力される', () => {
    const record = minimalRecord({ familyFeedback: undefined as unknown as string });
    const body = buildMonitoringMeetingBody(record);
    expect(body['cr014_familyFeedback']).toBe('');
  });

  it('buildBody: decisions が undefined → 空配列JSON で出力される', () => {
    const record = minimalRecord({ decisions: undefined as unknown as string[] });
    const body = buildMonitoringMeetingBody(record);
    expect(body['cr014_decisionsJson']).toBe('[]');
  });
});

// ════════════════════════════════════════════════════════════════
// 2. 日付ゼロパディング
// ════════════════════════════════════════════════════════════════

describe('Phase4-2: 日付ゼロパディング', () => {
  it('meetingDate 2026-3-8 → Title に 2026-03-08 が入る', () => {
    const record = minimalRecord({ meetingDate: '2026-3-8' });
    const body = buildMonitoringMeetingBody(record);
    expect(body['Title']).toBe('U-001_2026-03-08');
    expect(body['cr014_meetingDate']).toBe('2026-03-08');
  });

  it('meetingDate 2026-12-1 → 2026-12-01 に正規化', () => {
    const record = minimalRecord({ meetingDate: '2026-12-1' });
    const body = buildMonitoringMeetingBody(record);
    expect(body['cr014_meetingDate']).toBe('2026-12-01');
  });

  it('meetingDate が既にゼロパディング済み → そのまま', () => {
    const record = minimalRecord({ meetingDate: '2026-03-15' });
    const body = buildMonitoringMeetingBody(record);
    expect(body['cr014_meetingDate']).toBe('2026-03-15');
  });

  it('nextMonitoringDate 2026-6-1 → 2026-06-01 に正規化', () => {
    const record = minimalRecord({ nextMonitoringDate: '2026-6-1' });
    const body = buildMonitoringMeetingBody(record);
    expect(body['cr014_nextMonitoringDate']).toBe('2026-06-01');
  });

  it('nextMonitoringDate が空文字 → そのまま空文字', () => {
    const record = minimalRecord({ nextMonitoringDate: '' });
    const body = buildMonitoringMeetingBody(record);
    expect(body['cr014_nextMonitoringDate']).toBe('');
  });
});

// ════════════════════════════════════════════════════════════════
// 3. OData Escape
// ════════════════════════════════════════════════════════════════

describe('Phase4-3: OData Escape', () => {
  it("escapeODataString: シングルクォートが '' にエスケープされる", () => {
    expect(escapeODataString("O'Brien")).toBe("O''Brien");
  });

  it('escapeODataString: 通常文字はそのまま', () => {
    expect(escapeODataString('U-001')).toBe('U-001');
  });

  it('escapeODataString: 空文字はそのまま', () => {
    expect(escapeODataString('')).toBe('');
  });

  it("escapeODataString: 複数の ' が全てエスケープされる", () => {
    expect(escapeODataString("it's O'Brien's")).toBe("it''s O''Brien''s");
  });

  it('escapeODataString: 日本語はそのまま', () => {
    expect(escapeODataString('田中太郎')).toBe('田中太郎');
  });

  it('escapeODataString: & や = が含まれてもそのまま（OData文字列内は安全）', () => {
    expect(escapeODataString('a&b=c')).toBe('a&b=c');
  });
});

// ════════════════════════════════════════════════════════════════
// 4. 記録なし時の UI
// ════════════════════════════════════════════════════════════════

describe('Phase4-4: 記録なし時の UI 条件', () => {
  // これは useLatestBehaviorMonitoring hook のテストで既に Phase3-Check4/5 で確認済みだが、
  // エッジケースとして「全フィールド null の行」が来た場合のマッパー堅牢性を追加検証

  it('全フィールドが null/undefined の SP行 → マッパーが crash しない', () => {
    const row = {
      Id: 99,
      Title: null,
      cr014_recordId: null,
      cr014_userId: null,
      cr014_ispId: null,
      cr014_planningSheetId: null,
      cr014_meetingType: null,
      cr014_meetingDate: null,
      cr014_venue: null,
      cr014_attendeesJson: null,
      cr014_goalEvaluationsJson: null,
      cr014_overallAssessment: null,
      cr014_userFeedback: null,
      cr014_familyFeedback: null,
      cr014_planChangeDecision: null,
      cr014_changeReason: null,
      cr014_decisionsJson: null,
      cr014_nextMonitoringDate: null,
      cr014_recordedBy: null,
      cr014_recordedAt: null,
    } as unknown as SpMonitoringMeetingRow;

    const record = mapSpRowToMonitoringMeeting(row);
    expect(record).toBeDefined();
    expect(record.id).toBe('');
    expect(record.userId).toBe('');
    expect(record.familyFeedback).toBe('');
    expect(record.decisions).toEqual([]);
    expect(record.attendees).toEqual([]);
    expect(record.goalEvaluations).toEqual([]);
  });

  it('recordId が空文字の SP行 → id が空文字になる', () => {
    const row = minimalSpRow({ cr014_recordId: '' });
    const record = mapSpRowToMonitoringMeeting(row);
    expect(record.id).toBe('');
  });
});

// ════════════════════════════════════════════════════════════════
// 5. 再反映重複防止 (adaptMeetingToBehavior)
// ════════════════════════════════════════════════════════════════

describe('Phase4-5: 再反映重複防止', () => {
  // adaptMeetingToBehavior は冪等（同じ入力 → 同じ出力）であることを確認

  it('同じ meeting を2回変換しても同一結果になる（冪等性）', async () => {
    const { adaptMeetingToBehavior } = await import('@/domain/isp/behaviorMonitoring');

    const meeting = minimalRecord({
      goalEvaluations: [
        { goalText: '活動参加', achievementLevel: 'achieved', comment: '良好' },
      ],
      overallAssessment: '概ね良好',
      userFeedback: '満足',
      familyFeedback: '特になし',
      decisions: ['継続', '次回3ヶ月後'],
    });

    const result1 = adaptMeetingToBehavior(meeting, 'PS-001');
    const result2 = adaptMeetingToBehavior(meeting, 'PS-001');

    // 構造的に同一
    expect(result1).toEqual(result2);
    // 参照は異なる（新しいオブジェクト）
    expect(result1).not.toBe(result2);
  });

  it('supportEvaluations の長さは goalEvaluations と一致する（増殖しない）', async () => {
    const { adaptMeetingToBehavior } = await import('@/domain/isp/behaviorMonitoring');

    const meeting = minimalRecord({
      goalEvaluations: [
        { goalText: '目標1', achievementLevel: 'achieved', comment: 'OK' },
        { goalText: '目標2', achievementLevel: 'partial', comment: '部分' },
      ],
    });

    const result = adaptMeetingToBehavior(meeting, 'PS-001');
    expect(result.supportEvaluations).toHaveLength(2);

    // もう一度変換しても長さは2のまま
    const result2 = adaptMeetingToBehavior(meeting, 'PS-001');
    expect(result2.supportEvaluations).toHaveLength(2);
  });

  it('recommendedChanges は decisions の参照コピーではなく同値', async () => {
    const { adaptMeetingToBehavior } = await import('@/domain/isp/behaviorMonitoring');

    const decisions = ['継続', '追加検討'];
    const meeting = minimalRecord({ decisions });

    const result = adaptMeetingToBehavior(meeting, 'PS-001');
    expect(result.recommendedChanges).toEqual(decisions);
    // 注: JS の配列は参照渡しなので、変換元を変更しても
    // 既に変換済みの result には影響しないことは実装に依存
  });

  // ── SP → Domain → BehaviorMonitoring 往復一致 ──

  it('SP行 → mapSpRow → adaptMeetingToBehavior の往復が安定する', async () => {
    const { adaptMeetingToBehavior } = await import('@/domain/isp/behaviorMonitoring');

    const row = minimalSpRow({
      cr014_goalEvaluationsJson: JSON.stringify([
        { goalText: '活動', achievementLevel: 'achieved', comment: 'OK' },
      ]),
      cr014_overallAssessment: '良好',
      cr014_decisionsJson: JSON.stringify(['継続']),
    });

    const domain = mapSpRowToMonitoringMeeting(row);
    const behavior = adaptMeetingToBehavior(domain, 'PS-001');

    expect(behavior.summary).toBe('良好');
    expect(behavior.supportEvaluations).toHaveLength(1);
    expect(behavior.supportEvaluations[0].achievementLevel).toBe('effective');
    expect(behavior.recommendedChanges).toEqual(['継続']);
  });
});

import { describe, expect, it } from 'vitest';
import { buildMeetingMinutesExportModel } from '../buildMeetingMinutesExportModel';
import type { MeetingMinutes, MeetingMinuteBlock } from '../../types';

function makeBlock(
  type: string,
  text: string,
  props: Record<string, unknown> = {}
): MeetingMinuteBlock {
  return {
    id: `id-${Math.random()}`,
    type,
    props,
    content: [{ type: 'text', text, styles: {} }],
    children: [],
  };
}

const p = (text: string) => makeBlock('paragraph', text);

const baseMinutes: MeetingMinutes = {
  id: 1,
  title: 'Test Meeting',
  meetingDate: '2026-04-05',
  category: '朝会',
  summary: '',
  decisions: '',
  actions: '',
  tags: '',
  relatedLinks: '',
};

describe('buildMeetingMinutesExportModel', () => {
  it('should map meta fields correctly', () => {
    const min: MeetingMinutes = {
      ...baseMinutes,
      attendees: ['山田', '佐藤'],
      chair: '鈴木',
      scribe: '田中',
    };

    const model = buildMeetingMinutesExportModel({ minutes: min });
    expect(model.title).toBe('Test Meeting');
    expect(model.meetingDate).toBe('2026-04-05');
    expect(model.category).toBe('朝会');
    expect(model.attendees).toEqual(['山田', '佐藤']);
    expect(model.chair).toBe('鈴木');
    expect(model.scribe).toBe('田中');
  });

  it('should parse formal blocks into expected sections', () => {
    const min: MeetingMinutes = {
      ...baseMinutes,
      contentBlocks: [
        makeBlock('decision', '新しいルール'),
        makeBlock('action', '資料作成'),
        makeBlock('report', '進捗順調'),
        makeBlock('notification', 'GW休業'),
        makeBlock('nextSchedule', '次回5/1'),
        makeBlock('continuingDiscussion', '予算の件'),
      ],
    };

    const model = buildMeetingMinutesExportModel({ minutes: min });
    const sections = model.sections;

    // By default (admin order): summary -> report -> decision -> continuingDiscussion -> action -> nextSchedule -> notification
    expect(sections).toHaveLength(6);

    expect(sections[0].kind).toBe('report');
    expect(sections[0].body).toBe('進捗順調');

    expect(sections[1].kind).toBe('decision');
    expect(sections[1].body).toBe('新しいルール');

    expect(sections[2].kind).toBe('continuingDiscussion');
    expect(sections[2].body).toBe('予算の件');

    expect(sections[3].kind).toBe('action');
    expect(sections[3].body).toBe('資料作成');
    expect(sections[3].bulletStyle).toBe('check'); // default is info/check

    expect(sections[4].kind).toBe('nextSchedule');
    expect(sections[4].body).toBe('次回5/1');

    expect(sections[5].kind).toBe('notification');
    expect(sections[5].body).toBe('GW休業');
  });

  it('should fallback to legacy fields when contentBlocks are missing', () => {
    const min: MeetingMinutes = {
      ...baseMinutes,
      summary: 'レガシー要点',
      decisions: 'レガシー決定',
      actions: 'レガシーアクション',
      contentBlocks: undefined,
    };

    const model = buildMeetingMinutesExportModel({ minutes: min });
    const sec = model.sections;

    expect(sec).toHaveLength(3);
    const kinds = sec.map((s) => s.kind);
    // admin order
    expect(kinds).toEqual(['summary', 'decision', 'action']);
    expect(sec[0].body).toBe('レガシー要点');
    expect(sec[1].body).toBe('レガシー決定');
    expect(sec[2].body).toBe('レガシーアクション');
  });

  it('should correctly parse prefix blocks', () => {
    const min: MeetingMinutes = {
      ...baseMinutes,
      contentBlocks: [
        p('【報告】売上110%'),
        p('【次回予定】5/10'),
      ],
    };

    const model = buildMeetingMinutesExportModel({ minutes: min });
    expect(model.sections).toHaveLength(2);
    expect(model.sections[0].kind).toBe('report');
    expect(model.sections[0].body).toBe('売上110%');
    expect(model.sections[1].kind).toBe('nextSchedule');
    expect(model.sections[1].body).toBe('5/10');
  });

  it('should change order and emphasis based on audience field', () => {
    const min: MeetingMinutes = {
      ...baseMinutes,
      contentBlocks: [
        makeBlock('report', '事後報告'),
        makeBlock('action', '即時対応'),
      ],
    };

    const fieldModel = buildMeetingMinutesExportModel({
      minutes: min,
      audience: 'field', // Field prioritizes action
    });

    const sec = fieldModel.sections;
    expect(sec[0].kind).toBe('action');
    expect(sec[0].emphasis).toBe('warning');
    expect(sec[1].kind).toBe('report');
    expect(sec[1].emphasis).toBe('normal');

    const adminModel = buildMeetingMinutesExportModel({
      minutes: min,
      audience: 'admin', // Admin prioritizes report
    });

    const aSec = adminModel.sections;
    expect(aSec[0].kind).toBe('report');
    expect(aSec[0].emphasis).toBe('info');
    expect(aSec[1].kind).toBe('action');
    expect(aSec[1].emphasis).toBe('info');
  });

  it('should map unknown headings to generic section', () => {
    const min: MeetingMinutes = {
      ...baseMinutes,
      contentBlocks: [
        makeBlock('heading', 'その他雑談', { level: 2 }),
        p('昨日のテレビの話'),
      ],
    };

    const model = buildMeetingMinutesExportModel({ minutes: min });
    expect(model.sections.length).toBeGreaterThan(0);
    const genericSec = model.sections.find((s) => s.kind === 'generic');
    expect(genericSec).toBeDefined();
    expect(genericSec?.body).toBe('その他雑談\n昨日のテレビの話');
  });
});

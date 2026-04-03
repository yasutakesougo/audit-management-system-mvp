import { describe, it, expect } from 'vitest';
import { buildDailyRecordPayload } from '../buildDailyRecordPayload';
import type { SaveDailyRecordInput } from '../../legacy/DailyRecordRepository';

describe('buildDailyRecordPayload', () => {
  it('正常な入力からSharePoint用Payloadを生成する', () => {
    const input: SaveDailyRecordInput = {
      date: '2026-04-01',
      reporter: {
        name: '山田 太郎',
        role: '生活支援員',
      },
      userRows: [
        {
          userId: '001',
          userName: '佐藤 花子',
          amActivity: '作業',
          pmActivity: '運動',
          lunchAmount: '完食',
          problemBehavior: {
            selfHarm: false,
            otherInjury: false,
            loudVoice: false,
            pica: false,
            other: false,
          },
          specialNotes: '特になし',
          behaviorTags: ['集中'],
        },
      ],
      userCount: 1,
    };

    const payload = buildDailyRecordPayload(input);

    expect(payload.Title).toBe('2026-04-01');
    expect(payload.RecordDate).toBe(new Date('2026-04-01').toISOString());
    expect(payload.ReporterName).toBe('山田 太郎');
    expect(payload.ReporterRole).toBe('生活支援員');
    expect(payload.UserCount).toBe(1);

    const parsedJson = JSON.parse(payload.UserRowsJSON);
    expect(parsedJson[0].userId).toBe('001');
    expect(parsedJson[0].amActivity).toBe('作業');
  });

  it('不要な空白や欠損データをクリーンアップする', () => {
    const input: SaveDailyRecordInput = {
      date: '2026-04-02',
      reporter: {
        name: '  ', // 欠損
        role: ' 担当 ', // 空白あり
      },
      userRows: [
        {
          userId: '002',
          userName: '鈴木 次郎',
          amActivity: '  作業  ', // 前後空白
          pmActivity: '',
          lunchAmount: '',
          problemBehavior: {
            selfHarm: false,
            otherInjury: false,
            loudVoice: false,
            pica: false,
            other: false,
          },
          specialNotes: '  ',
          behaviorTags: [],
        },
      ],
      userCount: 1,
    };

    const payload = buildDailyRecordPayload(input);

    expect(payload.ReporterName).toBe('不明');
    expect(payload.ReporterRole).toBe('担当');
    
    const parsedJson = JSON.parse(payload.UserRowsJSON);
    expect(parsedJson[0].amActivity).toBe('作業'); // トリミングされていること
    expect(parsedJson[0].specialNotes).toBe(''); // 空行が空文字になっていること
  });

  it('不正な日付が渡された場合にクラッシュせず現在日付をフォールバックする', () => {
    const input: SaveDailyRecordInput = {
      date: 'invalid-date',
      reporter: { name: 'テスト', role: 'テスト' },
      userRows: [],
      userCount: 0,
    };

    const payload = buildDailyRecordPayload(input);
    expect(payload.Title).toBe('invalid-date'); // Title自体はそのまま
    // ISO変換が失敗した場合でもエラーにならず日付フォーマットの文字列が入ること
    expect(payload.RecordDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

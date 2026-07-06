import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DailyRecordItem } from '@/features/daily';
import type { IUserMaster } from '@/features/users/types';
import {
  AchievementRecordPDF,
  type AchievementRecordProps,
} from '../AchievementRecordPDF';
import { useAchievementPDF } from '../useAchievementPDF';

const mocks = vi.hoisted(() => ({
  dailyRepository: {
    list: vi.fn(),
  },
  userRepository: {
    getAll: vi.fn(),
  },
}));

vi.mock('@/features/daily/repositories/repositoryFactory', () => ({
  useDailyRecordRepository: () => mocks.dailyRepository,
}));

vi.mock('@/features/users/repositoryFactory', () => ({
  useUserRepository: () => mocks.userRepository,
}));

const makeUser = (): IUserMaster => ({
  UserID: 'U-001',
  FullName: '利用者A',
  RecipientCertNumber: 'CERT-001',
  severeFlag: false,
} as unknown as IUserMaster);

const makeDailyRecord = (): DailyRecordItem => ({
  id: 'daily-1',
  date: '2026-03-02',
  reporter: { name: '記録者', role: '担当' },
  userRows: [
    {
      userId: 'U-001',
      userName: '利用者A',
      amActivity: '作業',
      pmActivity: '',
      lunchAmount: '',
      problemBehavior: {
        selfHarm: false,
        otherInjury: false,
        loudVoice: false,
        pica: false,
        other: false,
      },
      specialNotes: '特記事項',
    },
  ],
  userCount: 1,
} as unknown as DailyRecordItem);

const collectText = (node: React.ReactNode): string[] => {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return [];
  }
  if (typeof node === 'string' || typeof node === 'number') {
    return [String(node)];
  }
  if (Array.isArray(node)) {
    return node.flatMap(collectText);
  }
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return collectText(node.props.children);
  }
  return [];
};

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe('Achievement PDF stub values', () => {
  it('prepares facility metadata from config and does not inject fixed service times', async () => {
    vi.stubEnv('VITE_FACILITY_NAME', '設定事業所');
    vi.stubEnv('VITE_FACILITY_NUMBER', '1234567890');
    mocks.userRepository.getAll.mockResolvedValue([makeUser()]);
    mocks.dailyRepository.list.mockResolvedValue([makeDailyRecord()]);

    const { result } = renderHook(() => useAchievementPDF());
    let pdfData = null as AchievementRecordProps | null;

    await act(async () => {
      pdfData = await result.current.prepareData('U-001', '2026-03');
    });

    if (!pdfData) {
      throw new Error('Expected achievement PDF data to be prepared');
    }

    expect(pdfData.facilityName).toBe('設定事業所');
    expect(pdfData.facilityNumber).toBe('1234567890');

    const attendedRow = pdfData.rows.find((row) => row.date === '2');
    expect(attendedRow).toMatchObject({
      status: '通所',
      startTime: null,
      endTime: null,
      notes: '特記事項',
    });

    const serialized = JSON.stringify(pdfData);
    expect(serialized).not.toContain('10:00');
    expect(serialized).not.toContain('15:30');
    expect(serialized).not.toContain('141XXXXXXX');
    expect(serialized.toLowerCase()).not.toContain('dummy');
    expect(serialized.toLowerCase()).not.toContain('placeholder');
  });

  it('renders configured facility values without the old fixed facility fields', () => {
    const tree = AchievementRecordPDF({
      month: '2026-03',
      userName: '利用者A',
      userCertNumber: 'CERT-001',
      facilityName: '設定事業所',
      facilityNumber: '1234567890',
      rows: [
        {
          date: '2',
          dayOfWeek: '月',
          status: '通所',
          serviceType: '通常',
          startTime: null,
          endTime: null,
          notes: '特記事項',
        },
      ],
    });

    const text = collectText(tree).join('\n');

    expect(text).toContain('事業所名: ');
    expect(text).toContain('設定事業所');
    expect(text).toContain('事業所番号: ');
    expect(text).toContain('1234567890');
    expect(text).not.toContain('磯子区障害者地域活動ホーム');
    expect(text).not.toContain('141XXXXXXX');
    expect(text.toLowerCase()).not.toContain('dummy');
    expect(text.toLowerCase()).not.toContain('placeholder');
  });
});

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AbcEvidenceListPanel } from '../AbcEvidenceListPanel';
import type { AbcRecord } from '@/domain/abc/abcRecord';

describe('AbcEvidenceListPanel', () => {
  const mockPeriod = {
    from: '2026-05-01',
    to: '2026-07-30',
    isProvisional: false,
    source: 'planning' as const,
  };

  const mockRecords: AbcRecord[] = [
    {
      id: 'rec_1',
      userId: 'I009',
      userName: '利用者A',
      occurredAt: '2026-05-13T09:30:00.000Z',
      setting: '通所',
      antecedent: '朝の準備で名前を呼ばれた',
      behavior: '机を叩いた',
      consequence: '職員が別の場所に誘導した',
      intensity: 'medium',
      durationMinutes: 5,
      riskFlag: false,
      recorderName: '職員A',
      tags: [],
      notes: '',
      createdAt: '2026-05-13T09:31:00.000Z',
      sourceContext: {
        source: 'daily-support',
        date: '2026-05-13',
        slotId: '9:30頃|通所・朝の準備',
      },
    },
    {
      id: 'rec_2',
      userId: 'I009',
      userName: '利用者A',
      occurredAt: '2026-05-15T15:00:00.000Z',
      setting: '食堂',
      antecedent: 'おやつを待っている間',
      behavior: '大声をあげた',
      consequence: 'おやつを渡した',
      intensity: 'high',
      durationMinutes: 10,
      riskFlag: true,
      recorderName: '職員B',
      tags: [],
      notes: '',
      createdAt: '2026-05-15T15:01:00.000Z',
      sourceContext: {
        source: 'standalone',
        date: '2026-05-15',
        returnUrl: '/kiosk/users/10',
      },
    },
  ];

  it('ローディング中は読込中メッセージが表示されること', () => {
    render(
      <AbcEvidenceListPanel
        records={[]}
        loading={true}
        error={null}
        period={null}
      />
    );

    expect(screen.getByText('Dedicated ABC 根拠候補を取得中...')).toBeInTheDocument();
  });

  it('エラー時はエラーメッセージが表示されること', () => {
    const error = new Error('SharePoint接続エラー');
    render(
      <AbcEvidenceListPanel
        records={[]}
        loading={false}
        error={error}
        period={null}
      />
    );

    expect(screen.getByText('Dedicated ABC 記録の取得に失敗しました: SharePoint接続エラー')).toBeInTheDocument();
  });

  it('期間情報がない場合は何も表示されないこと', () => {
    const { container } = render(
      <AbcEvidenceListPanel
        records={[]}
        loading={false}
        error={null}
        period={null}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('データが0件の場合は空のメッセージが表示されること', () => {
    render(
      <AbcEvidenceListPanel
        records={[]}
        loading={false}
        error={null}
        period={mockPeriod}
      />
    );

    expect(screen.getByText('この期間内に登録された Dedicated ABC 記録はありません。')).toBeInTheDocument();
    expect(screen.getByText('期間: 2026-05-01 〜 2026-07-30')).toBeInTheDocument();
  });

  it('暫定期間フラグがある場合は【暫定期間】バッジが表示されること', () => {
    const provisionalPeriod = {
      ...mockPeriod,
      isProvisional: true,
      source: 'fallback' as const,
    };

    render(
      <AbcEvidenceListPanel
        records={[]}
        loading={false}
        error={null}
        period={provisionalPeriod}
      />
    );

    expect(screen.getByText('暫定期間')).toBeInTheDocument();
  });

  it('データがある場合は日付、スロット、先行・行動・結果が正しくレンダリングされること', () => {
    render(
      <AbcEvidenceListPanel
        records={mockRecords}
        loading={false}
        error={null}
        period={mockPeriod}
      />
    );

    // 1件目のテスト
    expect(screen.getByText('2026-05-13')).toBeInTheDocument();
    expect(screen.getByText('通所・朝の準備')).toBeInTheDocument();
    expect(screen.getByText('支援手順起点')).toBeInTheDocument();
    expect(screen.getByText('強度: 中度')).toBeInTheDocument();
    expect(screen.getByText('朝の準備で名前を呼ばれた')).toBeInTheDocument();
    expect(screen.getByText('机を叩いた')).toBeInTheDocument();
    expect(screen.getByText('職員が別の場所に誘導した')).toBeInTheDocument();

    // 2件目のテスト (キオスク判定)
    expect(screen.getByText('2026-05-15')).toBeInTheDocument();
    expect(screen.getByText('キオスク・支援手順起点')).toBeInTheDocument();
    expect(screen.getByText('強度: 重度')).toBeInTheDocument();
    expect(screen.getByText('おやつを待っている間')).toBeInTheDocument();
    expect(screen.getByText('大声をあげた')).toBeInTheDocument();
    expect(screen.getByText('おやつを渡した')).toBeInTheDocument();
  });
});

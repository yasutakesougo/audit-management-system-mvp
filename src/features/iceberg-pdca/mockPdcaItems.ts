import type { IcebergPdcaItem } from './types';

export const mockPdcaItems: IcebergPdcaItem[] = [
  {
    id: 'pdca-001',
    userId: 'U-001',
    title: '通所時の緊張を減らす',
    phase: 'PLAN',
    summary:
      '生活介護事業所への到着〜活動スペースまでの導線をシンプルにし、安心できる声かけを事前に決めておく。',
    createdAt: '2025-12-01T09:00:00+09:00',
    updatedAt: '2025-12-01T09:00:00+09:00',
  },
  {
    id: 'pdca-002',
    userId: 'U-001',
    title: '通所時の緊張を減らす',
    phase: 'DO',
    summary:
      '1週間、同じ職員が玄関で迎え、移動の途中で立ち止まらないように声かけしながら活動スペースまでエスコートする。',
    createdAt: '2025-12-08T09:00:00+09:00',
    updatedAt: '2025-12-08T09:00:00+09:00',
  },
  // TODO: CHECK / ACT も1〜2件ずつ追記していく
];

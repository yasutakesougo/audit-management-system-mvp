/**
 * Daily Record — Mock data, generators, and factory functions
 *
 * Extracted from DailyRecordPage.tsx to separate data concerns from UI.
 * These will be replaced by real SP data fetching in production.
 */

import type { PersonDaily } from '@/domain/daily/types';
import { toLocalDateISO } from '@/utils/getNow';

// ─── Mock Users ─────────────────────────────────────────────────────────────

export const mockUsers = [
  '田中太郎', '佐藤花子', '鈴木次郎', '高橋美咲', '山田健一', '渡辺由美', '伊藤雄介',
  '中村恵子', '小林智子', '加藤秀樹', '吉田京子', '清水達也', '松本麻衣', '森田健二',
  '池田理恵', '石井大輔', '橋本真理', '藤田和也', '長谷川瞳', '村上拓海', '坂本彩香',
  '岡田裕太', '近藤美和', '福田誠', '前田愛', '木村康平', '内田千春', '西川雅人',
  '斎藤洋子', '三浦大輔', '小野寺美加', '新井智也'
];

// ─── Mock Records ───────────────────────────────────────────────────────────

export const mockRecords: PersonDaily[] = [
  {
    id: 1,
    userId: '001',
    userName: '田中太郎',
    date: toLocalDateISO(),
    status: '完了',
    reporter: { name: '職員A' },
    draft: { isDraft: false },
    kind: 'A',
    data: {
      amActivities: ['散歩', '体操'],
      pmActivities: ['読書', 'テレビ鑑賞'],
      amNotes: '今日は調子が良く、積極的に活動に参加していました。',
      pmNotes: '午後は少し疲れた様子でしたが、落ち着いて過ごしていました。',
      mealAmount: '完食',
      problemBehavior: {
        selfHarm: false,
        otherInjury: false,
        loudVoice: false,
        pica: false,
        other: false,
        otherDetail: ''
      },
      seizureRecord: {
        occurred: false,
        time: '',
        duration: '',
        severity: undefined,
        notes: ''
      },
      specialNotes: '特に問題なく過ごせました。'
    }
  },
  {
    id: 2,
    userId: '002',
    userName: '佐藤花子',
    date: toLocalDateISO(),
    status: '作成中',
    reporter: { name: '職員B' },
    draft: { isDraft: true },
    kind: 'A',
    data: {
      amActivities: ['ラジオ体操'],
      pmActivities: [],
      amNotes: '',
      pmNotes: '',
      mealAmount: '少なめ',
      problemBehavior: {
        selfHarm: false,
        otherInjury: false,
        loudVoice: false,
        pica: false,
        other: false,
        otherDetail: ''
      },
      seizureRecord: {
        occurred: false,
        time: '',
        duration: '',
        severity: undefined,
        notes: ''
      },
      specialNotes: ''
    }
  },
  {
    id: 3,
    userId: '003',
    userName: '鈴木次郎',
    date: toLocalDateISO(),
    status: '未作成',
    reporter: { name: '' },
    draft: { isDraft: true },
    kind: 'A',
    data: {
      amActivities: [],
      pmActivities: [],
      amNotes: '',
      pmNotes: '',
      mealAmount: '完食',
      problemBehavior: {
        selfHarm: false,
        otherInjury: false,
        loudVoice: false,
        pica: false,
        other: false,
        otherDetail: ''
      },
      seizureRecord: {
        occurred: false,
        time: '',
        duration: '',
        severity: undefined,
        notes: ''
      },
      specialNotes: ''
    }
  }
];

// ─── Record Generators ──────────────────────────────────────────────────────

export const generateTodayRecords = (): PersonDaily[] => {
  const today = toLocalDateISO();
  return mockUsers.map((name, index) => {
    const userId = String(index + 1).padStart(3, '0');
    const statuses: Array<'完了' | '作成中' | '未作成'> = ['完了', '作成中', '未作成'];
    const status = statuses[Math.floor(Math.random() * statuses.length)];

    return {
      id: index + 1,
      userId: userId,
      userName: name,
      date: today,
      status,
      reporter: { name: status === '未作成' ? '' : '職員' + String.fromCharCode(65 + (index % 5)) },
      draft: { isDraft: status !== '完了' },
      kind: 'A' as const,
      data: {
        amActivities: status === '未作成' ? [] : ['活動' + (index % 3 + 1)],
        pmActivities: status === '完了' ? ['活動' + ((index + 1) % 3 + 1)] : [],
        amNotes: status === '完了' ? '順調に過ごしています。' : '',
        pmNotes: status === '完了' ? '問題なく活動できました。' : '',
        mealAmount: (['完食', '多め', '半分', '少なめ', 'なし'] as const)[index % 5],
        problemBehavior: {
          selfHarm: Math.random() > 0.9,
          otherInjury: Math.random() > 0.9,
          loudVoice: Math.random() > 0.85,
          pica: Math.random() > 0.95,
          other: Math.random() > 0.9,
          otherDetail: Math.random() > 0.9 ? 'その他の詳細' : ''
        },
        seizureRecord: {
          occurred: Math.random() > 0.95,
          time: Math.random() > 0.95 ? '14:30' : '',
          duration: Math.random() > 0.95 ? '約3分' : '',
          severity: Math.random() > 0.95 ? (['軽度', '中等度', '重度'] as const)[Math.floor(Math.random() * 3)] : undefined,
          notes: Math.random() > 0.95 ? '発作の詳細' : ''
        },
        specialNotes: status === '完了' && Math.random() > 0.7 ? '特記事項があります。' : ''
      }
    };
  });
};

// ─── Factory: Create Missing Record ─────────────────────────────────────────

export const createMissingRecord = (
  name: string,
  userId: string,
  date: string,
  index: number,
): PersonDaily => ({
  id: Date.now() + index,
  userId: userId,
  userName: name,
  date,
  status: '未作成',
  reporter: { name: '' },
  draft: { isDraft: true },
  kind: 'A',
  data: {
    amActivities: [],
    pmActivities: [],
    amNotes: '',
    pmNotes: '',
    mealAmount: '完食',
    problemBehavior: {
      selfHarm: false,
      otherInjury: false,
      loudVoice: false,
      pica: false,
      other: false,
      otherDetail: '',
    },
    seizureRecord: {
      occurred: false,
      time: '',
      duration: '',
      severity: undefined,
      notes: '',
    },
    specialNotes: '',
  },
});

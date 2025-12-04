export type TokuseiSurveyResponse = {
  id: number;
  responseId: string;
  responderName: string;
  responderEmail?: string;
  fillDate: string;
  targetUserName: string;
  guardianName?: string;
  relation?: string;
  heightCm?: number | null;
  weightKg?: number | null;
  personality?: string;
  sensoryFeatures?: string;
  behaviorFeatures?: string;
  preferences?: string;
  strengths?: string;
  notes?: string;
  createdAt: string;
};

export type TokuseiSurveySummary = {
  totalResponses: number;
  uniqueUsers: number;
  uniqueGuardians: number;
  latestSubmittedAt: string | null;
};

const coerceNumber = (value: number | null | undefined): number | null => {
  if (typeof value !== 'number') return null;
  if (!Number.isFinite(value)) return null;
  return value;
};

export const summarizeTokuseiResponses = (responses: TokuseiSurveyResponse[]): TokuseiSurveySummary => {
  if (!responses.length) {
    return {
      totalResponses: 0,
      uniqueUsers: 0,
      uniqueGuardians: 0,
      latestSubmittedAt: null,
    };
  }

  const uniqueUsers = new Set<string>();
  const uniqueGuardians = new Set<string>();
  let latestSubmittedAt: string | null = null;

  for (const response of responses) {
    if (response.targetUserName) {
      uniqueUsers.add(response.targetUserName);
    }
    if (response.guardianName) {
      uniqueGuardians.add(response.guardianName);
    }
    if (!latestSubmittedAt || response.fillDate > latestSubmittedAt) {
      latestSubmittedAt = response.fillDate;
    }
  }

  return {
    totalResponses: responses.length,
    uniqueUsers: uniqueUsers.size,
    uniqueGuardians: uniqueGuardians.size,
    latestSubmittedAt,
  };
};

export const createTokuseiDemoResponses = (): TokuseiSurveyResponse[] => {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  return [
    {
      id: 1,
      responseId: 'TOKUSEI-001',
      responderName: '山田花子',
      responderEmail: 'hanako.yamada@example.com',
      fillDate: new Date(now - dayMs).toISOString(),
      targetUserName: 'Aさん',
      guardianName: '山田太郎',
      relation: '母',
      heightCm: coerceNumber(148),
      weightKg: coerceNumber(42),
      personality: '初めての環境では緊張が強いが、慣れると自分から話しかけられる明るさがあります。',
      sensoryFeatures: '大きな音と蛍光灯のちらつきが苦手。イヤーマフで落ち着ける。',
      behaviorFeatures: '予定外の変更で泣いてしまうことあり。視覚スケジュールで予告すると安定。',
      preferences: '動物動画を見ること、柔らかい感触のクッション。',
      strengths: '手先が器用でビーズ作りが得意。小さい子のお世話が上手。',
      notes: '配慮が必要な場面：集団活動の開始時。個別に声をかけると入りやすい。',
      createdAt: new Date(now - dayMs * 0.9).toISOString(),
    },
    {
      id: 2,
      responseId: 'TOKUSEI-002',
      responderName: '佐藤一郎',
      responderEmail: 'ichiro.sato@example.com',
      fillDate: new Date(now - dayMs * 3).toISOString(),
      targetUserName: 'Bさん',
      guardianName: '佐藤花',
      relation: '父',
      heightCm: coerceNumber(160),
      weightKg: coerceNumber(50),
      personality: 'マイペースでこだわり強め。信頼できる人には冗談を交えながら話す。',
      sensoryFeatures: '触覚過敏でタグ付きの服が苦手。加圧ベストで安心できる。',
      behaviorFeatures: '気持ちの切り替えに時間がかかる。シークエンスボードで見通しを示すと前向き。',
      preferences: '電車の車両形式を調べること。図鑑を眺める時間。',
      strengths: '記憶力が非常に高く、ダイヤ改正の情報にも詳しい。',
      notes: '外出時は混雑を避けるルート設定を希望。',
      createdAt: new Date(now - dayMs * 2.9).toISOString(),
    },
    {
      id: 3,
      responseId: 'TOKUSEI-003',
      responderName: '高橋美咲',
      responderEmail: 'misaki.takahashi@example.com',
      fillDate: new Date(now - dayMs * 6).toISOString(),
      targetUserName: 'Cさん',
      guardianName: '高橋陽子',
      relation: '姉',
      heightCm: coerceNumber(152),
      weightKg: coerceNumber(47),
      personality: '周囲を観察してから動く慎重派。信頼関係ができると率先して手伝ってくれる。',
      sensoryFeatures: '匂いに敏感で、調理室付近ではマスクをしたい。',
      behaviorFeatures: '疲れると黙り込むので、短い休憩を挟むと復活。',
      preferences: 'イラストを描くこと、落ち着いた音楽。',
      strengths: '人を気遣う声かけが自然にできる。',
      notes: '面談時は女性スタッフ希望。',
      createdAt: new Date(now - dayMs * 5.8).toISOString(),
    },
  ];
};

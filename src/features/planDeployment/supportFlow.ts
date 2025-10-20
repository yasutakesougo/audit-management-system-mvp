export type SupportStrategyStage =
  | 'proactive'
  | 'earlyResponse'
  | 'crisisResponse'
  | 'postCrisis';

export interface SupportActivityTemplate {
  time: string;
  title: string;
  personTodo: string;
  supporterTodo: string;
  stage: SupportStrategyStage;
}

export interface SupportPlanDeployment {
  planId: string;
  planName: string;
  version: string;
  deployedAt: string;
  author: string;
  activities: SupportActivityTemplate[];
  summary: string;
  references?: Array<{ label: string; value: string }>;
}

const SUPPORT_PLAN_GUIDE_STORAGE_KEY = 'support-plan-guide.v2';

const createTimedTemplate = (
  baseTime: string,
  _index: number,
  overrides: Partial<SupportActivityTemplate> = {}
): SupportActivityTemplate => {
  return {
    time: overrides.time ?? baseTime,
    title: overrides.title ?? '未設定の活動',
    personTodo: overrides.personTodo ?? '利用者の活動内容を設定してください',
    supporterTodo: overrides.supporterTodo ?? '支援者の関わり方を設定してください',
    stage: overrides.stage ?? 'proactive',
  };
};

export const fallbackSupportActivities: SupportActivityTemplate[] = [
  createTimedTemplate('09:00', 0, {
    title: '朝の会・体操',
    personTodo: '皆と一緒に体操に参加する',
    supporterTodo: '隣で見本を見せながら、参加を促す。',
    stage: 'proactive',
    time: '09:00',
  }),
  createTimedTemplate('10:00', 1, {
    title: '個別課題',
    personTodo: 'パズルや組み立て課題に取り組む',
    supporterTodo: '集中が途切れないよう、適度に声かけを行う。',
    stage: 'proactive',
    time: '10:00',
  }),
  createTimedTemplate('11:00', 2, {
    title: '自由時間',
    personTodo: '好きな音楽を聴いたり、本を読んだりして過ごす',
    supporterTodo: 'リラックスできているか見守り、必要であれば環境を調整する。',
    stage: 'earlyResponse',
    time: '11:00',
  }),
  createTimedTemplate('12:00', 3, {
    title: '昼食',
    personTodo: '落ち着いて食事をとる',
    supporterTodo: '食器の配置を手伝い、ゆっくり食べられるように声かけをする。',
    stage: 'earlyResponse',
    time: '12:00',
  }),
  createTimedTemplate('13:30', 4, {
    title: '散歩・屋外活動',
    personTodo: '公園などを歩き、体を動かす',
    supporterTodo: '安全に注意しながら、本人ペースで活動できるよう付き添う。',
    stage: 'proactive',
    time: '13:30',
  }),
  createTimedTemplate('15:00', 5, {
    title: 'おやつ・休憩',
    personTodo: 'おやつを食べ、静かに休憩する',
    supporterTodo: '水分補給を促し、落ち着いた雰囲気を作る。',
    stage: 'postCrisis',
    time: '15:00',
  }),
];

const deployedPlans: Record<string, SupportPlanDeployment> = {
  '001': {
    planId: 'plan-001-v2',
    planName: '田中太郎さん支援計画',
    version: '2.0',
    deployedAt: '2025-09-12T09:00:00+09:00',
    author: '支援チームC',
    summary: '朝のルーティン安定と午後の製作活動への集中を高める方針。',
    references: [
      { label: '長期目標', value: '生活リズムを整え自律した行動選択ができる' },
      { label: '短期目標', value: '午後の創作活動で集中時間30分を維持' },
    ],
    activities: [
      createTimedTemplate('09:00', 0, {
        title: '朝のチェックイン',
        personTodo: 'その日の体調と気分をボードで表現する',
        supporterTodo: '感情ボードを使って本人の状態を確認し、必要な調整を行う。',
        stage: 'proactive',
        time: '09:00',
      }),
      createTimedTemplate('09:30', 1, {
        title: '身体調整エクササイズ',
        personTodo: 'ストレッチと深呼吸を5分ずつ行う',
        supporterTodo: '呼吸のリズムを声でガイドし、動作を一緒に確認する。',
        stage: 'proactive',
        time: '09:30',
      }),
      createTimedTemplate('10:00', 2, {
        title: '個別学習ブロック',
        personTodo: 'タブレット教材で理解度20問を目標に取り組む',
        supporterTodo: '集中が途切れたサインを観察し、早期対応カードを提示する。',
        stage: 'earlyResponse',
        time: '10:00',
      }),
      createTimedTemplate('11:00', 3, {
        title: '感覚統合ブレイク',
        personTodo: 'バランスボードに乗りながら音楽を聴いてリラックスする',
        supporterTodo: '安全確認をしつつ、本人の選んだ音楽で環境調整を行う。',
        stage: 'earlyResponse',
        time: '11:00',
      }),
      createTimedTemplate('12:00', 4, {
        title: '昼食とソーシャルスキル練習',
        personTodo: '食前の挨拶と食後の片付けを行う',
        supporterTodo: '視覚的手順書を提示し、声かけは最小限にとどめる。',
        stage: 'proactive',
        time: '12:00',
      }),
      createTimedTemplate('13:30', 5, {
        title: '製作活動（木工）',
        personTodo: '組み立て工程を手順書に沿って進める',
        supporterTodo: '安全管理と、成功体験を強化する声かけを行う。',
        stage: 'proactive',
        time: '13:30',
      }),
      createTimedTemplate('15:00', 6, {
        title: '振り返りとクールダウン',
        personTodo: '振り返りカードに今日の達成を記入する',
        supporterTodo: 'ポジティブフィードバックを伝え、翌日の準備を一緒に確認する。',
        stage: 'postCrisis',
        time: '15:00',
      }),
    ],
  },
  '012': {
    planId: 'plan-012-v1',
    planName: '山田一郎さんコミュニケーション支援計画',
    version: '1.1',
    deployedAt: '2025-08-22T10:00:00+09:00',
    author: '支援計画チームB',
    summary: 'コミュニケーション機会を増やし、興奮時のクールダウン手順を標準化する。',
    references: [
      { label: '短期目標', value: '午前中に3回以上、適切な助けを求める発話ができる' },
    ],
    activities: [
      createTimedTemplate('09:15', 0, {
        title: 'コミュニケーション準備タイム',
        personTodo: '支援カードの確認と今日の一言練習を行う',
        supporterTodo: 'カードの更新を行い、声の大きさを一緒に練習する。',
        stage: 'proactive',
        time: '09:15',
      }),
      createTimedTemplate('10:00', 1, {
        title: '共同作業セッション',
        personTodo: 'パートナーと協力してパズルを完成させる',
        supporterTodo: '順番待ちの視覚支援を提示し、適切な声かけ例を示す。',
        stage: 'earlyResponse',
        time: '10:00',
      }),
      createTimedTemplate('11:00', 2, {
        title: 'サイン付き休憩',
        personTodo: '休憩カードを提示してクールダウンする',
        supporterTodo: '刺激の少ないスペースへ案内し、呼吸法をガイドする。',
        stage: 'crisisResponse',
        time: '11:00',
      }),
      createTimedTemplate('13:00', 3, {
        title: '午後のロールプレイ',
        personTodo: '想定場面で助けを求める練習をする',
        supporterTodo: 'ロールプレイシナリオを提示し、成功体験をフィードバックする。',
        stage: 'proactive',
        time: '13:00',
      }),
      createTimedTemplate('14:30', 4, {
        title: 'コミュニケーション記録',
        personTodo: '今日の成功例をカードに記録する',
        supporterTodo: '成功要因を一緒に整理し、翌日の計画に反映する。',
        stage: 'postCrisis',
        time: '14:30',
      }),
    ],
  },
};

export const resolveSupportFlowForUser = (userId: string): SupportPlanDeployment | null => {
  const deployed = deployedPlans[userId];
  if (deployed) {
    return deployed;
  }
  const draftDeployment = resolveDraftDeployment(userId);
  return draftDeployment ?? null;
};

type StoredDraft = {
  id?: string;
  name?: string;
  updatedAt?: string;
  userId?: number | string | null;
  userCode?: string | null;
  data?: {
    longTermGoal?: string;
    shortTermGoals?: string;
    dailySupports?: string;
    monitoringPlan?: string;
    riskManagement?: string;
    serviceUserName?: string;
  };
};

const resolveDraftDeployment = (userId: string): SupportPlanDeployment | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(SUPPORT_PLAN_GUIDE_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    const drafts: Record<string, StoredDraft> | StoredDraft[] | undefined = parsed?.drafts;
    if (!drafts) {
      return null;
    }
    const draftList: StoredDraft[] = Array.isArray(drafts) ? drafts : Object.values(drafts);
    const match = draftList.find((entry) => {
      if (!entry) return false;
      const entryUserId = entry.userId != null ? String(entry.userId) : null;
      const entryUserCode = entry.userCode?.toString().trim();
      if (entryUserId && entryUserId === userId) {
        return true;
      }
      if (entryUserCode && entryUserCode === userId) {
        return true;
      }
      return false;
    });

    if (!match) {
      return null;
    }

    const planName = (typeof match.name === 'string' && match.name.trim())
      ? match.name.trim()
      : '個別支援計画ドラフト';
    const deployedAt = match.updatedAt && !Number.isNaN(Date.parse(match.updatedAt))
      ? match.updatedAt
      : new Date().toISOString();

    const summarySource =
      match.data?.longTermGoal?.trim() ||
      match.data?.shortTermGoals?.trim() ||
      match.data?.dailySupports?.trim() ||
      'ローカルで作成した個別支援計画ドラフトです。';

    const references: Array<{ label: string; value: string }> = [];
    if (match.data?.longTermGoal) {
      references.push({ label: '長期目標', value: match.data.longTermGoal });
    }
    if (match.data?.shortTermGoals) {
      references.push({ label: '短期目標', value: match.data.shortTermGoals });
    }
    if (match.data?.monitoringPlan) {
      references.push({ label: 'モニタリング', value: match.data.monitoringPlan });
    }
    if (match.data?.riskManagement) {
      references.push({ label: 'リスク対策', value: match.data.riskManagement });
    }

    return {
      planId: `draft-${match.id ?? userId}`,
      planName,
      version: match.updatedAt ? `draft-${new Date(match.updatedAt).toISOString().split('T')[0]}` : 'draft-latest',
      deployedAt,
      author: 'ローカルドラフト',
      summary: summarySource,
      references: references.length ? references.slice(0, 4) : undefined,
      activities: fallbackSupportActivities,
    };
  } catch (error) {
    console.warn('Failed to read support plan guide drafts from storage', error);
    return null;
  }
};

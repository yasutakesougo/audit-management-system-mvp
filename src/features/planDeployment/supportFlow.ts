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

/**
 * ユーザーの支援計画を解決する。
 *
 * 優先順位:
 * 1. storedProcedures（CSVインポート/localStorage から復元されたデータ）
 * 2. ハードコードされたデモ計画（deployedPlans)
 * 3. null（計画なし）
 */
export const resolveSupportFlowForUser = (
  userId: string,
  storedProcedures?: { time: string; activity: string; instruction: string }[] | null,
): SupportPlanDeployment | null => {
  // 1. 動的データがあればそちらを使用
  if (storedProcedures && storedProcedures.length > 0) {
    return {
      planId: `import-${userId}`,
      planName: `${userId} 支援計画`,
      version: '1.0',
      deployedAt: new Date().toISOString(),
      author: 'CSVインポート',
      activities: storedProcedures.map((item) => ({
        time: item.time,
        title: item.activity.split(' - ')[0] || item.activity,
        personTodo: item.activity.includes(' - ')
          ? item.activity.split(' - ').slice(1).join(' - ')
          : item.activity,
        supporterTodo: item.instruction || '支援内容を設定してください',
        stage: inferStageFromTime(item.time),
      })),
      summary: `CSVインポートによる支援計画（${storedProcedures.length}件の活動）`,
    };
  }
  // 2. ハードコードフォールバック
  return deployedPlans[userId] ?? null;
};

/** 時間帯から戦略ステージを推定するヘルパー */
function inferStageFromTime(time: string): SupportStrategyStage {
  const match = time.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return 'proactive';
  const hour = parseInt(match[1], 10);
  if (hour < 11) return 'proactive';
  if (hour < 13) return 'earlyResponse';
  if (hour < 15) return 'proactive';
  return 'postCrisis';
}

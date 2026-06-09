export const RECORD_QUALITY_CATEGORY_IDS = [
  'healthPhysicalCondition',
  'mealsHydration',
  'toileting',
  'sleepFatigue',
  'emotionAnxietyRegulation',
  'communicationRelationships',
  'activityParticipation',
  'workTasksRoles',
  'movementOutings',
  'incidentNearMiss',
  'familyExternalCommunication',
  'staffSupportActions',
  'environmentalFactors',
  'followUpConsiderations',
] as const;

export type RecordQualityCategoryId = (typeof RECORD_QUALITY_CATEGORY_IDS)[number];

export type RecordQualityCategory = {
  id: RecordQualityCategoryId;
  label: string;
  description: string;
  exampleSignals: readonly string[];
  doNotInfer: readonly string[];
};

export type MissingInformationCode =
  | 'scene'
  | 'timing'
  | 'observableAction'
  | 'staffSupportAction'
  | 'userResponseAfterSupport'
  | 'environmentalFactors'
  | 'factsAndInterpretations'
  | 'concreteVagueExpression'
  | 'followUpConsideration';

export type MissingInformationCheck = {
  code: MissingInformationCode;
  label: string;
  present: boolean;
};

export type RecordQualityInput = {
  recordId: string;
  text: string;
};

export type RecordQualityCategoryMatch = {
  categoryId: RecordQualityCategoryId;
  matchedSignals: string[];
};

export type RecordQualitySafetyMetadata = {
  outputKind: 'review-metadata';
  sourceOfTruth: 'original-support-record';
  requiresHumanReview: true;
  suggestionsOnly: true;
  prohibitedActions: readonly [
    'diagnoseUsers',
    'judgeBehavior',
    'overwriteOriginalRecord',
    'automaticallyDetermineSupportPolicy',
    'shareWithoutHumanApproval',
  ];
};

export type RecordQualityReviewDraft = {
  recordId: string;
  originalText: string;
  categoryCandidates: RecordQualityCategoryMatch[];
  missingInformation: MissingInformationCheck[];
  safety: RecordQualitySafetyMetadata;
};

type KeywordRule = {
  categoryId: RecordQualityCategoryId;
  keywords: readonly string[];
};

export const RECORD_QUALITY_TAXONOMY: readonly RecordQualityCategory[] = [
  {
    id: 'healthPhysicalCondition',
    label: 'Health and physical condition',
    description: '体調、痛み、服薬、通院、けが、身体の変化に関する記録。',
    exampleSignals: ['発熱', '咳', '痛み', '顔色', '服薬', '通院', '休憩'],
    doNotInfer: ['病名を決めない', '原因を断定しない', '医療的な判断をしない'],
  },
  {
    id: 'mealsHydration',
    label: 'Meals and hydration',
    description: '食事、水分摂取、食欲、食事中の様子に関する記録。',
    exampleSignals: ['昼食', '食事', '水分', 'コップ', '主食', '副菜', 'むせ'],
    doNotInfer: ['好き嫌いの理由を決めない', '栄養状態を判断しない'],
  },
  {
    id: 'toileting',
    label: 'Toileting',
    description: '排泄、トイレ誘導、失敗、介助、衣類交換に関する記録。',
    exampleSignals: ['トイレ', '排泄', '誘導', '失禁', '衣類交換'],
    doNotInfer: ['失敗の原因を断定しない', '支援量の変更を決めない'],
  },
  {
    id: 'sleepFatigue',
    label: 'Sleep and fatigue',
    description: '睡眠、眠気、疲労、休憩、活動量の変化に関する記録。',
    exampleSignals: ['眠い', '眠気', '疲れ', '横になる', '休憩', '睡眠'],
    doNotInfer: ['睡眠不足の原因を決めない', '意欲の低下として固定しない'],
  },
  {
    id: 'emotionAnxietyRegulation',
    label: 'Emotion, anxiety, and regulation',
    description: '気持ちの揺れ、不安、落ち着きにくさ、気持ちを整える支援に関する記録。',
    exampleSignals: ['不安', '涙', '大きな声', '落ち着く', '入口付近', '表情'],
    doNotInfer: ['感情の理由を断定しない', '性格や特性として決めつけない'],
  },
  {
    id: 'communicationRelationships',
    label: 'Communication and relationships',
    description: '会話、意思表示、職員や他利用者との関わりに関する記録。',
    exampleSignals: ['発言', 'うなずく', '首を横', '会話', '他利用者', '職員'],
    doNotInfer: ['関係性の良し悪しを決めない', '相手の意図を補わない'],
  },
  {
    id: 'activityParticipation',
    label: 'Activity participation',
    description: '日中活動、余暇、プログラム、作業以外の参加状況に関する記録。',
    exampleSignals: ['活動', '参加', '見学', 'プログラム', '余暇'],
    doNotInfer: ['参加しなかった理由を断定しない', '意欲の有無として単純化しない'],
  },
  {
    id: 'workTasksRoles',
    label: 'Work, tasks, and roles',
    description: '作業、係、役割、手順、成果物、職員の支援に関する記録。',
    exampleSignals: ['作業', '手順', '係', '役割', '見本', '説明'],
    doNotInfer: ['能力や適性を判断しない', '作業量や役割変更を決めない'],
  },
  {
    id: 'movementOutings',
    label: 'Movement and outings',
    description: '移動、送迎、外出、施設内外の移動支援に関する記録。',
    exampleSignals: ['外出', '送迎', '移動', '歩行', '乗車', '降車'],
    doNotInfer: ['移動の安全性を決めない', '外出可否を決めない'],
  },
  {
    id: 'incidentNearMiss',
    label: 'Incident and near miss',
    description: '事故、ヒヤリ、けがにつながりそうだった出来事などに関する記録。',
    exampleSignals: ['転倒', 'けが', 'ヒヤリ', '破損', '報告', '急な体調変化'],
    doNotInfer: ['原因や責任を決めない', '重要度や報告要否を確定しない'],
  },
  {
    id: 'familyExternalCommunication',
    label: 'Family or external communication',
    description: '家族、相談支援、医療機関、学校、他事業所などとの連絡に関する記録。',
    exampleSignals: ['家族', '保護者', '相談支援', '医療機関', '学校', '連絡'],
    doNotInfer: ['家庭事情を広げない', '外部共有内容を決めない'],
  },
  {
    id: 'staffSupportActions',
    label: 'Staff support actions',
    description: '職員が行った支援、声かけ、環境調整、見守り、介助に関する記録。',
    exampleSignals: ['声かけ', '見守り', '介助', '提案', '説明', '環境調整'],
    doNotInfer: ['支援の良し悪しを判断しない', '職員評価に使わない'],
  },
  {
    id: 'environmentalFactors',
    label: 'Environmental factors',
    description: '場所、音、人数、予定変更、天候、物品、座席、時間帯などに関する記録。',
    exampleSignals: ['予定変更', '音', '人数', '天候', '座席', '場所', '作業室'],
    doNotInfer: ['環境が原因だと断定しない', '本人の反応との関係を確定しない'],
  },
  {
    id: 'followUpConsiderations',
    label: 'Follow-up considerations',
    description: '次回確認、申し送り、会議で扱う確認観点に関する記録。',
    exampleSignals: ['次回', '申し送り', '確認', '共有', '会議'],
    doNotInfer: ['方針を確定しない', '会議結論として扱わない'],
  },
] as const;

export const RECORD_QUALITY_SAFETY_METADATA: RecordQualitySafetyMetadata = {
  outputKind: 'review-metadata',
  sourceOfTruth: 'original-support-record',
  requiresHumanReview: true,
  suggestionsOnly: true,
  prohibitedActions: [
    'diagnoseUsers',
    'judgeBehavior',
    'overwriteOriginalRecord',
    'automaticallyDetermineSupportPolicy',
    'shareWithoutHumanApproval',
  ],
};

const KEYWORD_RULES: readonly KeywordRule[] = [
  { categoryId: 'healthPhysicalCondition', keywords: ['発熱', '咳', '痛み', '顔色', '服薬', '通院', '体調'] },
  { categoryId: 'mealsHydration', keywords: ['食事', '昼食', '水分', 'コップ', '主食', '副菜', 'むせ'] },
  { categoryId: 'toileting', keywords: ['トイレ', '排泄', '誘導', '失禁', '衣類交換'] },
  { categoryId: 'sleepFatigue', keywords: ['眠い', '眠気', '疲れ', '横になる', '休憩', '睡眠'] },
  { categoryId: 'emotionAnxietyRegulation', keywords: ['不安', '涙', '大きな声', '落ち着く', '表情'] },
  { categoryId: 'communicationRelationships', keywords: ['発言', 'うなず', '首を横', '会話', '他利用者'] },
  { categoryId: 'activityParticipation', keywords: ['活動', '参加', '見学', 'プログラム', '余暇'] },
  { categoryId: 'workTasksRoles', keywords: ['作業', '手順', '係', '役割', '見本'] },
  { categoryId: 'movementOutings', keywords: ['外出', '送迎', '移動', '歩行', '乗車', '降車'] },
  { categoryId: 'incidentNearMiss', keywords: ['転倒', 'けが', 'ヒヤリ', '破損', '報告'] },
  { categoryId: 'familyExternalCommunication', keywords: ['家族', '保護者', '相談支援', '医療機関', '学校', '連絡'] },
  { categoryId: 'staffSupportActions', keywords: ['職員', '声かけ', '見守り', '介助', '提案', '説明'] },
  { categoryId: 'environmentalFactors', keywords: ['予定変更', '音', '人数', '天候', '座席', '場所', '作業室'] },
  { categoryId: 'followUpConsiderations', keywords: ['次回', '申し送り', '確認', '共有', '会議'] },
];

const MISSING_INFORMATION_RULES: readonly {
  code: MissingInformationCode;
  label: string;
  keywords: readonly string[];
}[] = [
  { code: 'scene', label: '場面や状況', keywords: ['作業室', '食堂', '外出', '活動', '昼食', 'トイレ'] },
  { code: 'timing', label: '時刻や時間帯', keywords: ['午前', '午後', '頃', ':', '時', '分'] },
  { code: 'observableAction', label: '観察可能な本人の行動', keywords: ['移動', '座', '発言', 'うなず', '首を横', '食べ', '飲'] },
  { code: 'staffSupportAction', label: '職員の支援内容', keywords: ['職員', '声かけ', '提案', '説明', '見守り', '介助'] },
  { code: 'userResponseAfterSupport', label: '支援後の本人の反応', keywords: ['その後', '支援後', '声かけると', '伝えると', 'うなず'] },
  { code: 'environmentalFactors', label: '関係する環境要因', keywords: ['予定変更', '音', '人数', '場所', '天候', '座席'] },
  { code: 'factsAndInterpretations', label: '事実と解釈の分離', keywords: ['確認', '発言', '表情', '職員', '本人'] },
  { code: 'concreteVagueExpression', label: 'あいまいな表現の具体化', keywords: ['不安定', 'いつも通り', '拒否', 'パニック', '問題なし'] },
  { code: 'followUpConsideration', label: '次回確認や申し送り', keywords: ['次回', '申し送り', '共有', '会議', '確認'] },
];

export function classifyRecordQuality(input: RecordQualityInput): RecordQualityReviewDraft {
  const normalizedText = input.text.trim();

  return {
    recordId: input.recordId,
    originalText: input.text,
    categoryCandidates: findCategoryCandidates(normalizedText),
    missingInformation: checkMissingInformation(normalizedText),
    safety: RECORD_QUALITY_SAFETY_METADATA,
  };
}

export function findCategoryCandidates(text: string): RecordQualityCategoryMatch[] {
  return KEYWORD_RULES.map(rule => {
    const matchedSignals = rule.keywords.filter(keyword => text.includes(keyword));
    return matchedSignals.length > 0 ? { categoryId: rule.categoryId, matchedSignals } : null;
  }).filter((match): match is RecordQualityCategoryMatch => match !== null);
}

export function checkMissingInformation(text: string): MissingInformationCheck[] {
  return MISSING_INFORMATION_RULES.map(rule => {
    const hasSignal = rule.keywords.some(keyword => text.includes(keyword));
    const present = rule.code === 'concreteVagueExpression' ? !hasSignal : hasSignal;
    return {
      code: rule.code,
      label: rule.label,
      present,
    };
  });
}

export function getRecordQualityCategory(
  categoryId: RecordQualityCategoryId,
): RecordQualityCategory {
  const category = RECORD_QUALITY_TAXONOMY.find(item => item.id === categoryId);
  if (!category) {
    throw new Error(`Unknown record quality category: ${categoryId}`);
  }
  return category;
}

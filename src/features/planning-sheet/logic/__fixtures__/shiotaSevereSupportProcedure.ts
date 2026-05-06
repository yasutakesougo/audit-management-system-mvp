import type { SupportPlanningSheet } from '@/domain/isp/schema/ispPlanningSheetSchema';

/**
 * 塩田 裕貴さんの「重度加算・外出入り」対応支援計画シート（17行モデル検証用）
 * 
 * 特徴:
 * - 17行すべての手順ステップ (procedureSteps) を持つ
 * - RowNo 1〜15 (通常日課) + 16〜17 (外活動)
 * - 時間帯 (timing) にテンプレートとの微差あり (例: 9:40頃)
 * - RowNo 13 に独自活動 (ダンスタイム)
 * - 外活動 (16, 17) を明示的に含む
 */
export const SHIODA_SEVERE_SUPPORT_SHEET: SupportPlanningSheet = {
  id: 'sheet-shioda-001',
  userId: 'I016',
  ispId: 'isp-shioda-2026',
  title: '2026年度 個別支援計画（塩田裕貴）',
  supportPolicy: '見通しを持って落ち着いて活動に取り組む。ハサミ以外の没頭できる活動の探索。',
  environmentalAdjustments: 'スケジュール表の提示。クールダウン場所の確保。',
  concreteApproaches: '写真カードによる選択肢提示。本人の表情や動作からのフィードバック収集。',
  observationFacts: 'ハサミに没頭すると切り替えが困難。音楽への反応が良い。',
  interpretationHypothesis: '視覚的提示により見通しが持てれば、活動の切り替えがスムーズになる。',
  supportIssues: '活動の切り替えと、興味関心の拡大。',
  status: 'active',
  isCurrent: true,
  authoredByStaffId: 'staff-watanabe', // 渡辺 宗吾
  authoredByQualification: 'practical_training',
  applicableServiceType: 'other',
  applicableAddOnTypes: ['severe_disability_support'],
  monitoringCycleDays: 90,
  regulatoryBasisSnapshot: {
    supportLevel: 4,
    behaviorScore: 15,
    serviceType: '生活介護',
    eligibilityCheckedAt: '2026-04-01',
  },
  intake: {
    presentingProblem: '',
    targetBehaviorsDraft: [],
    behaviorItemsTotal: 15,
    incidentSummaryLast30d: '',
    communicationModes: ['写真カード'],
    sensoryTriggers: ['大きな音'],
    medicalFlags: [],
    consentScope: [],
    consentDate: '2026-04-01',
  },
  assessment: {
    targetBehaviors: [],
    abcEvents: [],
    hypotheses: [],
    riskLevel: 'medium',
    healthFactors: [],
    teamConsensusNote: '',
  },
  planning: {
    procedureSteps: [
      { order: 1, timing: '09:40頃', instruction: '通所・朝の準備', staff: '様子を確認し見守る', activityDetail: '手洗い、消毒。荷物を入れる。', instructionDetail: '通所時の様子を確認し、必要に応じて声かけを行う。', condition: '笑顔で入室' },
      { order: 2, timing: '10:00頃', instruction: '体操', staff: '促す', activityDetail: '体操に参加する', instructionDetail: '本人の様子を見ながら参加を促す' },
      { order: 3, timing: '10:10頃', instruction: 'スケジュール確認', staff: '一緒に確認', activityDetail: '予定を見る', instructionDetail: '本人と一緒に予定を確認し、見通しが持てるよう支援する' },
      { order: 4, timing: '10:15頃', instruction: 'お茶休憩', staff: '準備', activityDetail: 'お茶を飲む', instructionDetail: 'お茶の準備、片付けを行う' },
      { order: 5, timing: '10:20〜12:00', instruction: 'AM日中活動', staff: '見守り', activityDetail: '午前の活動に参加する', instructionDetail: '必要に応じて声かけ、見守りを行う' },
      { order: 6, timing: '12:00', instruction: '昼食準備', staff: '支援', activityDetail: '手洗い、配膳', instructionDetail: '手洗い・配膳を見守り、必要に応じて支援する' },
      { order: 7, timing: '12:10〜12:40', instruction: '昼食', staff: '介助', activityDetail: '昼食を食べる', instructionDetail: '食事の様子を見守り、必要に応じて介助を行う' },
      { order: 8, timing: '12:40〜13:45', instruction: '昼休み', staff: '見守り', activityDetail: '休憩時間を過ごす', instructionDetail: '休憩中の様子を見守る' },
      { order: 9, timing: '13:45', instruction: 'スケジュール確認', staff: '確認', activityDetail: '午後の予定を確認する', instructionDetail: '本人と一緒に午後の予定を確認する' },
      { order: 10, timing: '13:45〜14:30', instruction: 'PM日中活動', staff: '同行', activityDetail: '午後の活動に参加する', instructionDetail: '必要に応じて同行支援を行う' },
      { order: 11, timing: '14:30〜14:45', instruction: 'お茶休憩', staff: '準備', activityDetail: 'お茶を飲む', instructionDetail: 'お茶の準備、片付けを行う' },
      { order: 12, timing: '14:45〜15:20', instruction: 'PM日中活動', staff: '同行', activityDetail: '午後の活動に参加する', instructionDetail: '必要に応じて同行支援を行う' },
      { order: 13, timing: '15:20〜15:40', instruction: 'のんびりタイム・ダンスタイム', staff: '好きな曲をかける', activityDetail: 'ダンスを踊る。音楽に合わせて動く。', instructionDetail: '本人の好きな曲をかけ、一緒に楽しむ。', condition: 'ダンスが好き。' },
      { order: 14, timing: '15:40〜16:00', instruction: '帰りの準備', staff: '支援', activityDetail: '帰宅準備を行う', instructionDetail: '身支度を見守り、必要に応じて支援する' },
      { order: 15, timing: '16:00', instruction: '退所', staff: '見送り', activityDetail: '退所する', instructionDetail: '退所時の様子を確認し、見送りを行う' },
      { order: 16, timing: '10:20/13:45〜', instruction: '外活動準備', staff: 'トイレ、帽子の準備', activityDetail: '外活動に向けた準備を行う', instructionDetail: 'トイレ、帽子、持ち物など外活動に必要な準備を支援する' },
      { order: 17, timing: '10:25/13:50〜', instruction: '外活動', staff: '安全確認', activityDetail: '外活動に参加する', instructionDetail: '外活動中の安全確認、同行支援、見守りを行う' },
    ],
    supportPriorities: [],
    antecedentStrategies: [],
    teachingStrategies: [],
    consequenceStrategies: [],
    crisisThresholds: null,
    restraintPolicy: 'prohibited_except_emergency',
    reviewCycleDays: 180,
  },
  version: 1,
  targetScene: '日中活動',
  targetDomain: '生活介護',
  collectedInformation: '家族からの聞き取り。前年度の計画書。',
  supportStartDate: '2026-04-01',
  deliveredToUserAt: '2026-04-05',
  reviewedAt: '2026-04-10',
  hasMedicalCoordination: false,
  hasEducationCoordination: false,
  authoredAt: '2026-04-10',
  appliedFrom: '2026-04-01',
  nextReviewAt: '2026-09-30',
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
  createdBy: 'staff-watanabe',
  updatedBy: 'staff-watanabe',
};

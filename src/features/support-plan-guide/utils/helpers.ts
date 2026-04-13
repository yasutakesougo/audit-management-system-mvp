/**
 * SupportPlanGuide — 純粋ヘルパー関数
 *
 * 日付計算、フォーム操作、期限算出、セクション設定等を
 * SupportPlanGuidePage.tsx から抽出。
 * 振る舞いの変更は一切なし（純粋リファクタリング）。
 */
import type { IUserMaster } from '@/features/users/types';
import type { DeadlineInfo, SectionConfig, SectionKey, SupportPlanDraft, SupportPlanForm, SupportPlanStringFieldKey } from '../types';
import { TabGroupKey } from '../domain/tabRoute';
import { defaultFormState, FIELD_KEYS, FIELD_LIMITS, NAME_LIMIT, REQUIRED_FIELDS } from '../types';
import { toLocalDateISO } from '@/utils/getNow';
import { formatDateYmd } from '@/lib/dateFormat';

// ────────────────────────────────────────────
// 日付ヘルパー
// ────────────────────────────────────────────

export const toDate = (s: string | undefined) => {
  if (!s) return undefined;
    const m = s.match(/(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})/);
  if (!m) return undefined;
  const [_, y, mo, d] = m;
  const dt = new Date(Number(y), Number(mo) - 1, Number(d));
  return Number.isNaN(dt.getTime()) ? undefined : dt;
};

export const parsePlanPeriod = (period: string): { start?: Date; end?: Date } => {
  if (!period) return {};
  const parts = period.split(/~|〜/).map((s) => s.trim());
  return { start: toDate(parts[0]), end: toDate(parts[1]) };
};

export const addMonths = (date: Date, months: number) => {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  // handle month-end overflow
  if (d.getDate() < day) d.setDate(0);
  return d;
};


export const daysDiff = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));

export const todayYmd = () => toLocalDateISO();
export const minusDaysYmd = (ymd: string, days: number) => {
  const d = new Date(ymd);
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
};

// ────────────────────────────────────────────
// 期限計算
// ────────────────────────────────────────────

export const computeDeadlineInfo = (form: SupportPlanForm): { creation: DeadlineInfo; monitoring: DeadlineInfo } => {
  const now = new Date();
  const { start, end } = parsePlanPeriod(form.planPeriod);

  // 作成期限: 計画期間の開始日 + 30日
  let creationDate: Date | undefined = start ? new Date(start) : undefined;
  if (creationDate) creationDate = new Date(creationDate.getTime() + 30 * 24 * 60 * 60 * 1000);
  const creationDaysLeft = creationDate ? daysDiff(creationDate, now) : undefined;
  let creationColor: DeadlineInfo['color'] = 'default';
  if (creationDaysLeft !== undefined) {
    if (creationDaysLeft < 0) creationColor = 'error';
    else if (creationDaysLeft <= 7) creationColor = 'warning';
    else creationColor = 'success';
  }

  // 次回モニタ期限: 直近モニタ実施日 + 6か月（無ければ計画開始 + 6か月）
  const lastMon = toDate(form.lastMonitoringDate);
  let monitoringDate: Date | undefined = lastMon ? addMonths(lastMon, 6) : start ? addMonths(start, 6) : undefined;
  if (monitoringDate && end && end.getTime() < monitoringDate.getTime()) monitoringDate = end;
  const monitoringDaysLeft = monitoringDate ? daysDiff(monitoringDate, now) : undefined;
  let monitoringColor: DeadlineInfo['color'] = 'default';
  if (monitoringDaysLeft !== undefined) {
    if (monitoringDaysLeft < 0) monitoringColor = 'error';
    else if (monitoringDaysLeft <= 14) monitoringColor = 'warning';
    else monitoringColor = 'success';
  }

  return {
    creation: {
      label: '作成期限(開始+30日)',
      date: creationDate,
      daysLeft: creationDaysLeft,
      color: creationColor,
      tooltip: creationDate ? `期限: ${formatDateYmd(creationDate)} / 残り: ${creationDaysLeft}日` : '計画期間(開始日)が未入力',
    },
    monitoring: {
      label: '次回モニタ期限(6か月)',
      date: monitoringDate,
      daysLeft: monitoringDaysLeft,
      color: monitoringColor,
      tooltip: monitoringDate ? `期限: ${formatDateYmd(monitoringDate)} / 残り: ${monitoringDaysLeft}日` : '計画期間(開始日)が未入力',
    },
  };
};

// ────────────────────────────────────────────
// フォーム操作ヘルパー
// ────────────────────────────────────────────

export const sanitizeValue = (value: string, limit: number) => (value.length > limit ? value.slice(0, limit) : value);

export const createEmptyForm = (): SupportPlanForm => ({ ...defaultFormState });

export const createDraft = (name: string): SupportPlanDraft => {
  const timestamp = new Date().toISOString();
  const id = `draft-${timestamp}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    name,
    createdAt: timestamp,
    updatedAt: timestamp,
    userId: null,
    userCode: null,
    data: createEmptyForm(),
  };
};

export const createDraftForUser = (user: IUserMaster): SupportPlanDraft => {
  const baseName = user.FullName?.trim() || user.UserID?.trim() || `利用者 ${user.Id}`;
  const sanitizedName = sanitizeValue(baseName, NAME_LIMIT);
  const draft = createDraft(sanitizedName);
  draft.name = sanitizedName;
  draft.userId = user.Id;
  draft.userCode = user.UserID ?? null;
  draft.data = {
    ...createEmptyForm(),
    serviceUserName: sanitizedName,
  };
  return draft;
};

export const sanitizeForm = (data: Partial<SupportPlanForm> | undefined): SupportPlanForm => {
  const sanitized = createEmptyForm();
  if (!data) {
    return sanitized;
  }
  FIELD_KEYS.forEach((key) => {
    const value = data[key];
    if (typeof value === 'string') {
      sanitized[key] = sanitizeValue(value, FIELD_LIMITS[key]);
    }
  });

  // 構造化目標データの保持
  if (Array.isArray(data.goals)) {
    sanitized.goals = data.goals;
  }

  // コンプライアンスメタデータの保持
  if (data.compliance) {
    sanitized.compliance = data.compliance;
  }

  return sanitized;
};

export const computeRequiredCompletion = (form: SupportPlanForm) =>
  Math.round(
    (REQUIRED_FIELDS.reduce((count, key) => (form[key].trim() ? count + 1 : count), 0) / REQUIRED_FIELDS.length) * 100,
  );

export const computeFilledCount = (form: SupportPlanForm) =>
  FIELD_KEYS.reduce((count, key) => (form[key].trim() ? count + 1 : count), 0);

export type ReadinessInfo = {
  isReady: boolean;
  completionProgress: number;
  missingLabels: string[];
  guidance: Array<{ tip: string; example: string }>;
};

/**
 * ワークフロー（フェーズ）の準備完了判定（詳細版）
 */
export const getGroupReadinessInfo = (groupKey: TabGroupKey, form: SupportPlanForm): ReadinessInfo => {
  const checkField = (key: SupportPlanStringFieldKey) => {
    const isFilled = (form[key]?.trim().length ?? 0) > 0;
    const config = SECTIONS.flatMap(s => s.fields).find(f => f.key === key);
    return { isFilled, key, label: config?.label ?? key, guidance: config?.guidance };
  };

  const requiredFieldsMap: Record<TabGroupKey, SupportPlanStringFieldKey[]> = {
    assessment: ['assessmentSummary'],
    isp: ['serviceUserName', 'supportLevel', 'planPeriod', 'decisionSupport'],
    operations: ['monitoringPlan'],
    ibd: ['assessmentSummary'],
    output: [],
  };

  const fields = requiredFieldsMap[groupKey] || [];
  if (fields.length === 0) {
    return { isReady: true, completionProgress: 100, missingLabels: [], guidance: [] };
  }

  const results = fields.map(checkField);
  const filledCount = results.filter(r => r.isFilled).length;
  const isReady = filledCount === fields.length;
  const completionProgress = Math.round((filledCount / fields.length) * 100);
  const missing = results.filter(r => !r.isFilled);

  return {
    isReady,
    completionProgress,
    missingLabels: missing.map(m => m.label),
    guidance: missing.map(m => m.guidance).filter((g): g is NonNullable<typeof g> => !!g),
  };
};

/** @deprecated Use getGroupReadinessInfo instead */
export const checkGroupReadiness = (groupKey: TabGroupKey, form: SupportPlanForm): boolean => 
  getGroupReadinessInfo(groupKey, form).isReady;

// ────────────────────────────────────────────
// セクション設定（タブ構成）
// ────────────────────────────────────────────

export const SECTIONS: SectionConfig[] = [
  {
    key: 'overview',
    label: '基本情報',
    description: '利用者情報と計画期間の骨組みを押さえます。契約内容や医療留意点を簡潔に記載してください。',
    fields: [
      {
        key: 'serviceUserName',
        label: '利用者名 / ID',
        required: true,
        placeholder: '例: 山田 太郎（ID: U123）',
        helper: '本人確認に必要な情報を記載。イニシャル等でも可。',
      },
      {
        key: 'supportLevel',
        label: '支援区分・医療リスク等',
        required: true,
        placeholder: '例: 支援区分4 / 医療的ケア（胃ろう・吸引） / 福祉機器利用あり',
        helper: '障害支援区分や医療連携の要点、合理的配慮の必要性など。',
        quickPhrases: [
          '支援区分:  ／ 主治医:  ／ 服薬:  ／ アレルギー: ',
          '合理的配慮: 視覚情報を強化／静かな環境での説明／選択肢を絵カードで提示',
        ],
      },
      {
        key: 'planPeriod',
        label: '計画期間',
        required: true,
        placeholder: '例: 2025/04/01 〜 2026/03/31（12か月）',
        helper: '初回は契約後1か月以内の作成、以降6か月以内を目安に更新します。',
        quickPhrases: ['初回作成:  年 月 日 ／ 次回見直し目安:  年 月 日'],
      },
      {
        key: 'serviceStartDate',
        label: '契約上のサービス開始日',
        placeholder: 'YYYY-MM-DD',
        helper: '重要事項説明書等で合意された契約日。',
      },
      {
        key: 'firstServiceDate',
        label: '実際のサービス初回提供日',
        placeholder: 'YYYY-MM-DD',
        helper: '実際にサービス提供を開始した日。',
      },
      {
        key: 'attendingDays',
        label: '通所日数・時間',
        placeholder: '例: 通所日:月〜金 週5日 ／ 時間:10:00-16:30 (6.5時間)',
        helper: '計画書上部に出力される、標準的な利用条件です。',
        quickPhrases: ['通所日: 月〜金 週5日', '支援時間: 6.5時間'],
      },
      {
        key: 'medicalConsiderations',
        label: '医療的配慮事項',
        minRows: 3,
        placeholder: '例: 注入時の排気、嚥下状態に応じた食事提供、吸引頻度…',
        helper: '主治医等の指示に基づき、安全なサービス提供のために必要な配慮。',
      },
    ],
  },
  {
    key: 'assessment',
    label: 'アセスメント',
    description: '生活歴・健康・本人意向などのアセスメント所見を整理します。',
    fields: [
      {
        key: 'assessmentSummary',
        label: 'ニーズ・課題の要約',
        required: true,
        minRows: 4,
        placeholder: '例: 生活リズムは安定しているが、他者交流に不安が強い…',
        helper: '健康、生活歴、本人の希望、家族意向、支援課題を含めましょう。',
        guidance: {
          tip: 'まずは「今、本人が一番困っていること」を一つ書いてください。',
          example: '例：騒音が多い場所でのパニック、特定の時間帯の拒絶など。',
        },
        quickPhrases: ['生活歴: ', '健康・医療: ', '本人の希望: ', '家族・相談支援の意向: '],
      },
      {
        key: 'strengths',
        label: '強み・活用資源',
        minRows: 3,
        placeholder: '例: 音楽活動への意欲が高く、家族の送迎支援が安定している…',
        helper: '本人の得意なこと、利用できる社会資源、多職種支援など。',
        quickPhrases: ['本人の強み: ', '家族・地域資源: ', '既存支援: '],
      },
    ],
  },
  {
    key: 'smart',
    label: 'SMART目標',
    description: 'SMARTフレームで長期・短期目標を明確化します。',
    fields: [],
  },
  {
    key: 'supports',
    label: '支援内容',
    description: '日中支援や創作活動など具体的な提供内容を記載します。',
    fields: [
      {
        key: 'userRole',
        label: '本人の役割・約束',
        minRows: 3,
        placeholder: '例: 片付けを最後までする、挨拶を自分からする、困った時は職員に声をかける…',
        helper: '本人が計画の中で取り組む具体的な役割や行動指針。',
        guidance: {
          tip: '「〇〇してもらう」支援だけでなく、本人が「何をするか」という主体的な役割を記載します。',
          example: '例：昼食の配膳を担当する。感情が高ぶったら一人でクールダウンする。',
        },
      },
    ],
  },
  {
    key: 'safety',
    label: '安全管理・緊急時対応',
    description: '事故防止、緊急時対応、権利擁護など、すべての利用者に共通する安全確保の取り組みを整理します。',
    fields: [
      {
        key: 'emergencyResponsePlan',
        label: '緊急時対応手順',
        required: true,
        minRows: 3,
        placeholder: '例: 急変時は主治医へ連絡、パニック時はリラックススペースへ誘導…',
        helper: '急変時、負傷時、行方不明時等の具体的な連絡先と基本手順。',
      },
      {
        key: 'rightsAdvocacy',
        label: '権利擁護・身体拘束廃止の取り組み',
        minRows: 2,
        placeholder: '例: 身体拘束の禁止を徹底、セルフネグレクトの兆候チェック…',
        helper: '本人の尊厳を守るための配慮や、不適切なケアの防止策。',
        quickPhrases: [
          '身体拘束廃止の徹底: 指導員による自己点検を月次実施',
          '重要説明: 生命の危惧を伴う緊急時は、やむを得ず抑制等の行為を行う場合がある旨を説明し同意取得済み',
        ],
      },
      {
        key: 'riskManagement',
        label: '事故防止・ヒヤリハット対策',
        minRows: 3,
        placeholder: '例: 服薬確認を2名で実施、送迎時の昇降補助の徹底…',
        helper: '具体的なヒヤリハット事例への再発防止策など。',
      },
    ],
  },
  {
    key: 'decision',
    label: '意思決定支援',
    description: '本人の意思決定支援プロセスと会議の記録を整理します。',
    fields: [
      {
        key: 'decisionSupport',
        label: '意思決定支援の工夫',
        required: true,
        minRows: 4,
        placeholder: '例: 写真カードで選択肢提示／体験参加でフィードバック収集…',
        helper: '厚労省ガイドラインに沿って、理解しやすい説明や代弁手順を明記。',
        guidance: {
          tip: '意思決定を支えるために、本人が「選べる」工夫を一つ選んでください。',
          example: '例：写真を提示して好きな方を選んでもらう。体験後に感想を聞く。',
        },
        quickPhrases: ['理解容易化: 図解／ピクトグラム／Plain Language', '選択肢提示: 体験参加／試行期間／第三者意見'],
      },
      {
        key: 'conferenceNotes',
        label: 'サービス担当者会議・同意の記録',
        minRows: 3,
        placeholder: '例: 2025/03/15 サービス担当者会議（本人・家族・相談支援・PT参加）…',
        helper: '参加者、合意事項、未決課題、同意日、交付方法を記載。',
        quickPhrases: ['開催日:  ／ 参加者: 本人／家族／相談支援専門員／医師 等', '同意・交付:  年 月 日（本人・家族へ交付済み）'],
      },
    ],
  },
  {
    key: 'compliance',
    label: '同意・交付',
    description: '計画の説明・同意取得・交付記録を管理します。生活介護の監査で必須となる証跡です。',
    fields: [],
  },
  {
    key: 'monitoring',
    label: 'モニタリング',
    description: '進捗確認と見直しタイミング、評価指標を整理します。',
    fields: [
      {
        key: 'monitoringPlan',
        label: 'モニタリング手法',
        required: true,
        minRows: 4,
        placeholder: '例: 月1回面談＋支援記録レビュー／家族ヒアリング／記録データ分析…',
        helper: '面談頻度、活用する記録、評価指標、担当者を明記してください。',
        guidance: {
          tip: '目標が達成されたか、いつ・誰が・どうやって確認するかを決めます。',
          example: '例：月1回の個別面談。サービス日誌の「できるようになった」チェックを毎週集計。',
        },
        quickPhrases: [
          '面談頻度: 月 回（初回3か月は隔週）',
          '評価指標: 参加率／本人満足／職員アンケート',
          '分析方法: 記録ダッシュボード／チェックリスト／ケース会議',
        ],
      },
      {
        key: 'reviewTiming',
        label: '見直しタイミング・判断基準',
        minRows: 3,
        placeholder: '例: 半年ごとに再評価／未達が2期続いた場合は臨時会議…',
        helper: '法定期限・臨時見直し条件・代替案の検討フローなど。',
        quickPhrases: ['定期見直し: 6か月ごと', '臨時見直し:  ／ トリガー: 参加率◯%未満／事故報告 等'],
      },
      {
        key: 'lastMonitoringDate',
        label: '直近のモニタ実施日',
        placeholder: '例: 2025/10/21（YYYY/MM/DD）',
        helper: '次回モニタ期限は「直近のモニタ実施日 + 6か月」で自動算出（未入力時は計画開始日から算出）。',
        quickPhrases: ['YYYY/MM/DD'],
      },
    ],
  },
  {
    key: 'risk',
    label: '強度行動障害支援計画 (IBDシート)',
    description: '強度行動障害支援加算等の算定に必要な「支援計画シート」の内容を構成します。',
    fields: [
      {
        key: 'ibdEnvAdjustment',
        label: '環境調整・コミュニケーション支援',
        required: true,
        minRows: 4,
        placeholder: '例: 構造化（ついたて設置）、視覚的スケジュール提示、イヤーマフの使用…',
        helper: '本人が安心して過ごせるための物理的環境、情報の伝え方の工夫。',
        guidance: {
          tip: '本人がパニックにならないために「変えられる外部環境」を一つ書いてください。',
          example: '例：机の向きを変える。BGMを消す。手順を写真で見せる。',
        },
        quickPhrases: ['物理的配慮: ついたて設置／個別スペース確保', '情報提示: スケジュール表／写真カード／タイマー活用'],
      },
      {
        key: 'ibdPbsStrategy',
        label: '肯定的行動支援 (PBS) ・対応手順',
        minRows: 3,
        placeholder: '例: 落ち着かない時はリラックスルームへの誘導、本人の好きな音楽を流す…',
        helper: 'パニックの前兆への対応、爆発した際の見守り手順、事後のクールダウン。',
        guidance: {
          tip: '問題行動を叱るのではなく、本人が「良い行動」を取れるための支援を考えます。',
          example: '例：落ち着いている時に積極的に声をかける。リラックスできるアイテムを準備する。',
        },
      },
      {
        key: 'complianceControls',
        label: '証跡・ダブルチェック手順',
        minRows: 3,
        placeholder: '例: 交付チェックリスト／職員2名確認／SharePoint版管理…',
        helper: '証跡保管、権限管理、バックアップ方法などを記載。',
        quickPhrases: ['証跡: SharePoint記録／紙原本スキャン保存', 'ダブルチェック: サビ管＋主任が同意書を確認'],
      },
    ],
  },
  {
    key: 'excellence',
    label: 'PDCA・改善記録',
    description: 'モニタリング結果に基づく改善提案や、多職種連携を通じた氷山分析（Iceberg）の深化など、支援の質向上に向けた記録を行います。',
    fields: [
      {
        key: 'improvementIdeas',
        label: '改善提案 / 次のアクション',
        minRows: 4,
        placeholder: '例: 利用者満足度サーベイ導入／相談支援事業所との月次連携会議を提案…',
        helper: 'データ活用、研修計画、多職種連携など自由に記録してください。',
        quickPhrases: [
          'データ活用: Power BIで支援記録可視化',
          '人材育成: 月次ケーススタディ勉強会',
          '外部連携: 相談支援専門員／医療機関との定例会議',
        ],
      },
    ],
  },
  {
    key: 'preview',
    label: 'プレビュー',
    description: 'Markdownで出力内容を確認し、必要に応じてコピーやダウンロードを行います。',
    fields: [],
  },
];

export const findSection = (key: SectionKey) => SECTIONS.find((section) => section.key === key);

export const findSectionKeyByFieldKey = (fieldKey: string): SectionKey | undefined => 
  SECTIONS.find((s) => s.fields.some((f) => f.key === fieldKey))?.key;

export const TAB_ORDER: SectionKey[] = ['overview', 'assessment', 'smart', 'supports', 'safety', 'decision', 'compliance', 'monitoring', 'risk', 'excellence', 'preview'];

export const TAB_SECTIONS = TAB_ORDER.map((key) => ({
  key,
  label: findSection(key)?.label ?? key,
}));

// ── group.sub ルーティング (P1.5 SSOT) ──
// P1-B で UI 層が TAB_GROUPS を直接参照するための re-export
export { TAB_GROUPS, getAllSubsFlat } from '../domain/tabRoute';
export type { TabGroupKey, TabGroupDef, SupportPlanTabRoute } from '../domain/tabRoute';

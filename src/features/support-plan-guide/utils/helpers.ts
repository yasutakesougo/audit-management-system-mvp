/**
 * SupportPlanGuide — 純粋ヘルパー関数
 *
 * 日付計算、フォーム操作、期限算出、セクション設定等を
 * SupportPlanGuidePage.tsx から抽出。
 * 振る舞いの変更は一切なし（純粋リファクタリング）。
 */
import type { IUserMaster } from '@/features/users/types';
import type { DeadlineInfo, SectionConfig, SectionKey, SupportPlanDraft, SupportPlanForm } from '../types';
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
    fields: [],
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
    label: 'コンプライアンス・減算対策',
    description: '計画書遅延や同意取得漏れなど、運営指導で指摘されやすいリスクを洗い出し、対応策を整理します。',
    fields: [
      {
        key: 'riskManagement',
        label: '主なリスクと対応策',
        required: true,
        minRows: 4,
        placeholder: '例: 初回30日以内未作成 → 契約アラート設定／議事録テンプレ活用…',
        helper: '遅延、本人不参加、同意未取得、モニタ未実施などの対策を列挙。',
        quickPhrases: ['リスク: 作成遅延／対策: タスク自動通知', 'リスク: 同意書未保管／対策: 電子署名ログ保存'],
      },
      {
        key: 'emergencyResponsePlan',
        label: '緊急時対応計画',
        minRows: 3,
        placeholder: '例: 喘息発作時は吸入器を使用、家族・主治医へ即時連絡…',
        helper: '急変時、パニック時等の具体的な連絡先と対応手順。',
      },
      {
        key: 'rightsAdvocacy',
        label: '権利擁護・虐待防止',
        minRows: 2,
        placeholder: '例: 身体拘束の禁止を徹底、セルフプランの推奨…',
        helper: '虐待防止、セルフネグレクト対応、意思決定支援の具体的な取り組み。',
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
    label: '改善メモ・連携',
    description: '次回計画に活かす改善提案や、多職種・外部機関との連携アイデアをメモします。',
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

export const TAB_ORDER: SectionKey[] = ['overview', 'assessment', 'smart', 'supports', 'decision', 'compliance', 'monitoring', 'risk', 'excellence', 'preview'];

export const TAB_SECTIONS = TAB_ORDER.map((key) => ({
  key,
  label: findSection(key)?.label ?? key,
}));

// ── group.sub ルーティング (P1.5 SSOT) ──
// P1-B で UI 層が TAB_GROUPS を直接参照するための re-export
export { TAB_GROUPS, getAllSubsFlat } from '../domain/tabRoute';
export type { TabGroupKey, TabGroupDef, SupportPlanTabRoute } from '../domain/tabRoute';

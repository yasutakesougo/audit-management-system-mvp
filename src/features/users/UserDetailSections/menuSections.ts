import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded';
import PersonAddRoundedIcon from '@mui/icons-material/PersonAddRounded';
import PsychologyIcon from '@mui/icons-material/Psychology';
import SupportIcon from '@mui/icons-material/Support';
import type { MenuSection, MenuSectionKey } from './types';

const menuSections: MenuSection[] = [
  {
    key: 'create-user',
    anchor: 'create-user',
    title: '利用者新規登録',
    description: 'ユーザーIDと氏名の登録から開始し、詳細フォームで追加情報を入力できます。',
    icon: PersonAddRoundedIcon,
    avatarColor: 'info.main',
    status: 'available',
    actionLabel: '新規登録',
    highlights: [
      'ユーザーIDと氏名の必須項目を素早く登録',
      '詳細フォームで通所予定や支援区分を一括入力',
      '登録完了後は一覧に自動反映',
    ],
  },
  {
    key: 'basic',
    anchor: 'basic-info',
    title: '基本情報',
    description: '契約情報や緊急連絡先など利用者の基礎データを確認できます。',
    icon: BadgeRoundedIcon,
    avatarColor: 'primary.main',
    status: 'available',
    highlights: [
      '氏名・ふりがな・利用者コードなどのマスタ情報管理',
      '契約日・利用開始日の確認と履歴把握',
      '緊急連絡先や通所・送迎設定の把握',
    ],
  },
  {
    key: 'support-plan',
    anchor: 'support-plan',
    title: '個別支援計画書',
    description: '次期評価に向けた個別支援計画書のドラフトと確定版を参照します。',
    icon: DescriptionRoundedIcon,
    avatarColor: 'secondary.main',
    status: 'coming-soon',
    highlights: [
      '短期・中期目標の設定と進捗レビュー',
      '支援内容の見直しや家族との合意記録',
      '評価コメントと次期課題の整理',
    ],
  },
  {
    key: 'service-records',
    anchor: 'service-records',
    title: 'サービス提供実績記録',
    description: '国保連向けサービス提供実績記録票の入力と突合状況を管理します。',
    icon: FactCheckRoundedIcon,
    avatarColor: 'success.main',
    status: 'coming-soon',
    highlights: [
      '通所予定と提供実績の差分チェック',
      '加算・減算の算定履歴とエビデンス添付',
      '月次請求帳票のダウンロード',
    ],
  },
  {
    key: 'support-procedure',
    anchor: 'support-procedure',
    title: '支援手順兼記録',
    description: '強度行動障害対象者の個別支援手順と日々の実施記録を管理します。',
    icon: SupportIcon,
    avatarColor: 'warning.main',
    status: 'coming-soon',
    highlights: [
      '支援手順テンプレートと実施履歴の一元管理',
      '本人の様子・ABC記録・改善メモの整理',
      '職員間での申し送り・改善点の共有',
    ],
  },
  {
    key: 'assessment',
    anchor: 'assessment',
    title: 'アセスメントシート',
    description: 'アセスメントシートの入力・承認ステータスと評価ポイントを俯瞰します。',
    icon: PsychologyIcon,
    avatarColor: 'info.main',
    status: 'coming-soon',
    highlights: [
      '領域ごとの評価スコアと改善ポイントの把握',
      '家族・多職種からのヒアリング記録整理',
      '前回評価との差分と課題管理',
    ],
  },
  {
    key: 'monitoring',
    anchor: 'monitoring',
    title: 'モニタリングシート',
    description: '個別支援計画のモニタリング記録を時系列で整理します。',
    icon: AssessmentRoundedIcon,
    avatarColor: 'error.main',
    status: 'coming-soon',
    highlights: [
      '訪問・電話・ケース会議でのモニタリング履歴',
      '目標達成度と評価者コメントの蓄積',
      '次のアクションとフォローアップ予定の管理',
    ],
  },
];

const TAB_SECTION_KEYS: MenuSectionKey[] = [
  'basic',
  'support-plan',
  'service-records',
  'support-procedure',
  'assessment',
];

const TAB_SECTIONS = TAB_SECTION_KEYS
  .map((key) => menuSections.find((section) => section.key === key))
  .filter((section): section is MenuSection => Boolean(section));

const NON_TABBED_SECTIONS = menuSections.filter(
  (section) => !TAB_SECTION_KEYS.includes(section.key) && section.key !== 'create-user'
);

const QUICK_ACCESS_KEYS: MenuSectionKey[] = [
  'create-user',
  'basic',
  'support-plan',
  'support-procedure',
  'monitoring',
];

const DEFAULT_TAB_KEY = TAB_SECTIONS[0]?.key ?? menuSections[0].key;

export {
  DEFAULT_TAB_KEY,
  menuSections,
  NON_TABBED_SECTIONS,
  QUICK_ACCESS_KEYS,
  TAB_SECTION_KEYS,
  TAB_SECTIONS,
};

/**
 * alertPlaybook — アラートの改善プレイブック定義
 *
 * 各 alert ID に対して構造化された改善ガイダンスを提供する。
 * ダッシュボードが「監視画面」から「改善会議の叩き台」になるための中核データ。
 *
 * @see computeRoleAlerts.ts — role 別アラート生成
 * @see computeCtaKpiDiff.ts — 全体アラート生成
 */

// ── Types ───────────────────────────────────────────────────────────────────

/** 改善プレイブックエントリ */
export type PlaybookEntry = {
  /** アラート ID（KpiAlert.id に対応） */
  alertId: string;
  /** 想定原因リスト */
  causes: string[];
  /** 推奨確認ポイント */
  checkpoints: string[];
  /** 関連画面パス */
  relatedScreens: { label: string; path: string }[];
  /** GitHub Issue テンプレ候補 */
  issueTemplate: {
    title: string;
    labels: string[];
  };
};

export type AlertPlaybook = Record<string, PlaybookEntry>;

// ── Playbook Data ───────────────────────────────────────────────────────────

export const ALERT_PLAYBOOK: AlertPlaybook = {
  // ── 全体アラート ────────────────────────────────────────────────────────

  'hero-rate-low': {
    alertId: 'hero-rate-low',
    causes: [
      'Hero CTA の文言が行動を促していない',
      'Hero が画面の下部に配置されている',
      'Queue や既存ビューの方がユーザーに先に見つけられている',
    ],
    checkpoints: [
      'Hero CTAのコピー（文言）を確認',
      'Hero カードの画面内位置を確認',
      'resolveHeroRecord のロジックを確認（優先度が適切か）',
    ],
    relatedScreens: [
      { label: 'Today', path: '/today' },
      { label: 'DailyRecord', path: '/daily/activity' },
      { label: 'CallLog', path: '/call-log' },
    ],
    issueTemplate: {
      title: '[改善] Hero 利用率が閾値を下回っている',
      labels: ['ux', 'telemetry', 'improvement'],
    },
  },

  'queue-rate-high': {
    alertId: 'queue-rate-high',
    causes: [
      'Hero が弱く Queue から操作が始まっている',
      'Queue の方が一覧性が高く使いやすい',
      'Hero の表示条件が限定的すぎる',
    ],
    checkpoints: [
      'Hero と Queue の視覚的優先度を確認',
      'Queue のクリック先を確認（一覧 vs 個別レコード）',
      'Hero が空になる条件を確認',
    ],
    relatedScreens: [
      { label: 'Today', path: '/today' },
      { label: 'DailyRecord', path: '/daily/activity' },
    ],
    issueTemplate: {
      title: '[改善] Queue 偏重 — Hero の訴求力不足',
      labels: ['ux', 'telemetry', 'improvement'],
    },
  },

  'completion-low': {
    alertId: 'completion-low',
    causes: [
      'フォームの入力負荷が高い',
      'CTA クリック後の遷移先が分かりにくい',
      '完了アクションが見つけづらい',
    ],
    checkpoints: [
      'CTA→完了の画面遷移を実際に確認',
      'フォームの必須項目数を確認',
      '完了ボタンの視認性を確認',
    ],
    relatedScreens: [
      { label: 'DailyRecord Form', path: '/daily/activity' },
      { label: 'CallLog Form', path: '/call-log' },
    ],
    issueTemplate: {
      title: '[改善] CTA→完了の転換率が低い',
      labels: ['ux', 'telemetry', 'critical'],
    },
  },

  'cta-conversion-low': {
    alertId: 'cta-conversion-low',
    causes: [
      'ランディング画面で CTA が見つけにくい',
      '画面に情報が多すぎて CTA に気づかない',
      'ユーザーが画面を見ているだけで操作に至っていない',
    ],
    checkpoints: [
      'Landing→CTA の動線を実画面で確認',
      'CTA ボタンの位置とコントラストを確認',
      'ファーストビューに CTA が含まれているか確認',
    ],
    relatedScreens: [
      { label: 'Today', path: '/today' },
      { label: 'Handoff', path: '/handoff' },
    ],
    issueTemplate: {
      title: '[改善] Landing→CTA 転換率が低い',
      labels: ['ux', 'telemetry', 'improvement'],
    },
  },

  // ── Role 別アラート ────────────────────────────────────────────────────

  'role-hero-rate-low:staff': {
    alertId: 'role-hero-rate-low:staff',
    causes: [
      'スタッフが Hero より Queue を使い慣れている',
      'Hero の表示タイミングがスタッフの業務開始時に合っていない',
      'Hero 文言がスタッフの作業文脈に合っていない',
    ],
    checkpoints: [
      'Hero CTA のコピーがスタッフの日常語彙と合っているか確認',
      'スタッフのログイン直後の画面を確認',
      '時間帯分布と合わせてスタッフの利用ピークを確認',
    ],
    relatedScreens: [
      { label: 'Today', path: '/today' },
      { label: 'DailyRecord', path: '/daily/activity' },
    ],
    issueTemplate: {
      title: '[改善] スタッフの Hero 利用率が低い',
      labels: ['ux', 'telemetry', 'staff', 'improvement'],
    },
  },

  'role-hero-rate-low:admin': {
    alertId: 'role-hero-rate-low:admin',
    causes: [
      '管理者は一覧操作が主で Hero よりフィルタ導線を好む',
      '管理画面のショートカットが Hero より先に表示されている',
      'Hero が管理者の業務文脈（承認・確認）に合っていない',
    ],
    checkpoints: [
      '管理者ダッシュボードの導線を確認',
      '管理者がどの画面から操作を始めているか確認',
      'Hero と管理系ショートカットの位置関係を確認',
    ],
    relatedScreens: [
      { label: 'Today', path: '/today' },
      { label: 'Admin 系一覧', path: '/dailysupport' },
    ],
    issueTemplate: {
      title: '[改善] 管理者の Hero 利用率が低い',
      labels: ['ux', 'telemetry', 'admin', 'improvement'],
    },
  },

  'role-queue-rate-high:staff': {
    alertId: 'role-queue-rate-high:staff',
    causes: [
      'Queue の方が「残りの件数」が見えて安心する',
      'Hero が1件だけ表示する形式に慣れていない',
      'Queue のリストUIの方がスタッフに馴染みがある',
    ],
    checkpoints: [
      'Hero と Queue の視覚的な差別化を確認',
      'Queue 内のクリック位置（上位 vs 下位）を確認',
      'Hero 表示時に Queue が同時に見えているか確認',
    ],
    relatedScreens: [
      { label: 'DailyRecord', path: '/daily/activity' },
      { label: 'CallLog', path: '/call-log' },
    ],
    issueTemplate: {
      title: '[改善] スタッフが Queue 偏重',
      labels: ['ux', 'telemetry', 'staff', 'improvement'],
    },
  },

  'role-queue-rate-high:admin': {
    alertId: 'role-queue-rate-high:admin',
    causes: [
      '管理者は複数件を一度に処理したい',
      '一覧・フィルタ操作が管理業務に適している',
      'Hero の1件ずつ処理する形式が管理者に合わない',
    ],
    checkpoints: [
      '管理者向けの一括操作導線があるか確認',
      'Queue→一覧→フィルタの動線を確認',
      '管理者に Hero が不要かどうか判断',
    ],
    relatedScreens: [
      { label: 'DailyRecord Menu', path: '/dailysupport' },
      { label: 'CallLog', path: '/call-log' },
    ],
    issueTemplate: {
      title: '[改善] 管理者が Queue 偏重 — 一括操作の検討',
      labels: ['ux', 'telemetry', 'admin', 'improvement'],
    },
  },

  'role-completion-low:staff': {
    alertId: 'role-completion-low:staff',
    causes: [
      'フォームの入力項目が多すぎる',
      '必須項目の入力に迷いが生じている',
      '途中中断後の再開動線が弱い',
    ],
    checkpoints: [
      'フォーム必須項目の数と種類を確認',
      'スタッフ向けの入力ガイド（ヒント文言）があるか確認',
      '中断→再開のフローを実機で確認',
    ],
    relatedScreens: [
      { label: 'DailyRecord Form', path: '/daily/activity' },
      { label: 'CallLog Form', path: '/call-log' },
    ],
    issueTemplate: {
      title: '[改善] スタッフの完了率が低い — 入力負荷調査',
      labels: ['ux', 'telemetry', 'staff', 'critical'],
    },
  },

  'role-completion-low:admin': {
    alertId: 'role-completion-low:admin',
    causes: [
      '承認フローが複雑',
      '一括操作で完了処理がスキップされている',
      '管理者が途中確認だけして完了まで至って いない',
    ],
    checkpoints: [
      '承認・確認フローのステップ数を確認',
      '一括処理時に完了がトリガーされているか確認',
      '管理者の操作パターン（確認のみ vs 完了まで）を確認',
    ],
    relatedScreens: [
      { label: 'Handoff', path: '/handoff' },
      { label: 'Admin 一覧', path: '/dailysupport' },
    ],
    issueTemplate: {
      title: '[改善] 管理者の完了率が低い — 承認導線調査',
      labels: ['ux', 'telemetry', 'admin', 'critical'],
    },
  },

  'unknown-role-share-high': {
    alertId: 'unknown-role-share-high',
    causes: [
      'telemetry emit 時に role が付与されていない',
      'auth context から role を取得できていないパスがある',
      '新規画面で role 埋め込みが漏れている',
    ],
    checkpoints: [
      'telemetry emit のペイロードに role が含まれているか確認',
      'auth context の role 取得ロジックを確認',
      '最近追加された画面の emit コードを確認',
    ],
    relatedScreens: [
      { label: 'Telemetry Raw', path: '/telemetry' },
    ],
    issueTemplate: {
      title: '[基盤] テレメトリ role 埋め込み漏れの調査',
      labels: ['telemetry', 'infrastructure', 'data-quality'],
    },
  },
};

// ── Lookup ───────────────────────────────────────────────────────────────────

/**
 * alert ID からプレイブックエントリを取得する
 *
 * - exact match を優先
 * - role 付き ID (e.g. `role-hero-rate-low:staff`) で見つからない場合は
 *   base ID (e.g. `hero-rate-low`) にフォールバック
 * - 登録なしの場合は undefined
 */
export function getPlaybookEntry(alertId: string): PlaybookEntry | undefined {
  // exact match
  if (ALERT_PLAYBOOK[alertId]) return ALERT_PLAYBOOK[alertId];

  // role 付き ID のフォールバック: `role-xxx:role` → `xxx`
  const match = alertId.match(/^role-(.+):(?:staff|admin|unknown)$/);
  if (match) {
    const baseId = match[1];
    if (ALERT_PLAYBOOK[baseId]) return ALERT_PLAYBOOK[baseId];
  }

  return undefined;
}

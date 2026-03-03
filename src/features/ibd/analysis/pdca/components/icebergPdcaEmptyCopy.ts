export type IcebergPdcaEmptyContext =
  | 'flag-off'
  | 'no-user-selected'
  | 'no-items-admin'
  | 'no-items-staff';

export type IcebergPdcaEmptyCopy = {
  title: string;
  description: string;
  actions?: string[];
};

export const ICEBERG_PDCA_EMPTY_COPY: Record<IcebergPdcaEmptyContext, IcebergPdcaEmptyCopy> = {
  'flag-off': {
    title: '氷山PDCAは現在オフになっています',
    description: '管理者に問い合わせるか、設定で機能を有効にしてください。',
  },
  'no-user-selected': {
    title: '利用者を選択してください',
    description: '氷山モデル・ABC分析・日誌を統合したPDCAを個別利用者ごとに管理します。まず対象を選びましょう。',
    actions: ['利用者を選ぶ'],
  },
  'no-items-admin': {
    title: 'まだPDCAの記録がありません',
    description: '選択された利用者のPDCAデータはまだありません。初回のPDCAを登録して、氷山モデルと合わせて支援設計を開始しましょう。',
    actions: ['PDCAを新規作成'],
  },
  'no-items-staff': {
    title: 'まだPDCAの記録がありません',
    description: '選択された利用者のPDCAデータはまだありません。担当支援者が準備中です。完了後、この画面でPLAN/DO/CHECK/ACTを確認できます。',
  },
};

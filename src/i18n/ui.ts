export const ui = {
  schedule: {
    // 既存
    listTitle: 'スケジュール一覧',

    // 追加: ボタン系
    actions: {
      new: '新規スケジュール',
      edit: 'スケジュールを編集',
      delete: 'スケジュールを削除',
      duplicate: 'スケジュールを複製',
    },

    // 追加: フォーム共通
    form: {
      createTitle: 'スケジュールを新規作成',
      editTitle: 'スケジュールを編集',
      save: '保存',
      cancel: 'キャンセル',
      close: '閉じる',
      submitting: '保存中…',
      successMessage: 'スケジュールを保存しました。',
      errorMessage: 'スケジュールの保存に失敗しました。',
    },

    // 追加: 削除ダイアログ
    deleteDialog: {
      title: 'スケジュールの削除',
      message: 'このスケジュールを削除しますか？この操作は取り消せません。',
      confirm: '削除する',
      cancel: 'キャンセル',
      successMessage: 'スケジュールを削除しました。',
      errorMessage: 'スケジュールの削除に失敗しました。',
    },

    // 追加: 状態表示
    state: {
      loading: 'スケジュールを読み込み中…',
      empty: '表示できるスケジュールがありません。',
      loadError: 'スケジュールの取得に失敗しました。',
    },
  },

  filters: {
    // 既存: そのまま残して後方互換
    schedule: 'スケジュールの検索とフィルタ',

    // 追加: 個別ラベル・ボタン文言
    scheduleFields: {
      heading: 'スケジュールの検索とフィルタ',
      keywordLabel: 'キーワード',
      dateRangeLabel: '日付範囲',
      staffLabel: '担当スタッフ',
      userLabel: '利用者',
      statusLabel: 'ステータス',
      reset: '条件をクリア',
      apply: 'この条件で絞り込む',
    },
  },
};

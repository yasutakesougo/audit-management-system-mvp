import { PROCEDURE_ROWS, ProcedureRow } from './procedureRows';
import type { UserProcedureDetail, UserProcedureSheetNotes } from '../domain/userProcedureDetail';

// 桂川さん（Id: 3, 原紙マッピングID: 3）用の手技データ
// 原紙「桂川さん_重度加算（外出入り）.xls」から、本人の動き・支援者の動きを行単位で転記。
export const USER_PROCEDURE_DETAILS: UserProcedureDetail[] = [
  {
    userId: 3,
    rowNo: 1,
    personAction: '朝の準備\n手洗い\n荷物をロッカーへ\n提出物を職員へ\nハンカチ確認',
    supporterAction: '通所時のヘルパーと申し送りをする。\n手洗いの声掛け。\n本人と朝の準備のお手伝い。\nハンカチ確認。',
  },
  {
    userId: 3,
    rowNo: 2,
    personAction: 'ラジオ体操をする',
    supporterAction: '体操の声掛けをする。',
  },
  {
    userId: 3,
    rowNo: 3,
    personAction: 'ホワイトボードを見ながら確認する',
    supporterAction: 'ホワイトボードを使って声掛けし説明する。',
  },
  {
    userId: 3,
    rowNo: 4,
    personAction: '手洗いしお茶を飲む',
    supporterAction: '手洗い・消毒の補助。\nお茶を飲む・片付けるお手伝いをする。',
  },
  {
    userId: 3,
    rowNo: 5,
    personAction: '日中活動準備\nビン入れ\nビーズの種類分け',
    supporterAction: '座る場所の促しや準備のお手伝い。\n活動の見守り・声掛けをする。',
  },
  {
    userId: 3,
    rowNo: 6,
    personAction: '手洗い・消毒・昼食の準備',
    supporterAction: '手洗い等の声掛けや準備のお手伝いをする。',
  },
  {
    userId: 3,
    rowNo: 7,
    personAction: '食事の受け取り・食事\n一部介助・片づけ・歯磨き',
    supporterAction: '食事の受取や片付け、食事一部介助、食後の歯磨き介助などのお手伝いをする。',
  },
  {
    userId: 3,
    rowNo: 8,
    personAction: '休み時間ののんびりタイム\n血圧測定',
    supporterAction: '静かな部屋への促しをする。\nトイレの声掛け・介助。\n血圧測定。',
  },
  {
    userId: 3,
    rowNo: 9,
    personAction: 'ホワイトボードを見ながら確認する',
    supporterAction: 'ホワイトボードを使って声掛けし説明する。',
  },
  {
    userId: 3,
    rowNo: 10,
    personAction: '日中活動準備\nビン入れ\nビーズの種類分け',
    supporterAction: '座る場所の促しや準備のお手伝い。\n活動の見守り・声掛けをする。',
  },
  {
    userId: 3,
    rowNo: 11,
    personAction: '手洗いしお茶を飲む',
    supporterAction: '手洗い・消毒の補助。\nお茶を飲む・片付けるお手伝いをする。',
  },
  {
    userId: 3,
    rowNo: 12,
    personAction: '日中活動準備\nビン入れ\nビーズの種類分け',
    supporterAction: '座る場所の促しや準備のお手伝い。\n活動の見守り・声掛けをする。',
  },
  {
    userId: 3,
    rowNo: 13,
    personAction: 'のんびり過ごす',
    supporterAction: 'のんびりできているかの確認。\n座る場所の促しをする。\nトイレの声掛け・介助。',
  },
  {
    userId: 3,
    rowNo: 14,
    personAction: '帰りの準備\n荷物をロッカーから出す・着替え・トイレ\nハンカチ確認',
    supporterAction: '荷物をロッカーから出す・着替え・ハンカチ確認・ノート返却などのお手伝いをする。',
  },
  {
    userId: 3,
    rowNo: 15,
    personAction: 'ヘルパーと一緒に帰る\n(木曜日は母)',
    supporterAction: 'ヘルパーに引き継ぎ\n(木曜日は母)\nご本人の様子を伝える。',
  },
  {
    userId: 3,
    rowNo: 16,
    personAction: '着替えを持つ\nトイレに行く',
    supporterAction: 'トイレの声掛け介助。\n荷物の確認をする。\n自動ドア前で写真を撮る。',
  },
  {
    userId: 3,
    rowNo: 17,
    personAction: 'AM PM日中活動 (外活動)',
    supporterAction: '',
  },
  {
    userId: 4,
    rowNo: 1,
    personAction: '送迎車で来所\n手洗い\n荷物の片づけ',
    supporterAction: '送迎担当と引継ぎ\nご本人と朝の準備（手洗い・荷物をロッカーへ）\nトイレ誘導・介助',
  },
  {
    userId: 4,
    rowNo: 2,
    personAction: 'ラジオ体操参加\n又はのんびり',
    supporterAction: '見守り\n状況に応じて体操の有無によっては補助又は介助。',
  },
  {
    userId: 4,
    rowNo: 3,
    personAction: '発表時は室内（第1作業室にいる）',
    supporterAction: '室内（第一作業室にいてもらうようにする。）\n見守り',
  },
  {
    userId: 4,
    rowNo: 4,
    personAction: '手洗い、消毒後お茶を飲む',
    supporterAction: '状況に応じて、手洗い、消毒、お茶を飲む補助又は介助',
  },
  {
    userId: 4,
    rowNo: 5,
    personAction: '第二作業室で本や小道具でリラックス\n室内や廊下を歩く',
    supporterAction: '活動準備\nトイレ誘導・介助\n見守り',
  },
  {
    userId: 4,
    rowNo: 6,
    personAction: '手洗い、消毒\n昼食まで座っている',
    supporterAction: '状況により手洗い、消毒の補助又は介助\n席についている見守り',
  },
  {
    userId: 4,
    rowNo: 7,
    personAction: '食事の受取り\n食事の片づけ、手洗い',
    supporterAction: '状況により受取り、食事、片づけ、手洗いの補助又は介助',
  },
  {
    userId: 4,
    rowNo: 8,
    personAction: '動画鑑賞\nコーヒー注文\nのんびり過ごす',
    supporterAction: 'タブレットの順番管理\nコーヒーの注文促し\n見守り',
  },
  {
    userId: 4,
    rowNo: 9,
    personAction: '発表時は室内（第1作業室にいる）',
    supporterAction: '室内（第一作業室にいてもらうようにする。）\n見守り',
  },
  {
    userId: 4,
    rowNo: 10,
    personAction: '第二作業室で本や小道具でリラックス\n室内や廊下を歩く',
    supporterAction: '活動準備\nトイレ誘導・介助\n見守り',
  },
  {
    userId: 4,
    rowNo: 11,
    personAction: '手洗い、消毒後お茶を飲む',
    supporterAction: '状況に応じて、手洗い、消毒、お茶を飲む補助又は介助',
  },
  {
    userId: 4,
    rowNo: 12,
    personAction: '第二作業室で本や小道具でリラックス\n室内や廊下を歩く',
    supporterAction: '活動準備、片づけ\nトイレ誘導・介助\n見守り',
  },
  {
    userId: 4,
    rowNo: 13,
    personAction: '自分のペースで自由に過ごす',
    supporterAction: '状況に応じて、補助又は介助\n見守り',
  },
  {
    userId: 4,
    rowNo: 14,
    personAction: '帰りの準備\n室内にいる',
    supporterAction: 'トイレ誘導・介助\n帰りの準備補助又は介助\n見守り',
  },
  {
    userId: 4,
    rowNo: 15,
    personAction: '送迎車に乗る',
    supporterAction: '送迎ボードを確認しながら送迎車を確認。安全に送迎車に乗れるよう付き添い介助',
  },
  {
    userId: 4,
    rowNo: 16,
    personAction: '出発前のトイレ',
    supporterAction: 'トイレの介助\n着替えを持つ\n自動ドアの前で写真を撮る',
  },
  {
    userId: 4,
    rowNo: 17,
    personAction: '出発前のトイレ',
    supporterAction: 'トイレの介助\n着替えを持つ\n自動ドアの前で写真を撮る',
  },
  {
    userId: 7,
    rowNo: 1,
    personAction: '家族の送迎で来所。車見送り。手洗い、各所確認。',
    supporterAction: '家族との引継ぎを行い、手洗い・着替え等の朝の準備を支援する。',
  },
  {
    userId: 7,
    rowNo: 2,
    personAction: 'ラジオ体操動画の確認',
    supporterAction: '見守り。入ってはいけない場所へ行った際、付き添い。',
  },
  {
    userId: 7,
    rowNo: 3,
    personAction: '活動内容発表時は室内（第１作業室）にいる',
    supporterAction: '室内（第１作業室）にいてもらうようにする。見守り。',
  },
  {
    userId: 7,
    rowNo: 4,
    personAction: '手洗い後、お茶を飲む',
    supporterAction: '手洗い、消毒を促す。お茶の列に誘導する。',
  },
  {
    userId: 7,
    rowNo: 5,
    personAction: 'タオル作業（ペン入れ、鈴入れ）',
    supporterAction: '活動準備の手伝い。タオル運び、見守り。',
  },
  {
    userId: 7,
    rowNo: 6,
    personAction: '手洗い、消毒。昼食まで座っている。',
    supporterAction: '手洗い、消毒を促す。席についている見守り。',
  },
  {
    userId: 7,
    rowNo: 7,
    personAction: '食事の受け取り。食後の片付け、手洗い。',
    supporterAction: '一部食事介助、見守り。食後片付けの補助。',
  },
  {
    userId: 7,
    rowNo: 8,
    personAction: '動画鑑賞。コーヒー等を飲む。寝て過ごす。',
    supporterAction: 'タブレットの順番管理、声掛け。財布の声掛け、お金を出すところの見守り。',
  },
  {
    userId: 7,
    rowNo: 9,
    personAction: '活動内容発表時は室内（第１作業室）にいる',
    supporterAction: '室内（第１作業室）にいてもらうようにする。見守り。',
  },
  {
    userId: 7,
    rowNo: 10,
    personAction: 'ペン入れ、鈴入れ。自主課題。',
    supporterAction: '活動準備の手伝い、見守り。',
  },
  {
    userId: 7,
    rowNo: 11,
    personAction: '手洗い後、お茶を飲む',
    supporterAction: '手洗い、消毒を促す。お茶の列に誘導する。',
  },
  {
    userId: 7,
    rowNo: 12,
    personAction: 'ペン入れ、鈴入れ。自主課題。',
    supporterAction: '活動準備の手伝い、見守り。',
  },
  {
    userId: 7,
    rowNo: 13,
    personAction: '動画の確認、動画鑑賞。ご本人のペースで自由に過ごす。',
    supporterAction: '入ってはいけない場所へ行った際付き添い、見守り。',
  },
  {
    userId: 7,
    rowNo: 14,
    personAction: '着替え、帰りの準備。毛布干し。トイレ誘導。',
    supporterAction: '着替え、帰りの準備の手伝い。ルーティンの付き添い。トイレの声掛け。',
  },
  {
    userId: 7,
    rowNo: 15,
    personAction: '送迎車に乗る',
    supporterAction: '送迎ボードを確認しながら送迎車を確認。安全に送迎車に乗れるよう付き添い。',
  },
  {
    userId: 7,
    rowNo: 16,
    personAction: '出発前にトイレを確認する',
    supporterAction: 'トイレの声掛け。自動ドア前で写真を撮る。',
  },
  {
    userId: 7,
    rowNo: 17,
    personAction: '出発前にトイレを確認する',
    supporterAction: 'トイレの声掛け。自動ドア前で写真を撮る。',
  },
  // 塩田 裕貴さん（I016）
  { userId: 'I016', rowNo: 1, personAction: '手洗い、消毒。荷物を入れる。', supporterAction: '通所時の様子を確認し、必要に応じて声かけを行う。' },
  { userId: 'I016', rowNo: 2, personAction: '体操に参加する', supporterAction: '本人の様子を見ながら参加を促す' },
  { userId: 'I016', rowNo: 3, personAction: '予定を見る', supporterAction: '本人と一緒に予定を確認し、見通しが持てるよう支援する' },
  { userId: 'I016', rowNo: 4, personAction: 'お茶を飲む', supporterAction: 'お茶の準備、片付けを行う' },
  { userId: 'I016', rowNo: 5, personAction: '午前の活動に参加する', supporterAction: '必要に応じて声かけ、見守りを行う' },
  { userId: 'I016', rowNo: 6, personAction: '手洗い、配膳', supporterAction: '手洗い・配膳を見守り、必要に応じて支援する' },
  { userId: 'I016', rowNo: 7, personAction: '昼食を食べる', supporterAction: '食事の様子を見守り、必要に応じて介助を行う' },
  { userId: 'I016', rowNo: 8, personAction: '休憩時間を過ごす', supporterAction: '休憩中の様子を見守る' },
  { userId: 'I016', rowNo: 9, personAction: '午後の予定を確認する', supporterAction: '本人と一緒に午後の予定を確認する' },
  { userId: 'I016', rowNo: 10, personAction: '午後の活動に参加する', supporterAction: '必要に応じて同行支援を行う' },
  { userId: 'I016', rowNo: 11, personAction: 'お茶を飲む', supporterAction: 'お茶の準備、片付けを行う' },
  { userId: 'I016', rowNo: 12, personAction: '午後の活動に参加する', supporterAction: '必要に応じて同行支援を行う' },
  { userId: 'I016', rowNo: 13, personAction: 'ダンスを踊る。音楽に合わせて動く。', supporterAction: '本人の好きな曲をかけ、一緒に楽しむ。' },
  { userId: 'I016', rowNo: 14, personAction: '帰宅準備を行う', supporterAction: '身支度を見守り、必要に応じて支援する' },
  { userId: 'I016', rowNo: 15, personAction: '退所する', supporterAction: '退所時の様子を確認し、見送りを行う' },
  { userId: 'I016', rowNo: 16, personAction: '外活動に向けた準備を行う', supporterAction: 'トイレ、帽子、持ち物など外活動に必要な準備を支援する' },
  { userId: 'I016', rowNo: 17, personAction: '外活動に参加する', supporterAction: '外活動中の安全確認、同行支援、見守りを行う' },
];

function isIshiwataUserId(userId: string | number): boolean {
  const s = String(userId);
  return s === '4' || s === '6' || s === 'U-002' || s === 'U-003' || s === 'I005';
}

function isKatsuragawaUserId(userId: string | number): boolean {
  const s = String(userId);
  return s === '3' || s === '10' || s === 'U-001' || s === 'I009';
}

function isNakamuraUserId(userId: string | number): boolean {
  const s = String(userId);
  return s === '7' || s === '23' || s === 'U-006' || s === 'I017' || s === 'I022';
}

function isShiotaUserId(userId: string | number): boolean {
  const s = String(userId);
  return s === 'I016';
}

export function findUserProcedureDetail(userId: string | number, rowNo: number): UserProcedureDetail | undefined {
  return USER_PROCEDURE_DETAILS.find((detail) => {
    const isUserMatch = isIshiwataUserId(detail.userId)
      ? isIshiwataUserId(userId)
      : isKatsuragawaUserId(detail.userId)
        ? isKatsuragawaUserId(userId)
        : isNakamuraUserId(detail.userId)
          ? isNakamuraUserId(userId)
          : isShiotaUserId(detail.userId)
            ? isShiotaUserId(userId)
            : String(detail.userId) === String(userId);
    return isUserMatch && detail.rowNo === rowNo;
  });
}

export function buildUserProcedureRows(userId: string | number): ProcedureRow[] {
  return PROCEDURE_ROWS.map((row) => {
    const detail = findUserProcedureDetail(userId, row.rowNo);

    return {
      ...row,
      activityDetail: detail?.personAction ?? row.activityDetail,
      instructionDetail: detail?.supporterAction ?? row.instructionDetail,
    };
  });
}

// 石渡さん（Id: 4, UserID: 'U-002'）用のシート単位補足データ（下部欄）
// 原紙「石渡さん_重度加算（外出入り）.xls」から、一日を通して気を付ける事・その他を転記。
export const USER_PROCEDURE_SHEET_NOTES: UserProcedureSheetNotes[] = [
  {
    userId: 3,
    dailyCarePoints: '本人のペースを尊重し、見通しを持てるように視覚的支援を行う。',
    otherNotes: '視覚的スケジュールの提示、イヤーマフの活用。\n短い言葉で具体的に伝える。',
  },
  {
    userId: 4,
    dailyCarePoints: '自発的な排泄要望がないため、こまめな支援者間の情報共有が必要。',
    otherNotes: '個別のタイミングを考慮した声掛けと、手洗い・消毒用の設備配置。',
  },
  {
    userId: 7,
    dailyCarePoints: '見通しを持ち、安心して活動に取り組む。制限エリア（プレイルーム・和室・給食室）への進入防止と自主課題の充実。',
    otherNotes: 'かさぶた・ささくれ・靴下の糸を気にする。ダイア磯子前の車を気にする。\nスケジュール表の提示。制限エリアの視覚的表示。\n写真カードによる活動の提示。トイレ間隔の把握と声掛けのタイミング調整。',
  },
  {
    userId: 'I016',
    dailyCarePoints: '見通しを持って落ち着いて活動に取り組む。ハサミ以外の没頭できる活動の探索。',
    otherNotes: [
      '【観察事実】\nハサミに没頭すると切り替えが困難。音楽への反応が良い。',
      '【環境調整】\nスケジュール表の提示。クールダウン場所の確保。',
      '【具体的対応】\n写真カードによる選択肢提示。本人の表情や動作からのフィードバック収集。',
    ].join('\n\n'),
  },
];

export function findUserProcedureSheetNotes(userId: string | number): UserProcedureSheetNotes | undefined {
  return USER_PROCEDURE_SHEET_NOTES.find((notes) => {
    return isIshiwataUserId(notes.userId)
      ? isIshiwataUserId(userId)
      : isKatsuragawaUserId(notes.userId)
        ? isKatsuragawaUserId(userId)
        : isNakamuraUserId(notes.userId)
          ? isNakamuraUserId(userId)
          : isShiotaUserId(notes.userId)
            ? isShiotaUserId(userId)
            : String(notes.userId) === String(userId);
  });
}

export function hasUserProcedureMaster(userId: string | number): boolean {
  return USER_PROCEDURE_DETAILS.some((detail) => {
    return isIshiwataUserId(detail.userId)
      ? isIshiwataUserId(userId)
      : isKatsuragawaUserId(detail.userId)
        ? isKatsuragawaUserId(userId)
        : isNakamuraUserId(detail.userId)
          ? isNakamuraUserId(userId)
          : isShiotaUserId(detail.userId)
            ? isShiotaUserId(userId)
            : String(detail.userId) === String(userId);
  });
}

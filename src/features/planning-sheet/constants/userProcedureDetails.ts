import { PROCEDURE_ROWS, ProcedureRow } from './procedureRows';
import type { UserProcedureDetail } from '../domain/userProcedureDetail';

// 石渡さん（Id: 4, UserID: 'U-002'）用の手技データ
export const USER_PROCEDURE_DETAILS: UserProcedureDetail[] = [
  { userId: 4, rowNo: 1, personAction: '送迎車で来所 手洗い 荷物の片づけ', supporterAction: '送迎担当と引継ぎ ご本人と朝の準備（手洗い・荷物をロッカーへ） トイレ誘導・介助' },
  { userId: 4, rowNo: 2, personAction: 'ラジオ体操参加 又はのんびり', supporterAction: '見守り 状況に応じて体操の有無によっては補助又は介助。' },
  { userId: 4, rowNo: 3, personAction: '発表時は室内（第1作業室にいる）', supporterAction: '室内（第一作業室にいてもらうようにする。） 見守り' },
  { userId: 4, rowNo: 4, personAction: '手洗い、消毒後お茶を飲む', supporterAction: '状況に応じて、手洗い、消毒、お茶を飲む補助又は介助' },
  { userId: 4, rowNo: 5, personAction: '第二作業室で本や小道具でリラックス 室内や廊下を歩く', supporterAction: '活動準備 トイレ誘導・介助 見守り' },
  { userId: 4, rowNo: 6, personAction: '手洗い、消毒 昼食まで座っている', supporterAction: '状況により手洗い、消毒の補助又は介助 席についている見守り' },
  { userId: 4, rowNo: 7, personAction: '食事の受取り 食事の片づけ、手洗い', supporterAction: '状況により受取り、食事、片づけ、手洗いの補助又は介助' },
  { userId: 4, rowNo: 8, personAction: '動画鑑賞 コーヒー注文 のんびり過ごす', supporterAction: 'タブレットの順番管理 コーヒーの注文促し 見守り' },
  { userId: 4, rowNo: 9, personAction: '発表時は室内（第1作業室にいる）', supporterAction: '室内（第一作業室にいてもらうようにする。） 見守り' },
  { userId: 4, rowNo: 10, personAction: '第二作業室で本や小道具でリラックス 室内や廊下を歩く', supporterAction: '活動準備 トイレ誘導・介助 見守り' },
  { userId: 4, rowNo: 11, personAction: '手洗い、消毒後お茶を飲む', supporterAction: '状況に応じて、手洗い、消毒、お茶を飲む補助又は介助' },
  { userId: 4, rowNo: 12, personAction: '第二作業室で本や小道具でリラックス 室内や廊下を歩く', supporterAction: '活動準備、片づけ トイレ誘導・介助 見守り' },
  { userId: 4, rowNo: 13, personAction: '自分のペースで自由に過ごす', supporterAction: '状況に応じて、補助又は介助 見守り' },
  { userId: 4, rowNo: 14, personAction: '帰りの準備 室内にいる', supporterAction: 'トイレ誘導・介助 帰りの準備補助又は介助 見守り' },
  { userId: 4, rowNo: 15, personAction: '送迎車に乗る', supporterAction: '送迎ボードを確認しながら送迎車を確認。安全に送迎車に乗れるよう付き添い介助' },
  { userId: 4, rowNo: 16, personAction: '出発前のトイレ', supporterAction: 'トイレの介助 着替えを持つ 自動ドアの前で写真を撮る' },
  { userId: 4, rowNo: 17, personAction: '出発前のトイレ', supporterAction: 'トイレの介助 着替えを持つ 自動ドアの前で写真を撮る' },
];

export function findUserProcedureDetail(userId: string | number, rowNo: number): UserProcedureDetail | undefined {
  return USER_PROCEDURE_DETAILS.find(
    (detail) => String(detail.userId) === String(userId) && detail.rowNo === rowNo
  );
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

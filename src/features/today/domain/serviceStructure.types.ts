/**
 * ServiceStructure — 今日の業務体制データ型
 *
 * 「担当表」ではなく「業務体制」を表現する。
 * 生活介護 / 生活支援 / 判断窓口 / 運営サポート の4区分で現場の配置を可視化。
 *
 * @see Issue 3: TodayServiceStructureCard
 */

/** 生活介護: 現場配置（第一作業室 / 第二作業室 / 外活動 / 和室 / プレイルーム） */
export type DayCareStructure = {
  firstWorkroomStaff: string[];
  secondWorkroomStaff: string[];
  outdoorActivityStaff: string[];
  japaneseRoomStaff: string[];
  playroomStaff: string[];
};

/** 生活支援: ショートステイ・一時ケアの受け入れ体制 */
export type LifeSupportStructure = {
  shortStayCount: number;
  temporaryCareCount: number;
  intakeDeskStaff: string[];
  supportStaff: string[];
  coordinatorStaff: string[];
  notes: string[];
};

/** 判断窓口: 所長・サビ管・ナースの在席（管理者・専門職） */
export type DecisionSupportStructure = {
  directorPresent: boolean;
  serviceManagerPresent: boolean;
  nursePresent: boolean;
  directorNames: string[];
  serviceManagerNames: string[];
  nurseNames: string[];
};

/** 運営サポート: 会計・給食・送迎・ボランティア・来客の配置 */
export type OperationalSupportStructure = {
  accountantPresent: boolean;
  accountantNames: string[];
  mealStaff: string[];
  transportStaff: string[];
  volunteerStaff: string[];
  visitorNames: string[];
};

/** 業務体制の全体構造 */
export type ServiceStructure = {
  dayCare: DayCareStructure;
  lifeSupport: LifeSupportStructure;
  decisionSupport: DecisionSupportStructure;
  operationalSupport: OperationalSupportStructure;
};

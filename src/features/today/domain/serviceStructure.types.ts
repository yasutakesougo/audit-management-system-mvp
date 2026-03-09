/**
 * ServiceStructure — 今日の業務体制データ型
 *
 * 「担当表」ではなく「業務体制」を表現する。
 * 生活介護 / 生活支援 / 判断窓口 の3区分で現場の配置を可視化。
 *
 * @see Issue 3: TodayServiceStructureCard
 */

/** 生活介護: 集団対応の配置・役割 */
export type DayCareStructure = {
  floorWatchStaff: string[];
  activityLeadStaff: string[];
  mealSupportStaff: string[];
  recordCheckStaff: string[];
  returnAcceptStaff: string[];
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

/** 判断窓口: 所長・サビ管・ナースの在席 */
export type DecisionSupportStructure = {
  directorPresent: boolean;
  serviceManagerPresent: boolean;
  nursePresent: boolean;
  directorNames: string[];
  serviceManagerNames: string[];
  nurseNames: string[];
};

/** 業務体制の全体構造 */
export type ServiceStructure = {
  dayCare: DayCareStructure;
  lifeSupport: LifeSupportStructure;
  decisionSupport: DecisionSupportStructure;
};

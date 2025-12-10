import { hasTimeOverlap } from './conflictChecker';
import type {
    Schedule,
    StaffAlternative,
    StaffAlternativeRequest,
    StaffProfile
} from './types';

/**
 * ──────────────────────────────────────────────────────────────
 * Staff Alternative Suggestion Engine
 * ──────────────────────────────────────────────────────────────
 *
 * ConflictRuleシステムの逆利用による職員代替案提案エンジン。
 * 「空きリソース検出 + スキルマッチング + 優先度計算」で
 * 安全な職員交代候補を動的に生成。
 */

/**
 * 職員代替案を提案する中核関数
 *
 * @param request - 提案リクエスト（対象スケジュール、必須スキル等）
 * @param allStaffProfiles - 全職員のプロファイル情報
 * @param allSchedules - 全スケジュール（重複チェック用）
 * @returns 優先度順の職員代替案リスト
 */
export function suggestStaffAlternatives(
  request: StaffAlternativeRequest,
  allStaffProfiles: readonly StaffProfile[],
  allSchedules: readonly Schedule[],
): StaffAlternative[] {
  const {
    targetSchedule,
    requiredSkills = [],
    excludeStaffIds = [],
    maxSuggestions = 5,
  } = request;

  const { start, end } = targetSchedule;

  // 1. 基本フィルタリング：除外対象を排除
  const candidateStaff = allStaffProfiles.filter(
    staff => !excludeStaffIds.includes(staff.id)
  );

  // 2. 各職員の空き状況とスキル適合性を評価
  const evaluatedAlternatives = candidateStaff
    .map(staff => evaluateStaffForAlternative(staff, start, end, requiredSkills, allSchedules))
    .filter(alternative => alternative !== null) as StaffAlternative[];

  // 3. 優先度でソートして最大件数まで返却
  return evaluatedAlternatives
    .sort((a, b) => b.priority - a.priority)
    .slice(0, maxSuggestions);
}

/**
 * 単一職員の代替案適合性を評価
 *
 * @param staff - 評価対象の職員プロファイル
 * @param startTime - 対象時間帯の開始
 * @param endTime - 対象時間帯の終了
 * @param requiredSkills - 必須スキル
 * @param allSchedules - 全スケジュール（重複チェック用）
 * @returns 職員代替案（適合しない場合はnull）
 */
function evaluateStaffForAlternative(
  staff: StaffProfile,
  startTime: string,
  endTime: string,
  requiredSkills: readonly string[],
  allSchedules: readonly Schedule[],
): StaffAlternative | null {
  // 時間帯重複チェック（ConflictRuleの逆利用）
  const isCurrentlyScheduled = isStaffBusyDuringTime(staff.id, startTime, endTime, allSchedules);

  // スキルマッチング
  const skillsMatched = requiredSkills.length > 0
    ? staff.skills.filter(skill => requiredSkills.includes(skill))
    : [...staff.skills]; // 必須スキル指定なしの場合は全スキルを適合とみなす

  // 優先度計算
  const priority = calculateStaffPriority(staff, skillsMatched, requiredSkills, isCurrentlyScheduled);

  // 提案理由の生成
  const reason = generateAlternativeReason(staff, isCurrentlyScheduled, skillsMatched, requiredSkills);

  // 過負荷警告チェック
  const workloadWarning = checkWorkloadWarning(staff, startTime, endTime, allSchedules);

  return {
    staffId: staff.id,
    staffName: staff.name,
    reason,
    priority,
    skillsMatched,
    currentlyScheduled: isCurrentlyScheduled,
    workloadWarning: workloadWarning || undefined,
  };
}

/**
 * 指定時間帯に職員が忙しいかどうかを判定
 * （ConflictRule.hasTimeOverlapの応用）
 */
function isStaffBusyDuringTime(
  staffId: string,
  startTime: string,
  endTime: string,
  allSchedules: readonly Schedule[],
): boolean {
  return allSchedules.some(schedule => {
    // 職員が関与するスケジュールを特定
    const isStaffInvolved =
      (schedule.category === 'Staff' && schedule.staffIds?.includes(staffId)) ||
      (schedule.category === 'User' && schedule.staffIds?.includes(staffId)) ||
      (schedule.category === 'Org' && schedule.audience?.includes(staffId));

    if (!isStaffInvolved) return false;

    // 時間重複をチェック
    return hasTimeOverlap(startTime, endTime, schedule.start, schedule.end);
  });
}

/**
 * 職員の提案優先度を計算
 */
function calculateStaffPriority(
  staff: StaffProfile,
  skillsMatched: readonly string[],
  requiredSkills: readonly string[],
  isCurrentlyScheduled: boolean,
): number {
  let priority = 0;

  // ベース優先度：空いている職員を優先
  if (!isCurrentlyScheduled) {
    priority += 100;
  }

  // スキルマッチング加点
  const skillMatchRatio = requiredSkills.length > 0
    ? skillsMatched.length / requiredSkills.length
    : 1;
  priority += Math.floor(skillMatchRatio * 50);

  // 専門スキル加点（生活支援、医療的ケア等）
  if (skillsMatched.some(skill => ['生活支援', '医療的ケア', '送迎'].includes(skill))) {
    priority += 20;
  }

  // 多能工職員の加点
  if (staff.skills.length >= 3) {
    priority += 10;
  }

  return priority;
}

/**
 * 職員代替案の提案理由を生成
 */
function generateAlternativeReason(
  staff: StaffProfile,
  isCurrentlyScheduled: boolean,
  skillsMatched: readonly string[],
  requiredSkills: readonly string[],
): string {
  if (isCurrentlyScheduled) {
    return '別の予定が入っています';
  }

  const reasonParts = ['この時間に空いています'];

  // スキル適合性の説明
  if (requiredSkills.length > 0 && skillsMatched.length > 0) {
    const skillText = skillsMatched.slice(0, 2).join('・');
    reasonParts.push(`${skillText}スキル適合`);
  }

  // 専門性のアピール
  const specialSkills = staff.skills.filter(skill =>
    ['生活支援', '医療的ケア', '送迎', '相談支援'].includes(skill)
  );
  if (specialSkills.length > 0) {
    const specialText = specialSkills.slice(0, 1).join('・');
    reasonParts.push(`${specialText}専門職`);
  }

  return reasonParts.join(' / ');
}

/**
 * 過負荷警告をチェック
 */
function checkWorkloadWarning(
  staff: StaffProfile,
  startTime: string,
  endTime: string,
  allSchedules: readonly Schedule[],
): string | null {
  // 連続勤務時間のチェック（簡易版）
  const staffSchedulesToday = allSchedules.filter(schedule => {
    const isStaffInvolved =
      (schedule.category === 'Staff' && schedule.staffIds?.includes(staff.id)) ||
      (schedule.category === 'User' && schedule.staffIds?.includes(staff.id));

    if (!isStaffInvolved) return false;

    // 同日判定（簡易）
    const scheduleDate = new Date(schedule.start).toDateString();
    const targetDate = new Date(startTime).toDateString();
    return scheduleDate === targetDate;
  });

  // 既に4時間以上の勤務がある場合の警告
  if (staffSchedulesToday.length >= 3) {
    return '既に複数の予定があります';
  }

  return null;
}

/**
 * デモ用のスタッフプロファイルを生成
 * （本来は SharePoint Staff_Master から取得）
 */
export function generateDemoStaffProfiles(): StaffProfile[] {
  return [
    {
      id: '301',
      name: '阿部 真央',
      skills: ['生活支援', '送迎', '相談支援'],
      roles: ['支援員', 'ドライバー'],
      workDays: ['月', '火', '水', '木', '金'],
      baseShiftStart: '09:00',
      baseShiftEnd: '17:00',
    },
    {
      id: '302',
      name: '佐伯 由真',
      skills: ['生活支援', '医療的ケア'],
      roles: ['支援員', '看護師'],
      workDays: ['月', '火', '水', '木', '金'],
      baseShiftStart: '08:30',
      baseShiftEnd: '17:30',
    },
    {
      id: '303',
      name: '佐藤 直樹',
      skills: ['生活支援', 'レクリエーション'],
      roles: ['支援員'],
      workDays: ['月', '火', '水', '木', '金', '土'],
      baseShiftStart: '10:00',
      baseShiftEnd: '18:00',
    },
    {
      id: '304',
      name: '鈴木 文',
      skills: ['送迎', '機能訓練', '生活支援'],
      roles: ['ドライバー', '機能訓練士'],
      workDays: ['火', '水', '木', '金', '土'],
      baseShiftStart: '09:00',
      baseShiftEnd: '17:00',
    },
    {
      id: '305',
      name: '山田 明',
      skills: ['管理', '相談支援', '生活支援'],
      roles: ['管理者', '相談支援専門員'],
      workDays: ['月', '火', '水', '木', '金'],
      baseShiftStart: '08:30',
      baseShiftEnd: '17:30',
    },
  ];
}
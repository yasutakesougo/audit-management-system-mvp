/**
 * 配置資格チェック — 純粋ドメイン関数
 *
 * 加算対象者に配置されている職員が、必要な資格（基礎研修以上）を
 * 保持しているかを判定する。
 *
 * 判定ロジック:
 *   - 対象利用者にアクティブ配置されている職員のうち、
 *     主担当（primary）が基礎研修未修了であれば「資格なし配置」と判定
 *   - 配置がない利用者はチェックしない（未配置は別の問題）
 *
 * @see qualificationAssignment.ts — QualificationAssignment 型
 * @see severeAddonFindings.ts — usersWithoutAssignmentQualification フィールド
 */

// ---------------------------------------------------------------------------
// 最小インターフェース（OOM対策: 元の型をimportしない）
// ---------------------------------------------------------------------------

export interface AssignmentMinimal {
  staffId: string;
  userId: string;
  assignedFrom: string;
  assignedTo?: string;
  assignmentType: string;
}

export interface StaffCertMinimal {
  staffId: string;
  certifications: string[];
}

// ---------------------------------------------------------------------------
// Core Function
// ---------------------------------------------------------------------------

/**
 * 配置に必要な資格を持たない職員が配置されている利用者を特定する。
 *
 * @param targetUserIds — チェック対象の利用者ID一覧（加算候補者のみ渡せばよい）
 * @param assignments — 全配置履歴
 * @param staffCerts — 職員の資格情報（staffId → certifications）
 * @param today — 基準日 (YYYY-MM-DD)
 */
export function findUsersWithUnqualifiedAssignment(
  targetUserIds: string[],
  assignments: AssignmentMinimal[],
  staffCerts: Map<string, string[]>,
  today: string,
): string[] {
  if (targetUserIds.length === 0) return [];

  const result: string[] = [];

  for (const userId of targetUserIds) {
    // この利用者にアクティブ配置されている primary 職員を取得
    const activeAssignments = assignments.filter(a =>
      a.userId === userId &&
      a.assignmentType === 'primary' &&
      isActive(a, today),
    );

    // 配置がなければスキップ（未配置は別問題）
    if (activeAssignments.length === 0) continue;

    // primary 配置されている職員のうち、基礎研修が未修了の者がいるか
    const hasUnqualified = activeAssignments.some(a => {
      const certs = staffCerts.get(a.staffId) ?? [];
      return !certs.some(c => c.includes('基礎研修') || c.includes('実践研修'));
    });

    if (hasUnqualified) {
      result.push(userId);
    }
  }

  return result;
}

/**
 * 配置がアクティブかを判定する（軽量版）
 */
function isActive(assignment: AssignmentMinimal, today: string): boolean {
  if (assignment.assignedFrom > today) return false;
  if (!assignment.assignedTo) return true;
  return assignment.assignedTo >= today;
}

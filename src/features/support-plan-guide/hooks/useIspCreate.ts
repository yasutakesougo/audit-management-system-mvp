/**
 * useIspCreate — ISP 正式作成アクション hook
 *
 * ドラフトから ISP を正式作成する責務を持つ。
 * `buildIspCreateInput` で UserSnapshot を注入し、
 * `ispRepo.create()` で SharePoint に永続化する。
 *
 * ## 設計原則
 *
 * - **薄いグルー** — ビジネスロジックは domain 層に委譲
 * - **Snapshot は create 時のみ** — update では再計算しない
 * - **利用者未解決はエラー表示** — サイレント失敗を防止
 *
 * ## 依存関係
 *
 * ```
 * SupportPlanForm (draft)
 *     ↓ draftToIspFormValues (変換)
 * buildIspCreateInput(formValues, targetUser)
 *     ↓ IspCreateInput { ...formValues, userSnapshot }
 * ispRepo.create(input)
 *     ↓ mapper が JSON.stringify
 * SharePoint [ISP_Master]
 * ```
 *
 * @see src/domain/isp/buildIspCreateInput.ts
 * @see src/domain/isp/port.ts — IspRepository
 */
import { useCallback, useState } from 'react';

import type { IspRepository } from '@/domain/isp/port';
import type { IspFormValues, IndividualSupportPlan } from '@/domain/isp/schema';
import { buildIspCreateInput, UserNotResolvedError } from '@/domain/isp/buildIspCreateInput';
import type { IspUserMasterLike } from '@/domain/isp/buildIspCreateInput';

import type { SupportPlanForm, SupportPlanDraft } from '../types';
import type { IUserMaster } from '@/features/users/types';

// ─────────────────────────────────────────────
// ドラフト → IspFormValues 変換
// ─────────────────────────────────────────────

/**
 * SupportPlanDraft のフォームデータを IspFormValues に変換する。
 *
 * - SupportPlanForm のフィールドを ISP ドメインのフィールドにマッピング
 * - goals は longTermGoals / shortTermGoals に分離
 *
 * @param form - ドラフトのフォームデータ
 * @param userId - 対象利用者 ID
 * @returns IspFormValues
 */
export function draftToIspFormValues(
  form: SupportPlanForm,
  userId: string,
): IspFormValues {
  // goals から longTermGoals / shortTermGoals を抽出
  const longTermGoals = form.goals
    .filter((g) => g.type === 'long')
    .map((g) => g.label)
    .filter((label) => label.trim().length > 0);

  const shortTermGoals = form.goals
    .filter((g) => g.type === 'short')
    .map((g) => g.label)
    .filter((label) => label.trim().length > 0);

  return {
    userId,
    title: `${form.serviceUserName} 個別支援計画`,
    planStartDate: form.planPeriod.split('〜')[0]?.trim() || new Date().toISOString().slice(0, 10),
    planEndDate: form.planPeriod.split('〜')[1]?.trim() || new Date().toISOString().slice(0, 10),
    userIntent: form.assessmentSummary,
    familyIntent: '',
    overallSupportPolicy: form.decisionSupport,
    qolIssues: form.strengths,
    longTermGoals: longTermGoals.length > 0 ? longTermGoals : ['（長期目標未設定）'],
    shortTermGoals: shortTermGoals.length > 0 ? shortTermGoals : ['（短期目標未設定）'],
    supportSummary: form.conferenceNotes,
    precautions: form.riskManagement,
    status: 'assessment',
  };
}

// ─────────────────────────────────────────────
// UserLookup ビルダー
// ─────────────────────────────────────────────

/**
 * 利用者マスタ配列から UserID → IUserMaster の Map を構築する。
 * O(1) ルックアップを実現。
 */
export function buildUserLookup(users: IUserMaster[]): ReadonlyMap<string, IUserMaster> {
  const map = new Map<string, IUserMaster>();
  for (const u of users) {
    if (u.UserID) {
      map.set(u.UserID, u);
    }
  }
  return map;
}

// ─────────────────────────────────────────────
// Hook Return 型
// ─────────────────────────────────────────────

export type UseIspCreateReturn = {
  /** ISP 正式作成を実行する */
  handleCreateIsp: () => Promise<void>;
  /** 作成中フラグ */
  isCreating: boolean;
  /** 直近の作成エラー */
  createError: string | null;
  /** 作成結果（成功時） */
  createdIsp: IndividualSupportPlan | null;
};

export type UseIspCreateParams = {
  /** 現在のアクティブドラフト */
  activeDraft: SupportPlanDraft | undefined;
  /** 利用者マスタ一覧 */
  userList: IUserMaster[];
  /** ISP Repository（null の場合は作成不可） */
  ispRepo: IspRepository | null;
  /** 成功時のコールバック */
  onSuccess?: (isp: IndividualSupportPlan) => void;
  /** エラー時のコールバック */
  onError?: (error: string) => void;
};

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

export function useIspCreate({
  activeDraft,
  userList,
  ispRepo,
  onSuccess,
  onError,
}: UseIspCreateParams): UseIspCreateReturn {
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdIsp, setCreatedIsp] = useState<IndividualSupportPlan | null>(null);

  const handleCreateIsp = useCallback(async () => {
    if (!activeDraft) {
      const msg = 'アクティブなドラフトがありません';
      setCreateError(msg);
      onError?.(msg);
      return;
    }

    if (!ispRepo) {
      const msg = '個別支援計画リポジトリが初期化されていません';
      setCreateError(msg);
      onError?.(msg);
      return;
    }

    // 利用者 ID の解決
    const userId = activeDraft.userId
      ? String(activeDraft.userId)
      : activeDraft.userCode ?? '';

    if (!userId) {
      const msg = '対象利用者が選択されていません';
      setCreateError(msg);
      onError?.(msg);
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      // ドラフト → IspFormValues
      const formValues = draftToIspFormValues(activeDraft.data, userId);

      // 利用者マスタの lookup
      const userLookup = buildUserLookup(userList);
      const targetUser = userLookup.get(userId) as IspUserMasterLike | undefined;

      // IspCreateInput 組み立て（Snapshot 注入）
      const input = buildIspCreateInput(formValues, targetUser);

      // SharePoint に永続化
      const created = await ispRepo.create(input);

      setCreatedIsp(created);
      onSuccess?.(created);
    } catch (err) {
      let msg: string;
      if (err instanceof UserNotResolvedError) {
        msg = '対象利用者が見つかりません。利用者マスタを確認してください。';
      } else {
        msg = err instanceof Error ? err.message : '個別支援計画の作成に失敗しました';
      }
      setCreateError(msg);
      onError?.(msg);
    } finally {
      setIsCreating(false);
    }
  }, [activeDraft, userList, ispRepo, onSuccess, onError]);

  return {
    handleCreateIsp,
    isCreating,
    createError,
    createdIsp,
  };
}

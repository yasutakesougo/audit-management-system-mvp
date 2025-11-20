import { HYDRATION_FEATURES, estimatePayloadSize, startFeatureSpan } from '@/hydration/features';
import { useCallback, useState } from 'react';

export type MeetingKind = 'morning' | 'evening';
export type MeetingStepId = number;

export type MeetingStep = {
  id: MeetingStepId;
  title: string;
  description: string;
  completed: boolean;
  timeSpent: number;
  // Option B: アラート対応ステップかどうか
  hasHandoffAlert?: boolean;
};

type MeetingStepTemplate = Omit<MeetingStep, 'completed' | 'timeSpent'>;

// 🔸 朝会ステップの「マスタ定義」
const MORNING_STEP_TEMPLATES: MeetingStepTemplate[] = [
  {
    id: 1,
    title: 'Safety HUD 確認',
    description: '今日の安全インジケーター・予定の重なり状況',
  },
  {
    id: 2,
    title: '⚠️ 重要な申し送りを確認する',
    description: '昨日の重要案件・ヒヤリを確認し、今日のフォロー体制を整える',
    hasHandoffAlert: true,
  },
  {
    id: 3,
    title: '昨日からの申し送り',
    description: '注意・対応中の案件を最初に確認',
  },
  {
    id: 4,
    title: '今日の重点フォロー',
    description: '強度行動障害対象者の状況確認',
  },
  {
    id: 5,
    title: '本日の優先予定',
    description: 'スタッフレーンの重要な会議・業務',
  },
  {
    id: 6,
    title: '支援記録の分担確認',
    description: '日誌・支援手順の担当割り振り',
  },
];

// 🔸 夕会ステップの「マスタ定義」
const EVENING_STEP_TEMPLATES: MeetingStepTemplate[] = [
  {
    id: 1,
    title: '日次記録の進捗確認',
    description: '進捗バーで完了状況を確認',
  },
  {
    id: 2,
    title: '⚠️ 今日の重要事項を振り返る',
    description: '今日の重要案件・ヒヤリを振り返り、明日への引き継ぎを整理する',
    hasHandoffAlert: true,
  },
  {
    id: 3,
    title: '健康・行動トピック',
    description: '発作・問題行動の報告と対応確認',
  },
  {
    id: 4,
    title: '今日の出来事・良い支援の共有',
    description: 'ポジティブな情報共有',
  },
  {
    id: 5,
    title: '明日への申し送り候補',
    description: '引き継ぐべき注意事項の整理',
  },
];

// kind に応じて初期ステップ配列を生成
export const createInitialSteps = (kind: MeetingKind): MeetingStep[] => {
  const templates =
    kind === 'morning' ? MORNING_STEP_TEMPLATES : EVENING_STEP_TEMPLATES;

  return templates.map((t) => ({
    ...t,
    completed: false,
    timeSpent: 0,
  }));
};

// � Phase 5A: SharePoint からのステップ記録をローカル状態にマージ
export const mergeStepRecordsWithTemplates = (
  kind: MeetingKind,
  stepRecords: { stepId: number; completed: boolean; timeSpent?: number }[]
): MeetingStep[] => {
  const templates = kind === 'morning' ? MORNING_STEP_TEMPLATES : EVENING_STEP_TEMPLATES;
  const span = startFeatureSpan(HYDRATION_FEATURES.meeting.derive, {
    kind,
    recordCount: stepRecords.length,
    recordBytes: estimatePayloadSize(stepRecords),
    templateCount: templates.length,
    templateBytes: estimatePayloadSize(templates),
  });

  try {
    const merged = templates.map((template) => {
      const record = stepRecords.find(r => r.stepId === template.id);
      return {
        ...template,
        completed: record?.completed ?? false,
        timeSpent: record?.timeSpent ?? 0,
      };
    });

    span({
      meta: {
        status: 'ok',
        outputCount: merged.length,
        outputBytes: estimatePayloadSize(merged),
      },
    });
    return merged;
  } catch (error) {
    span({
      meta: { status: 'error' },
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

// �🔹 DashboardPage や MeetingGuidePage から使うためのフック
export const useMeetingSteps = (kind: MeetingKind) => {
  const [steps, setSteps] = useState<MeetingStep[]>(() =>
    createInitialSteps(kind),
  );

  const toggleStep = useCallback((id: MeetingStepId) => {
    setSteps((prev) =>
      prev.map((step) =>
        step.id === id
          ? { ...step, completed: !step.completed }
          : step,
      ),
    );
  }, []);

  // 🆕 Phase 5A: 外部データからの初期化メソッド
  const setStepsFromServer = useCallback((serverSteps: MeetingStep[]) => {
    setSteps(serverSteps);
  }, []);

  const completedCount = steps.filter((s) => s.completed).length;

  return {
    steps,
    toggleStep,
    setStepsFromServer,
    completedCount,
    total: steps.length,
  };
};
import {
  coerceEnvFactorId,
  coerceMoodId,
  coercePersonFactorId,
  coerceStrengthId,
  envFactorsById,
  personFactorsById,
} from '../../config/master';
import type { EnvFactorId, MoodId, PersonFactorId, StrengthId } from '../../config/master';

export type Recommendation = {
  id: string;
  title: string;
  rationale: string;
  actions: string[];
  stage: 'proactive' | 'earlyResponse' | 'crisis';
  evidenceTag?: string;
};

type RecommendationInput = {
  strengths: StrengthId[];
  iceberg: { kind: 'person' | 'environment'; id: PersonFactorId | EnvFactorId; label: string }[];
  abc?: { A?: string; B?: string; C?: string };
  moodId?: MoodId;
};

export const useRecommendations = (input: RecommendationInput): Recommendation[] => {
  const featureEnabled = String(import.meta.env.VITE_FEATURE_SUPPORT_CDS || 'false') === 'true';
  if (!featureEnabled) {
    return [];
  }

  const normalizedMoodId = coerceMoodId(input.moodId);
  const normalizedStrengths = Array.from(
    new Set(
      (input.strengths ?? [])
        .map((strength) => coerceStrengthId(strength))
        .filter((strengthId): strengthId is StrengthId => Boolean(strengthId)),
    ),
  );
  const normalizedIceberg = (input.iceberg ?? [])
    .map((factor) => {
      const normalizedId =
        factor.kind === 'person'
          ? coercePersonFactorId(factor.id ?? factor.label)
          : coerceEnvFactorId(factor.id ?? factor.label);
      if (!normalizedId) {
        return null;
      }
      const catalog =
        factor.kind === 'person'
          ? personFactorsById[normalizedId as PersonFactorId]
          : envFactorsById[normalizedId as EnvFactorId];
      if (!catalog) {
        return null;
      }
      return {
        kind: factor.kind,
        id: normalizedId,
        label: catalog.label,
      };
    })
    .filter((factor): factor is RecommendationInput['iceberg'][number] => Boolean(factor));

  const out: Recommendation[] = [];

  if (normalizedIceberg.some((factor) => factor.id === 'auditorySensitivity')) {
    out.push({
      id: 'env-noise-1',
      title: '環境ノイズの即時緩和',
      rationale: '氷山モデル: 聴覚過敏 → 刺激量の制御が第一選択',
      actions: ['遮音イヤーマフを準備', '静かな席へ移動', '5分/1分の二段階予告で見通し提供'],
      stage: 'proactive',
      evidenceTag: '環境調整',
    });
  }

  if ((input.abc?.C ?? '').includes('注目') || normalizedMoodId === 'signsEmerging') {
    out.push({
      id: 'aba-dra-1',
      title: '分化強化で望ましい代替行動に注目を付与',
      rationale: 'ABA: 注目の機能 → 望ましい行動へ肯定的注目をシフト',
      actions: ['適切行動に即時の短い称賛', '問題行動は計画的無視を検討', '代替行動の選択肢を具体提示'],
      stage: 'earlyResponse',
      evidenceTag: 'ABA/分化強化',
    });
  }

  if (normalizedStrengths.some((strength) => ['predictability', 'routine', 'visualSupport'].includes(strength))) {
    out.push({
      id: 'visual-schedule-1',
      title: '絵カードスケジュールを提示',
      rationale: '強みの活用: 見通し/ルーティン嗜好',
      actions: ['次の2手順をカードで明示', '5分/1分の予告で切替を円滑化'],
      stage: 'proactive',
    });
  }

  return out;
};

import type { UserProfile } from '../../types/userProfile';
import {
  coerceStrengthId,
  envFactors,
  personFactors,
  type StrengthId,
  type PersonFactorId,
  type EnvFactorId,
} from '../../config/master';

type AssessmentDefaults = {
  strengths: StrengthId[];
  iceberg: {
    kind: 'person' | 'environment';
    id: PersonFactorId | EnvFactorId;
    label: string;
  }[];
  aba: undefined;
};

export const profileToAssessmentLiteDefaults = (profile: UserProfile): AssessmentDefaults => {
  const strengths = (profile.assessments?.strengths ?? [])
    .map(coerceStrengthId)
    .filter((id): id is StrengthId => Boolean(id));

  const iceberg = (profile.assessments?.iceberg ?? []).map((item) => {
    const catalog = item.kind === 'person' ? personFactors : envFactors;
    const found =
      catalog.find((entry) => entry.id === item.id) ??
      ({
        id: item.id,
        label: item.label,
      } as { id: PersonFactorId | EnvFactorId; label: string });
    return {
      kind: item.kind,
      id: found.id,
      label: found.label,
    };
  });
  return {
    strengths,
    iceberg,
    aba: undefined,
  };
};

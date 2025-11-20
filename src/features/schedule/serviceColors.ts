import { alpha, type Theme } from '@mui/material/styles';

export type ServiceTypeKey = 'normal' | 'transport' | 'respite' | 'nursing' | 'absence' | 'other';

export type ServiceColorTokens = {
  bg: string;
  border: string;
  hoverBg: string;
  accent: string;
  pillBg: string;
  pillText: string;
};

export type ScheduleColorSource = {
  serviceType?: string | null;
  category?: string | null;
  personType?: string | null;
  notes?: string | null;
  title?: string | null;
  billingFlags?: string[] | null;
};

const LEGACY_SERVICE_COLOR_BASE: Record<ServiceTypeKey, { main: string; accent?: string; pillText?: string }> = {
  normal: { main: '#0EA5E9', accent: '#0369A1' },
  transport: { main: '#16A34A', accent: '#15803D' },
  respite: { main: '#F59E0B', accent: '#B45309', pillText: '#1C1917' },
  nursing: { main: '#A855F7', accent: '#7C3AED' },
  absence: { main: '#94A3B8', accent: '#475569', pillText: '#F8FAFC' },
  other: { main: '#14B8A6', accent: '#0F766E' },
};

const includesAny = (text: string, keywords: string[]): boolean => keywords.some((keyword) => text.includes(keyword));

export const inferServiceTypeKeyFromLabel = (label?: string | null): ServiceTypeKey => {
  if (!label) return 'other';
  const normalized = label.trim().toLowerCase();
  if (!normalized) return 'other';

  if (includesAny(normalized, ['欠席', '休暇', '病欠', 'absent', 'absence', '欠勤', '休み', 'キャンセル'])) {
    return 'absence';
  }
  if (includesAny(normalized, ['送迎', 'ドライバー', 'transport', 'driver'])) {
    return 'transport';
  }
  if (includesAny(normalized, ['一時', '短期', 'ショート', 'レスパイト', 'respite'])) {
    return 'respite';
  }
  if (includesAny(normalized, ['看護', 'ナース', '医療', 'nurse'])) {
    return 'nursing';
  }
  if (includesAny(normalized, ['日中活動', '通常利用', '通常', 'ケース', '通所'])) {
    return 'normal';
  }
  return 'other';
};

export const inferServiceTypeKeyFromSchedule = (schedule: ScheduleColorSource): ServiceTypeKey => {
  const directSources = [schedule.serviceType, schedule.category, schedule.personType];
  for (const source of directSources) {
    const key = inferServiceTypeKeyFromLabel(source);
    if (key !== 'other') {
      return key;
    }
  }

  const joined = [
    schedule.serviceType,
    schedule.category,
    schedule.personType,
    schedule.notes,
    schedule.title,
    ...(schedule.billingFlags ?? []),
  ]
    .filter(Boolean)
    .join(' ');

  const fallback = inferServiceTypeKeyFromLabel(joined);
  return fallback === 'other' ? 'other' : fallback;
};

const buildPalette = (theme: Theme): Record<ServiceTypeKey, { bg: string; border: string; pillBg: string; pillText: string; accent: string }> => {
  if (theme.serviceTypeColors) {
    return theme.serviceTypeColors;
  }
  const backgroundAlpha = theme.palette.mode === 'dark' ? 0.35 : 0.18;
  const borderAlpha = theme.palette.mode === 'dark' ? 0.75 : 0.5;

  const createTokens = (config: { main: string; accent?: string; pillText?: string }) => {
    const accent = config.accent ?? config.main;
    return {
      bg: alpha(config.main, backgroundAlpha),
      border: alpha(accent, borderAlpha),
      pillBg: accent,
      pillText: config.pillText ?? theme.palette.getContrastText(accent),
      accent,
    };
  };

  return {
    normal: createTokens(LEGACY_SERVICE_COLOR_BASE.normal),
    transport: createTokens(LEGACY_SERVICE_COLOR_BASE.transport),
    respite: createTokens(LEGACY_SERVICE_COLOR_BASE.respite),
    nursing: createTokens(LEGACY_SERVICE_COLOR_BASE.nursing),
    absence: createTokens(LEGACY_SERVICE_COLOR_BASE.absence),
    other: createTokens(LEGACY_SERVICE_COLOR_BASE.other),
  };
};

export const getServiceColorTokens = (theme: Theme, key: ServiceTypeKey): ServiceColorTokens => {
  const palette = buildPalette(theme);
  const base = palette[key] ?? palette.other;
  return {
    ...base,
    hoverBg: alpha(base.accent, theme.palette.mode === 'dark' ? 0.35 : 0.18),
  };
};

export const getScheduleColorTokens = (theme: Theme, schedule: ScheduleColorSource): ServiceColorTokens => {
  const key = inferServiceTypeKeyFromSchedule(schedule);
  return getServiceColorTokens(theme, key);
};

export const getLabelColorTokens = (theme: Theme, label?: string | null): ServiceColorTokens => {
  const key = inferServiceTypeKeyFromLabel(label);
  return getServiceColorTokens(theme, key);
};

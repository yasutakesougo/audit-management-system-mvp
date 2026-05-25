export type KioskProcedureMemoParts = {
  mood: string;
  action: string;
  result: string;
  memo: string;
};

const LABELS = {
  mood: '様子',
  action: '対応',
  result: '変化',
  memo: 'メモ',
} as const;

const LABEL_PATTERN = /【(様子|対応|変化|メモ)】([\s\S]*?)(?=\n?【(?:様子|対応|変化|メモ)】|$)/g;

export function parseKioskProcedureMemo(value: unknown): KioskProcedureMemoParts {
  const raw = String(value ?? '');
  const parts: KioskProcedureMemoParts = {
    mood: '',
    action: '',
    result: '',
    memo: '',
  };

  let hasKnownLabel = false;
  for (const match of raw.matchAll(LABEL_PATTERN)) {
    hasKnownLabel = true;
    const label = match[1];
    const text = match[2].trim();
    if (label === LABELS.mood) parts.mood = text;
    if (label === LABELS.action) parts.action = text;
    if (label === LABELS.result) parts.result = text;
    if (label === LABELS.memo) parts.memo = text;
  }

  if (!hasKnownLabel && raw.trim()) {
    parts.memo = raw.trim();
  }

  return parts;
}

export function serializeKioskProcedureMemo(parts: Partial<KioskProcedureMemoParts>): string {
  const lines: string[] = [];
  const mood = parts.mood?.trim();
  const action = parts.action?.trim();
  const result = parts.result?.trim();
  const memo = parts.memo?.trim();

  if (mood) lines.push(`【${LABELS.mood}】${mood}`);
  if (action) lines.push(`【${LABELS.action}】${action}`);
  if (result) lines.push(`【${LABELS.result}】${result}`);
  if (memo) lines.push(`【${LABELS.memo}】${memo}`);

  return lines.join('\n');
}

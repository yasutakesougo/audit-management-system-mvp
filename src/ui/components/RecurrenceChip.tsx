import React from 'react';

export type RecurrenceMeta = {
  rrule?: string | null;
  text?: string | null;
};

export const RecurrenceChip: React.FC<{ meta: RecurrenceMeta | null }> = ({ meta }) => {
  if (!meta) return null;
  const { text, rrule } = meta;
  const label = text || rrule || '繰り返し';
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
      {label}
    </span>
  );
};

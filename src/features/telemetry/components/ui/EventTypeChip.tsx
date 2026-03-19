import { TYPE_COLORS, TYPE_LABELS } from '../constants/labels';

export function EventTypeChip({ type }: { type: string }) {
  const bg = TYPE_COLORS[type] ?? '#94a3b8';
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 600,
        color: '#fff',
        background: bg,
        whiteSpace: 'nowrap',
      }}
    >
      {TYPE_LABELS[type] ?? type}
    </span>
  );
}

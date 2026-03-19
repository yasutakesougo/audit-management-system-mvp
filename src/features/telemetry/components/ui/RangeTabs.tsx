import type { DateRange } from '../../hooks/useTelemetryDashboard';
import { RANGE_LABELS } from '../constants/labels';

export function RangeTabs({
  current,
  onChange,
  disabled,
}: {
  current: DateRange;
  onChange: (r: DateRange) => void;
  disabled?: boolean;
}) {
  const ranges: DateRange[] = ['today', '7d', '30d'];
  return (
    <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 10, padding: 3 }}>
      {ranges.map((r) => {
        const active = r === current;
        return (
          <button
            key={r}
            type="button"
            disabled={disabled}
            onClick={() => onChange(r)}
            style={{
              padding: '6px 16px',
              borderRadius: 8,
              border: 'none',
              background: active ? '#fff' : 'transparent',
              color: active ? '#1e293b' : '#94a3b8',
              fontWeight: active ? 600 : 400,
              fontSize: 13,
              cursor: disabled ? 'wait' : 'pointer',
              boxShadow: active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            {RANGE_LABELS[r]}
          </button>
        );
      })}
    </div>
  );
}

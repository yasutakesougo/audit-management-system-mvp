/**
 * EventRankRow — イベント別ランキング行
 */

import type { EventRankItem } from '../../hooks/useTelemetryDashboard';
import { TYPE_COLORS, TYPE_SHORT } from '../constants';

export function EventRankRow({
  item,
  rank,
  maxCount,
}: {
  item: EventRankItem;
  rank: number;
  maxCount: number;
}) {
  const pct = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
  const color = TYPE_COLORS[item.type] ?? '#94a3b8';
  const typeLabel = TYPE_SHORT[item.type] ?? item.type;
  const displayEvent = item.event === '(none)' ? '—' : item.event;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <div style={{
        width: 20,
        fontSize: 12,
        fontWeight: 700,
        color: rank <= 3 ? '#f59e0b' : '#94a3b8',
        textAlign: 'right',
        flexShrink: 0,
      }}>
        {rank}
      </div>
      <div style={{
        width: 50,
        flexShrink: 0,
      }}>
        <span style={{
          display: 'inline-block',
          padding: '1px 6px',
          borderRadius: 8,
          fontSize: 10,
          fontWeight: 600,
          color: '#fff',
          background: color,
          whiteSpace: 'nowrap',
        }}>
          {typeLabel}
        </span>
      </div>
      <div style={{
        width: 140,
        fontSize: 12,
        color: '#334155',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}>
        {displayEvent}
      </div>
      <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 4, height: 18, overflow: 'hidden' }}>
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: `${color}90`,
            borderRadius: 4,
            transition: 'width 0.5s ease',
            minWidth: pct > 0 ? 4 : 0,
          }}
        />
      </div>
      <div style={{ width: 32, fontSize: 12, fontWeight: 600, color: '#334155', textAlign: 'right' }}>
        {item.count}
      </div>
    </div>
  );
}

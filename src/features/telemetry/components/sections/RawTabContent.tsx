import type { DateRange, TelemetryStats } from '../../hooks/useTelemetryDashboard';
import { PHASE_LABELS, RANGE_LABELS, TYPE_COLORS, TYPE_LABELS } from '../constants/labels';
import { formatDate, formatTime } from '../formatters';
import { PhaseBar } from '../charts/PhaseBar';
import { EmptyState } from '../ui/EmptyState';
import { EventRankRow } from '../ui/EventRankRow';
import { EventTypeChip } from '../ui/EventTypeChip';
import { SectionCard } from '../ui/SectionCard';
import { SectionTitle } from '../ui/SectionTitle';
import { StatCard } from '../ui/StatCard';

const RANKING_PREVIEW_COUNT = 8;

type RawTabContentProps = {
  stats: TelemetryStats;
  range: DateRange;
  showAllRanking: boolean;
  onToggleShowAllRanking: () => void;
};

export function RawTabContent({
  stats,
  range,
  showAllRanking,
  onToggleShowAllRanking,
}: RawTabContentProps) {
  const maxPhaseCount = Math.max(...Object.values(stats.byPhase), 1);
  const maxEventCount = stats.eventRanking.length > 0 ? stats.eventRanking[0].count : 1;
  const showDate = range !== 'today';
  const visibleRanking = showAllRanking
    ? stats.eventRanking
    : stats.eventRanking.slice(0, RANKING_PREVIEW_COUNT);
  const hasMoreRanking = stats.eventRanking.length > RANKING_PREVIEW_COUNT;

  return (
    <>
      <section style={{ marginBottom: 20 }}>
        <SectionTitle>{RANGE_LABELS[range]}のイベント数</SectionTitle>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <StatCard label="TOTAL" count={stats.total} color="#1e293b" />
          {Object.entries(stats.byType)
            .sort(([, a], [, b]) => b - a)
            .map(([type, count]) => (
              <StatCard
                key={type}
                label={TYPE_LABELS[type] ?? type}
                count={count}
                color={TYPE_COLORS[type] ?? '#94a3b8'}
              />
            ))}
        </div>
      </section>

      <SectionCard>
        <SectionTitle>🏆 イベント別ランキング</SectionTitle>
        {stats.eventRanking.length === 0 ? (
          <EmptyState message="イベントデータがありません" />
        ) : (
          <>
            {visibleRanking.map((item, i) => (
              <EventRankRow
                key={item.key}
                item={item}
                rank={i + 1}
                maxCount={maxEventCount}
              />
            ))}
            {hasMoreRanking && (
              <button
                type="button"
                onClick={onToggleShowAllRanking}
                style={{
                  display: 'block',
                  margin: '8px auto 0',
                  padding: '4px 16px',
                  borderRadius: 6,
                  border: '1px solid #e2e8f0',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: 12,
                  color: '#64748b',
                }}
              >
                {showAllRanking
                  ? '▲ 折りたたむ'
                  : `▼ 残り ${stats.eventRanking.length - RANKING_PREVIEW_COUNT} 件を表示`}
              </button>
            )}
          </>
        )}
      </SectionCard>

      {Object.keys(stats.byPhase).length > 0 && (
        <SectionCard>
          <SectionTitle>フェーズ分布</SectionTitle>
          {Object.entries(stats.byPhase)
            .sort(([, a], [, b]) => b - a)
            .map(([phase, count]) => (
              <PhaseBar
                key={phase}
                label={PHASE_LABELS[phase] ?? phase}
                count={count}
                maxCount={maxPhaseCount}
              />
            ))}
        </SectionCard>
      )}

      <SectionCard>
        <SectionTitle>最新イベント（直近10件）</SectionTitle>
        {stats.latestEvents.length === 0 ? (
          <EmptyState message={`${RANGE_LABELS[range]}のイベントはまだありません`} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                  {showDate && (
                    <th style={{ textAlign: 'left', padding: '8px 8px', color: '#64748b', fontWeight: 600, fontSize: 12 }}>日付</th>
                  )}
                  <th style={{ textAlign: 'left', padding: '8px 8px', color: '#64748b', fontWeight: 600, fontSize: 12 }}>時刻</th>
                  <th style={{ textAlign: 'left', padding: '8px 8px', color: '#64748b', fontWeight: 600, fontSize: 12 }}>タイプ</th>
                  <th style={{ textAlign: 'left', padding: '8px 8px', color: '#64748b', fontWeight: 600, fontSize: 12 }}>イベント</th>
                  <th style={{ textAlign: 'left', padding: '8px 8px', color: '#64748b', fontWeight: 600, fontSize: 12 }}>パス</th>
                </tr>
              </thead>
              <tbody>
                {stats.latestEvents.map((doc) => (
                  <tr key={doc.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    {showDate && (
                      <td style={{ padding: '8px 8px', fontSize: 12, color: '#64748b' }}>
                        {formatDate(doc)}
                      </td>
                    )}
                    <td style={{ padding: '8px 8px', fontFamily: 'monospace', fontSize: 12, color: '#475569' }}>
                      {formatTime(doc)}
                    </td>
                    <td style={{ padding: '8px 8px' }}>
                      <EventTypeChip type={doc.type} />
                    </td>
                    <td style={{ padding: '8px 8px', color: '#334155', fontSize: 12 }}>
                      {doc.event ?? '—'}
                    </td>
                    <td style={{ padding: '8px 8px', color: '#94a3b8', fontFamily: 'monospace', fontSize: 11 }}>
                      {doc.path ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </>
  );
}

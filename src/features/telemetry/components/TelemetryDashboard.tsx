/**
 * TelemetryDashboard — テレメトリダッシュボード v2
 *
 * 5ウィジェット構成:
 * ① 期間切替タブ（今日 / 7日 / 30日）
 * ② イベント数カード（type 別）
 * ③ フェーズ分布（横棒グラフ）
 * ④ イベント別ランキング（type×event 組み合わせ）
 * ⑤ 最新イベント一覧（直近10件テーブル）
 */
import { useState } from 'react';
import { useTelemetryDashboard } from '../hooks/useTelemetryDashboard';
import type { DateRange, EventRankItem, TelemetryDoc } from '../hooks/useTelemetryDashboard';

// ── Label Maps ──────────────────────────────────────────────────────────────

const PHASE_LABELS: Record<string, string> = {
  'am-operation': '午前活動',
  'pm-operation': '午後活動',
  'night-operation': '夜間対応',
  'reception': '受入・送迎',
  'lunch': '昼食',
  'break': '休憩',
};

const TYPE_LABELS: Record<string, string> = {
  todayops_landing: '📍 ランディング',
  todayops_cta_click: '👆 CTAクリック',
  todayops_first_navigation: '🧭 初回ナビ',
  operational_phase_event: '⚡ フェーズイベント',
};

const TYPE_SHORT: Record<string, string> = {
  todayops_landing: 'landing',
  todayops_cta_click: 'cta',
  todayops_first_navigation: 'nav',
  operational_phase_event: 'phase',
};

const TYPE_COLORS: Record<string, string> = {
  todayops_landing: '#3b82f6',
  todayops_cta_click: '#f59e0b',
  todayops_first_navigation: '#10b981',
  operational_phase_event: '#8b5cf6',
};

const RANGE_LABELS: Record<DateRange, string> = {
  today: '今日',
  '7d': '7日間',
  '30d': '30日間',
};

// ── Sub-components ──────────────────────────────────────────────────────────

function RangeTabs({
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

function StatCard({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div
      style={{
        background: '#fff',
        border: `2px solid ${color}20`,
        borderRadius: 12,
        padding: '16px 20px',
        minWidth: 130,
        textAlign: 'center',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}
    >
      <div style={{ fontSize: 32, fontWeight: 700, color, lineHeight: 1.2 }}>
        {count}
      </div>
      <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, fontWeight: 500 }}>
        {label}
      </div>
    </div>
  );
}

function PhaseBar({ label, count, maxCount }: { label: string; count: number; maxCount: number }) {
  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <div style={{ width: 90, fontSize: 13, color: '#475569', textAlign: 'right', flexShrink: 0 }}>
        {label}
      </div>
      <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 6, height: 24, overflow: 'hidden' }}>
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #8b5cf6, #a78bfa)',
            borderRadius: 6,
            transition: 'width 0.5s ease',
            minWidth: pct > 0 ? 4 : 0,
          }}
        />
      </div>
      <div style={{ width: 36, fontSize: 13, fontWeight: 600, color: '#334155', textAlign: 'right' }}>
        {count}
      </div>
    </div>
  );
}

function EventRankRow({
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

function formatTime(doc: TelemetryDoc): string {
  const d = doc.ts ?? (doc.clientTs ? new Date(doc.clientTs) : null);
  if (!d) return '—';
  return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDate(doc: TelemetryDoc): string {
  const d = doc.ts ?? (doc.clientTs ? new Date(doc.clientTs) : null);
  if (!d) return '';
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function EventTypeChip({ type }: { type: string }) {
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

function SectionCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <section
      style={{
        marginBottom: 20,
        background: '#fff',
        borderRadius: 12,
        padding: 20,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        ...style,
      }}
    >
      {children}
    </section>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontSize: 13,
      fontWeight: 600,
      color: '#64748b',
      marginBottom: 14,
      textTransform: 'uppercase',
      letterSpacing: 1,
      margin: '0 0 14px 0',
    }}>
      {children}
    </h2>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8', fontSize: 13 }}>
      {message}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function TelemetryDashboard() {
  const { stats, loading, error, range, setRange, refresh } = useTelemetryDashboard();
  const [showAllRanking, setShowAllRanking] = useState(false);

  // ── Loading ──
  if (loading && !stats) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>📊</div>
        テレメトリデータを読み込んでいます…
      </div>
    );
  }

  // ── Error ──
  if (error && !stats) {
    return (
      <div style={{ padding: 24, background: '#fef2f2', borderRadius: 12, margin: 16 }}>
        <div style={{ fontWeight: 600, color: '#dc2626', marginBottom: 8 }}>
          ⚠️ データ取得エラー
        </div>
        <div style={{ fontSize: 13, color: '#991b1b', marginBottom: 12, fontFamily: 'monospace' }}>
          {error}
        </div>
        <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
          Firestore セキュリティルールで <code>telemetry</code> の read が許可されていない可能性があります。
        </p>
        <button
          type="button"
          onClick={refresh}
          style={{
            marginTop: 12,
            padding: '6px 16px',
            borderRadius: 8,
            border: '1px solid #e5e7eb',
            background: '#fff',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          🔄 再試行
        </button>
      </div>
    );
  }

  if (!stats) return null;

  const maxPhaseCount = Math.max(...Object.values(stats.byPhase), 1);
  const maxEventCount = stats.eventRanking.length > 0 ? stats.eventRanking[0].count : 1;
  const showDate = range !== 'today';

  // ランキング表示件数制御
  const RANKING_PREVIEW = 8;
  const visibleRanking = showAllRanking
    ? stats.eventRanking
    : stats.eventRanking.slice(0, RANKING_PREVIEW);
  const hasMoreRanking = stats.eventRanking.length > RANKING_PREVIEW;

  return (
    <div style={{ padding: 16, maxWidth: 800, margin: '0 auto' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: 0 }}>
            📊 テレメトリダッシュボード
          </h1>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0' }}>
            {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <RangeTabs current={range} onChange={setRange} disabled={loading} />
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              cursor: loading ? 'wait' : 'pointer',
              fontSize: 13,
              fontWeight: 500,
              color: '#475569',
              opacity: loading ? 0.5 : 1,
            }}
          >
            🔄
          </button>
        </div>
      </div>

      {/* ── Loading Overlay (期間切替中) ── */}
      {loading && (
        <div style={{
          textAlign: 'center',
          padding: '8px 0',
          fontSize: 12,
          color: '#94a3b8',
          marginBottom: 8,
        }}>
          ⏳ {RANGE_LABELS[range]}のデータを取得中…
        </div>
      )}

      {/* ── ① イベント数カード ── */}
      <section style={{ marginBottom: 20 }}>
        <SectionTitle>
          {RANGE_LABELS[range]}のイベント数
        </SectionTitle>
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

      {/* ── ② イベント別ランキング (NEW) ── */}
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
                onClick={() => setShowAllRanking(!showAllRanking)}
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
                  : `▼ 残り ${stats.eventRanking.length - RANKING_PREVIEW} 件を表示`}
              </button>
            )}
          </>
        )}
      </SectionCard>

      {/* ── ③ フェーズ分布 ── */}
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

      {/* ── ④ 最新イベント一覧 ── */}
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

      {/* ── Footer ── */}
      <div style={{ marginTop: 12, fontSize: 11, color: '#c0c0c0', textAlign: 'center' }}>
        telemetry collection · {RANGE_LABELS[range]} · max {range === '30d' ? '2000' : range === '7d' ? '500' : '200'} docs
      </div>
    </div>
  );
}

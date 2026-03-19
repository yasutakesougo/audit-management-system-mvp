/**
 * TelemetryDashboard — テレメトリダッシュボード v3 (KPI 可視化)
 *
 * 既存5ウィジェット + 新4ウィジェット構成:
 * ① 期間切替タブ（今日 / 7日 / 30日）
 * ② KPI サマリカード（Hero利用率 / Queue利用率 / 完了率 / CTAクリック総数）
 * ③ 導線分布（Today → どこへ遷移したか）
 * ④ Hero vs Queue 画面別比率
 * ⑤ 完了ファネル（ランディング → クリック → 完了）
 * ⑥ 時間帯別利用分布
 * ⑦ イベント別ランキング（type×event）
 * ⑧ フェーズ分布（横棒グラフ）
 * ⑨ 最新イベント一覧（直近10件テーブル）
 */
import { useState } from 'react';
import { useTelemetryDashboard } from '../hooks/useTelemetryDashboard';
import type { DateRange, EventRankItem, TelemetryDoc } from '../hooks/useTelemetryDashboard';
import type { FlowDistribution, FunnelStep, HourlyBucket, ScreenKpi } from '../domain/computeCtaKpis';
import type { KpiDiff, Trend } from '../domain/computeCtaKpiDiff';
import { RoleBreakdownSection } from './RoleBreakdownSection';
import { getPlaybookEntry } from '../domain/alertPlaybook';
import { generateIssueDraft } from '../domain/generateIssueDraft';
import { ALERT_STATE_LABELS, ALERT_STATE_COLORS, type AlertState, type ClassifiedAlert } from '../domain/classifyAlertState';

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

// ── Shared Sub-components ───────────────────────────────────────────────────

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

// ── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  unit,
  color,
  subLabel,
  diff,
}: {
  label: string;
  value: number | string;
  unit?: string;
  color: string;
  subLabel?: string;
  diff?: KpiDiff;
}) {
  const trendColor: Record<Trend, string> = {
    up: '#10b981',
    down: '#ef4444',
    flat: '#94a3b8',
  };

  return (
    <div
      style={{
        background: `linear-gradient(135deg, ${color}08, ${color}15)`,
        border: `1.5px solid ${color}30`,
        borderRadius: 14,
        padding: '16px 20px',
        minWidth: 150,
        flex: 1,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: 32, fontWeight: 800, color, lineHeight: 1 }}>
          {value}
        </span>
        {unit && (
          <span style={{ fontSize: 14, fontWeight: 600, color: `${color}90` }}>
            {unit}
          </span>
        )}
      </div>
      {diff && (
        <div style={{
          fontSize: 12,
          fontWeight: 600,
          color: trendColor[diff.trend],
          marginTop: 4,
        }}>
          {diff.diffFormatted}
          <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 400, marginLeft: 4 }}>
            vs 前期間
          </span>
        </div>
      )}
      {subLabel && (
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: diff ? 2 : 4 }}>
          {subLabel}
        </div>
      )}
    </div>
  );
}

// ── Alert Chip ──────────────────────────────────────────────────────────────

function AlertChip({ classified }: { classified: ClassifiedAlert }) {
  const { alert, state, delta } = classified;
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const isCritical = alert.severity === 'critical';
  const playbook = getPlaybookEntry(alert.id);

  const handleCopyDraft = () => {
    if (!playbook) return;
    const draft = generateIssueDraft(alert, playbook);
    const text = `# ${draft.title}\n\nLabels: ${draft.labels.join(', ')}\n\n${draft.body}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      style={{
        borderRadius: 10,
        background: isCritical ? '#fef2f2' : '#fffbeb',
        border: `1px solid ${isCritical ? '#fecaca' : '#fed7aa'}`,
        overflow: 'hidden',
      }}
    >
      {/* Main alert row */}
      <div
        onClick={() => playbook && setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          padding: '12px 16px',
          cursor: playbook ? 'pointer' : 'default',
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1.2, flexShrink: 0 }}>
          {isCritical ? '🔴' : '🟡'}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            fontWeight: 600,
            color: isCritical ? '#dc2626' : '#d97706',
            marginBottom: 2,
          }}>
            {alert.label}
            {/* State badge */}
            <span style={{
              fontSize: 10,
              fontWeight: 500,
              padding: '1px 6px',
              borderRadius: 4,
              background: `${ALERT_STATE_COLORS[state]}18`,
              color: ALERT_STATE_COLORS[state],
              whiteSpace: 'nowrap',
            }}>
              {ALERT_STATE_LABELS[state]}
              {delta !== null && delta !== 0 && (
                <span style={{ marginLeft: 3 }}>
                  ({delta > 0 ? '+' : ''}{delta}%)
                </span>
              )}
            </span>
          </div>
          <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.4 }}>
            {alert.message}
          </div>
        </div>
        {playbook && (
          <span style={{
            fontSize: 11,
            color: '#94a3b8',
            flexShrink: 0,
            marginTop: 2,
            transition: 'transform 0.2s ease',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}>
            ▼
          </span>
        )}
      </div>

      {/* Playbook expansion */}
      {expanded && playbook && (
        <div style={{
          padding: '0 16px 14px 42px',
          borderTop: `1px solid ${isCritical ? '#fecaca40' : '#fed7aa40'}`,
        }}>
          {/* 想定原因 */}
          <div style={{ marginTop: 10, marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
              🔍 想定原因
            </div>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
              {playbook.causes.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </div>

          {/* 確認ポイント */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
              ✅ 推奨確認ポイント
            </div>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
              {playbook.checkpoints.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </div>

          {/* 関連画面 */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
              📍 関連画面
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {playbook.relatedScreens.map((s) => (
                <span
                  key={s.path}
                  style={{
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 6,
                    background: '#f1f5f9',
                    color: '#3b82f6',
                    fontWeight: 500,
                  }}
                >
                  {s.label}
                </span>
              ))}
            </div>
          </div>

          {/* Issue Draft — コピーボタン付き */}
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 11,
              fontWeight: 700,
              color: '#475569',
              marginBottom: 4,
            }}>
              📝 Issue 下書き
              <button
                onClick={(e) => { e.stopPropagation(); handleCopyDraft(); }}
                style={{
                  fontSize: 10,
                  padding: '2px 8px',
                  borderRadius: 4,
                  border: '1px solid #cbd5e1',
                  background: copied ? '#dcfce7' : '#ffffff',
                  color: copied ? '#16a34a' : '#64748b',
                  cursor: 'pointer',
                  fontWeight: 500,
                  transition: 'all 0.2s',
                }}
              >
                {copied ? '✓ コピー済み' : '📋 コピー'}
              </button>
            </div>
            <div style={{
              fontSize: 12,
              color: '#334155',
              background: '#f8fafc',
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid #e2e8f0',
              lineHeight: 1.5,
            }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                {playbook.issueTemplate.title}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>
                指標: {alert.value}% (閾値: {alert.threshold}%) | {ALERT_STATE_LABELS[state]}
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {playbook.issueTemplate.labels.map((l) => (
                  <span
                    key={l}
                    style={{
                      fontSize: 10,
                      padding: '1px 6px',
                      borderRadius: 4,
                      background: '#e2e8f0',
                      color: '#475569',
                    }}
                  >
                    #{l}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AlertSection({ classifiedAlerts }: { classifiedAlerts: ClassifiedAlert[] }) {
  if (classifiedAlerts.length === 0) return null;

  // 新規・悪化を上に、改善・継続を下に
  const stateOrder: Record<AlertState, number> = { worsening: 0, new: 1, continuing: 2, improving: 3 };
  const sorted = [...classifiedAlerts].sort((a, b) => stateOrder[a.state] - stateOrder[b.state]);

  return (
    <section style={{ marginBottom: 20 }}>
      <SectionTitle>⚠️ アラート ({classifiedAlerts.length})</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sorted.map((ca) => (
          <AlertChip key={ca.alert.id} classified={ca} />
        ))}
      </div>
    </section>
  );
}

// ── Flow Distribution Chart ─────────────────────────────────────────────────

function FlowDistributionChart({ data }: { data: FlowDistribution[] }) {
  if (data.length === 0) return <EmptyState message="導線データがありません" />;

  const colors = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];

  return (
    <div>
      {/* Bar chart */}
      <div style={{ display: 'flex', gap: 2, height: 32, borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
        {data.map((d, i) => (
          <div
            key={d.destination}
            style={{
              width: `${d.rate}%`,
              background: colors[i % colors.length],
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: d.rate > 0 ? 24 : 0,
              transition: 'width 0.5s ease',
            }}
          >
            {d.rate >= 15 && (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>
                {d.rate}%
              </span>
            )}
          </div>
        ))}
      </div>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {data.map((d, i) => (
          <div key={d.destination} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: colors[i % colors.length], flexShrink: 0 }} />
            <span style={{ color: '#334155', fontWeight: 500 }}>{d.label}</span>
            <span style={{ color: '#94a3b8' }}>{d.count}件</span>
            <span style={{ color: '#94a3b8' }}>({d.rate}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Hero vs Queue Ratio Chart ───────────────────────────────────────────────

function HeroQueueChart({ screenKpis, totalHeroRate }: { screenKpis: ScreenKpi[]; totalHeroRate: number }) {
  if (screenKpis.length === 0) return <EmptyState message="CTA データがありません" />;

  return (
    <div>
      {/* Total ratio bar */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
          <span style={{ color: '#3b82f6', fontWeight: 600 }}>🎯 Hero {totalHeroRate}%</span>
          <span style={{ color: '#f59e0b', fontWeight: 600 }}>📋 Queue {100 - totalHeroRate}%</span>
        </div>
        <div style={{ display: 'flex', height: 24, borderRadius: 8, overflow: 'hidden' }}>
          <div
            style={{
              width: `${totalHeroRate}%`,
              background: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
              transition: 'width 0.5s ease',
              minWidth: totalHeroRate > 0 ? 4 : 0,
            }}
          />
          <div
            style={{
              width: `${100 - totalHeroRate}%`,
              background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
              transition: 'width 0.5s ease',
              minWidth: 100 - totalHeroRate > 0 ? 4 : 0,
            }}
          />
        </div>
      </div>

      {/* Per-screen breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
        {screenKpis.map((s) => (
          <div
            key={s.screen}
            style={{
              background: '#f8fafc',
              borderRadius: 10,
              padding: '10px 14px',
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
              {s.label}
            </div>
            <div style={{ display: 'flex', gap: 4, height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
              <div style={{ width: `${s.heroRate}%`, background: '#3b82f6', borderRadius: 3 }} />
              <div style={{ width: `${100 - s.heroRate}%`, background: '#f59e0b', borderRadius: 3 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b' }}>
              <span>H: {s.heroClicks}</span>
              <span>Q: {s.queueClicks}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Funnel Chart ────────────────────────────────────────────────────────────

function FunnelChart({ steps }: { steps: FunnelStep[] }) {
  if (steps.length === 0) return <EmptyState message="ファネルデータがありません" />;

  const maxCount = Math.max(...steps.map((s) => s.count), 1);
  const colors = ['#3b82f6', '#10b981', '#f59e0b'];

  return (
    <div>
      {steps.map((step, i) => {
        const width = maxCount > 0 ? Math.max((step.count / maxCount) * 100, 8) : 8;
        return (
          <div key={step.label} style={{ marginBottom: i < steps.length - 1 ? 8 : 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
              <span style={{ color: '#334155', fontWeight: 500 }}>
                {i > 0 && <span style={{ color: '#94a3b8', marginRight: 4 }}>→</span>}
                {step.label}
              </span>
              <span style={{ color: '#64748b' }}>
                {step.count}件
                {i > 0 && (
                  <span style={{ color: step.rate >= 50 ? '#10b981' : '#ef4444', fontWeight: 600, marginLeft: 6 }}>
                    {step.rate}%
                  </span>
                )}
              </span>
            </div>
            <div style={{ background: '#f1f5f9', borderRadius: 6, height: 20, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${width}%`,
                  height: '100%',
                  background: `linear-gradient(90deg, ${colors[i % colors.length]}, ${colors[i % colors.length]}80)`,
                  borderRadius: 6,
                  transition: 'width 0.5s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {width >= 20 && (
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#fff' }}>{step.count}</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Hourly Distribution Chart ───────────────────────────────────────────────

function HourlyChart({ buckets }: { buckets: HourlyBucket[] }) {
  const maxCount = Math.max(...buckets.map((b) => b.count), 1);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80 }}>
      {buckets.map((b) => {
        const height = maxCount > 0 ? Math.max((b.count / maxCount) * 100, 2) : 2;
        const active = b.count > 0;
        return (
          <div
            key={b.hour}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
            }}
            title={`${b.hour}時: ${b.count}件`}
          >
            <div
              style={{
                width: '100%',
                height: `${height}%`,
                background: active
                  ? 'linear-gradient(180deg, #3b82f6, #60a5fa)'
                  : '#e2e8f0',
                borderRadius: '3px 3px 0 0',
                transition: 'height 0.5s ease',
                minHeight: 2,
              }}
            />
            <span style={{ fontSize: 9, color: '#94a3b8', lineHeight: 1 }}>
              {b.hour}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Legacy Sub-components (preserved) ───────────────────────────────────────

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

// ── Main Component ──────────────────────────────────────────────────────────

export default function TelemetryDashboard() {
  const { stats, kpis, kpiDiffs, roleBreakdown, classifiedAlerts, loading, error, range, setRange, refresh } = useTelemetryDashboard();
  const [showAllRanking, setShowAllRanking] = useState(false);
  const [activeTab, setActiveTab] = useState<'kpi' | 'raw'>('kpi');

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
    <div style={{ padding: 16, maxWidth: 900, margin: '0 auto' }}>
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

      {/* ── View Tabs ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {(['kpi', 'raw'] as const).map((tab) => {
          const active = tab === activeTab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '6px 16px',
                borderRadius: 8,
                border: active ? '1.5px solid #3b82f6' : '1px solid #e2e8f0',
                background: active ? '#eff6ff' : '#fff',
                color: active ? '#1d4ed8' : '#64748b',
                fontWeight: active ? 600 : 400,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {tab === 'kpi' ? '📈 KPI分析' : '📋 イベントログ'}
            </button>
          );
        })}
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

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/*  KPI Tab                                                         */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'kpi' && kpis && (
        <>
          {/* ── ① KPI サマリカード ── */}
          <section style={{ marginBottom: 20 }}>
            <SectionTitle>📊 {RANGE_LABELS[range]}の KPI サマリ</SectionTitle>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <KpiCard
                label="Hero 利用率"
                value={kpis.heroQueueRatio.heroRate}
                unit="%"
                color="#3b82f6"
                subLabel={`${kpis.heroQueueRatio.heroCount}回 / ${kpis.heroQueueRatio.heroCount + kpis.heroQueueRatio.queueCount}回`}
                diff={kpiDiffs?.heroRate}
              />
              <KpiCard
                label="Queue 利用率"
                value={kpis.heroQueueRatio.queueRate}
                unit="%"
                color="#f59e0b"
                subLabel={`${kpis.heroQueueRatio.queueCount}回`}
                diff={kpiDiffs?.queueRate}
              />
              <KpiCard
                label="完了ファネル"
                value={kpis.funnel[2]?.rate ?? 0}
                unit="%"
                color="#10b981"
                subLabel={`CTA→完了 ${kpis.funnel[2]?.count ?? 0}件`}
                diff={kpiDiffs?.completionRate}
              />
              <KpiCard
                label="CTA 総数"
                value={kpis.totalCtaClicks}
                color="#8b5cf6"
                subLabel={`Landing: ${kpis.totalLandings}回`}
                diff={kpiDiffs?.totalCtaClicks}
              />
            </div>
          </section>

          {/* ── ① b アラート ── */}
          {classifiedAlerts.length > 0 && <AlertSection classifiedAlerts={classifiedAlerts} />}

          {/* ── ① c Role Breakdown ── */}
          <RoleBreakdownSection data={roleBreakdown} />

          {/* ── ② 導線分布 ── */}
          <SectionCard>
            <SectionTitle>🧭 導線分布（CTA 遷移先）</SectionTitle>
            <FlowDistributionChart data={kpis.flowDistribution} />
          </SectionCard>

          {/* ── ③ Hero vs Queue 比率 ── */}
          <SectionCard>
            <SectionTitle>🎯 Hero vs Queue 画面別比率</SectionTitle>
            <HeroQueueChart screenKpis={kpis.screenKpis} totalHeroRate={kpis.heroQueueRatio.heroRate} />
          </SectionCard>

          {/* ── ④ ファネル ── */}
          <SectionCard>
            <SectionTitle>🔻 完了ファネル</SectionTitle>
            <FunnelChart steps={kpis.funnel} />
          </SectionCard>

          {/* ── ⑤ 時間帯分布 ── */}
          <SectionCard>
            <SectionTitle>🕐 時間帯別利用分布</SectionTitle>
            <HourlyChart buckets={kpis.hourlyDistribution} />
          </SectionCard>
        </>
      )}

      {/* KPI data unavailable */}
      {activeTab === 'kpi' && !kpis && (
        <SectionCard>
          <EmptyState message="KPI データの算出に必要なイベントがありません" />
        </SectionCard>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/*  Raw Tab (existing)                                              */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'raw' && (
        <>
          {/* ── イベント数カード ── */}
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

          {/* ── イベント別ランキング ── */}
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

          {/* ── フェーズ分布 ── */}
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

          {/* ── 最新イベント一覧 ── */}
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
      )}

      {/* ── Footer ── */}
      <div style={{ marginTop: 12, fontSize: 11, color: '#c0c0c0', textAlign: 'center' }}>
        telemetry collection · {RANGE_LABELS[range]} · max {range === '30d' ? '2000' : range === '7d' ? '500' : '200'} docs
      </div>
    </div>
  );
}

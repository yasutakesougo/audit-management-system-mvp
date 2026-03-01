/**
 * A層: ISP比較エディタ View（純粋表示＋props のみ）
 * a11y: role/aria 属性付き、キーボード完結対応
 */
import { alpha, useTheme, type Theme } from '@mui/material/styles';
import React, { useMemo } from 'react';
import type { DiffSegment, GoalItem, SmartCriterion } from '../data/ispRepo';
import { DOMAINS, SMART_CRITERIA } from '../data/ispRepo';
import type { DomainCoverage, ProgressInfo } from '../hooks/useISPComparisonEditor';

/* ─── SVG Icons (dependency-free) ─── */
const SvgIcon: React.FC<{ d: string; size?: number; color?: string; className?: string }> = ({
  d, size = 20, color = 'currentColor', ...rest
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" focusable="false" {...rest}>
    <path d={d} />
  </svg>
);

const ICON_PATHS = {
  copy: 'M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M16 4h2a2 2 0 0 1 2 2v4M8 4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2z',
  check: 'M20 6L9 17l-5-5',
  clock: 'M12 6v6l4 2M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z',
  alert: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
  chevron: 'M6 9l6 6 6-6',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
  tag: 'M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01',
  sparkles: 'M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z',
} as const;

/* ─── Props ─── */
export interface ISPComparisonEditorViewProps {
  // state
  currentPlan: { userName: string; certExpiry: string; planPeriod: string; goals: GoalItem[] };
  previousPlan: { planPeriod: string; goals: GoalItem[] };
  showDiff: boolean;
  showSmart: boolean;
  activeGoalId: string;
  copiedId: string | null;
  sidebarOpen: boolean;
  // derived
  daysRemaining: number;
  progress: ProgressInfo;
  activeGoal: GoalItem | undefined;
  prevGoal: GoalItem | undefined;
  diff: DiffSegment[] | null;
  domainCoverage: DomainCoverage[];
  // actions
  setActiveGoalId: (id: string) => void;
  copyFromPrevious: (id: string) => void;
  updateGoalText: (id: string, text: string) => void;
  toggleDomain: (goalId: string, domainId: string) => void;
  toggleSidebar: () => void;
  toggleDiff: () => void;
  toggleSmart: () => void;
  // data lifecycle
  loading?: boolean;
  error?: Error | null;
  saving?: boolean;
  savePlan?: () => void;
}

const ISPComparisonEditorView: React.FC<ISPComparisonEditorViewProps> = (props) => {
  const {
    currentPlan, previousPlan, showDiff, showSmart, activeGoalId, copiedId, sidebarOpen,
    daysRemaining, progress, activeGoal, prevGoal, diff, domainCoverage,
    setActiveGoalId, copyFromPrevious, updateGoalText, toggleDomain,
    toggleSidebar, toggleDiff, toggleSmart,
    loading, error, saving, savePlan,
  } = props;

  const theme = useTheme();
  const T = useMemo(() => getThemedStyles(theme), [theme]);

  return (
    <div className="isp-editor" style={S.container}>
      {/* Loading Overlay */}
      {loading && (
        <div style={S.loadingOverlay}>
          <div style={S.spinner} />
          <p style={{ color: '#6b7280', fontSize: 14, marginTop: 12 }}>データを読み込み中…</p>
        </div>
      )}

      {/* Error Banner */}
      {error && !loading && (
        <div style={S.errorBanner} role="alert">
          <SvgIcon d={ICON_PATHS.alert} size={16} color="#dc2626" />
          <span>データ取得に失敗しました。モックデータで表示しています。</span>
        </div>
      )}

      {/* ═══ LEFT SIDEBAR ═══ */}
      <aside
        style={{ ...S.sidebar, width: sidebarOpen ? 260 : 56, minWidth: sidebarOpen ? 260 : 56 }}
        aria-label="更新進捗サイドバー"
      >
        <button
          onClick={toggleSidebar}
          style={S.sidebarToggle}
          aria-label={sidebarOpen ? 'サイドバーを閉じる' : 'サイドバーを開く'}
          aria-expanded={sidebarOpen}
        >
          <span style={{ transform: sidebarOpen ? 'rotate(0deg)' : 'rotate(-90deg)', display: 'inline-block', transition: 'transform 0.3s' }}>
            <SvgIcon d={ICON_PATHS.chevron} size={18} />
          </span>
        </button>

        {sidebarOpen && (
          <div style={{ padding: '16px 20px', animation: 'ispFadeIn 0.3s ease' }}>
            <div style={S.sidebarHeader}>
              <SvgIcon d={ICON_PATHS.file} size={20} color={theme.palette.primary.main} />
              <span style={{ fontWeight: 700, fontSize: 15, color: theme.palette.primary.dark }}>更新進捗</span>
            </div>

            {/* Progress */}
            <div style={S.progressBarOuter} role="progressbar" aria-valuenow={progress.pct} aria-valuemin={0} aria-valuemax={100} aria-label="更新進捗">
              <div style={{ ...T.progressBarInner, width: `${progress.pct}%` }} />
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 20, textAlign: 'right' as const }}>
              {progress.pct}% 完了
            </div>

            {/* Steps */}
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {progress.steps.map((s) => (
                <li key={s.key} style={S.stepRow}>
                  <span style={{ ...S.stepDot, background: s.done ? '#10b981' : '#d1d5db', boxShadow: s.done ? '0 0 8px rgba(16,185,129,0.4)' : 'none' }}>
                    {s.done && <SvgIcon d={ICON_PATHS.check} size={12} color="#fff" />}
                  </span>
                  <span style={{ fontSize: 13, color: s.done ? '#065f46' : '#6b7280' }}>{s.label}</span>
                </li>
              ))}
            </ul>

            {/* Deadline */}
            <div style={{ ...S.deadlineCard, borderColor: daysRemaining < 30 ? '#fca5a5' : daysRemaining < 90 ? '#fcd34d' : '#86efac', background: daysRemaining < 30 ? '#fef2f2' : daysRemaining < 90 ? '#fffbeb' : '#f0fdf4' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                {daysRemaining < 30
                  ? <SvgIcon d={ICON_PATHS.alert} size={16} color="#ef4444" />
                  : <SvgIcon d={ICON_PATHS.clock} size={16} color={daysRemaining < 90 ? '#f59e0b' : '#10b981'} />}
                <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>受給者証期限</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: daysRemaining < 30 ? '#dc2626' : '#1f2937', letterSpacing: '-0.02em' }}>
                {daysRemaining}<span style={{ fontSize: 13, fontWeight: 500, marginLeft: 2 }}>日</span>
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>{currentPlan.certExpiry}</div>
            </div>

            {/* 5-Domain Coverage */}
            <div style={{ marginTop: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#4b5563', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <SvgIcon d={ICON_PATHS.tag} size={14} color={theme.palette.primary.main} /> 5領域カバレッジ
              </div>
              {domainCoverage.map((d) => (
                <div key={d.id} style={{ ...S.domainRow, background: d.covered ? d.bg : '#f9fafb', borderColor: d.covered ? d.color + '40' : '#e5e7eb' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.covered ? d.color : '#d1d5db', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: d.covered ? d.color : '#9ca3af', fontWeight: d.covered ? 600 : 400 }}>{d.label}</span>
                  {d.covered && <SvgIcon d={ICON_PATHS.check} size={12} color={d.color} />}
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>

      {/* ═══ MAIN CONTENT ═══ */}
      <main style={S.main}>
        {/* Header */}
        <header style={S.header}>
          <div>
            <h1 style={S.h1}>
              <SvgIcon d={ICON_PATHS.sparkles} size={24} color={theme.palette.primary.main} />
              個別支援計画 前回比較・更新エディタ
            </h1>
            <p style={S.subtitle}>{currentPlan.userName}さん ｜ 計画期間: {currentPlan.planPeriod}</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={toggleDiff} aria-pressed={showDiff}
              style={{ ...S.headerBtn, background: showDiff ? alpha(theme.palette.primary.main, 0.08) : '#f9fafb', color: showDiff ? theme.palette.primary.dark : '#6b7280', borderColor: showDiff ? alpha(theme.palette.primary.main, 0.3) : '#e5e7eb' }}>
              <SvgIcon d={ICON_PATHS.eye} size={16} /> 差分プレビュー
            </button>
            <button onClick={toggleSmart} aria-pressed={showSmart}
              style={{ ...S.headerBtn, background: showSmart ? '#fefce8' : '#f9fafb', color: showSmart ? '#ca8a04' : '#6b7280', borderColor: showSmart ? '#fde68a' : '#e5e7eb' }}>
              <SvgIcon d={ICON_PATHS.sparkles} size={16} /> SMARTガイド
            </button>
            {savePlan && (
              <button onClick={savePlan} disabled={saving}
                style={{
                  ...S.headerBtn,
                  background: saving ? '#e5e7eb' : theme.palette.primary.main,
                  color: saving ? '#9ca3af' : '#fff',
                  borderColor: saving ? '#d1d5db' : theme.palette.primary.main,
                  opacity: saving ? 0.7 : 1,
                }}
                aria-busy={saving}
              >
                {saving ? '保存中…' : '▶ 保存'}
              </button>
            )}
          </div>
        </header>

        {/* SMART Panel */}
        <div style={{ maxHeight: showSmart ? 120 : 0, overflow: 'hidden', transition: 'max-height 0.4s ease' }}
          aria-hidden={!showSmart} id="smart-guide-panel">
          <div style={S.smartPanel}>
            {SMART_CRITERIA.map((c: SmartCriterion) => (
              <div key={c.key} style={S.smartItem}>
                <span style={S.smartBadge}>{c.key}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1f2937' }}>{c.label}</div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>{c.hint}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tab Navigation — a11y: role="tablist" */}
        <div style={S.tabBar} role="tablist" aria-label="目標項目タブ">
          {currentPlan.goals.map((g) => {
            const prev = previousPlan.goals.find((p) => p.id === g.id);
            const hasChange = g.text && prev && g.text !== prev.text;
            const isEmpty = !g.text.trim();
            const isActive = activeGoalId === g.id;
            return (
              <button key={g.id}
                role="tab"
                aria-selected={isActive}
                aria-controls={`tabpanel-${g.id}`}
                id={`tab-${g.id}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActiveGoalId(g.id)}
                style={{
                  ...S.tab,
                  borderColor: isActive ? theme.palette.primary.main : 'transparent',
                  color: isActive ? theme.palette.primary.dark : '#6b7280',
                  background: isActive ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                  fontWeight: isActive ? 700 : 500,
                }}>
                {g.label}
                {hasChange && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block', marginLeft: 4 }} aria-label="変更あり" />}
                {isEmpty && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', display: 'inline-block', marginLeft: 4 }} aria-label="未入力" />}
              </button>
            );
          })}
        </div>

        {/* Active Tab Panel */}
        {activeGoal && (
          <div
            role="tabpanel"
            id={`tabpanel-${activeGoal.id}`}
            aria-labelledby={`tab-${activeGoal.id}`}
            className="isp-comparison-grid"
            style={S.comparisonGrid}
          >
            {/* LEFT: Previous (Read Only) */}
            <div style={S.panelPrev}>
              <div style={S.panelHeader}>
                <span style={S.panelBadgePrev}>前回確定</span>
                <span style={{ fontSize: 12, color: '#6b7280' }}>{previousPlan.planPeriod}</span>
              </div>
              <div style={S.readonlyBox} aria-label={`前回の${activeGoal.label}`}>
                {prevGoal?.text || '(前回データなし)'}
              </div>
              {prevGoal && (
                <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 4, marginTop: 10 }}>
                  {prevGoal.domains.map((dId) => {
                    const dm = DOMAINS.find((d) => d.id === dId);
                    return dm ? (
                      <span key={dId} style={{ ...S.domainTag, background: dm.bg, color: dm.color, border: `1px solid ${dm.color}30` }}>
                        {dm.label}
                      </span>
                    ) : null;
                  })}
                </div>
              )}
            </div>

            {/* RIGHT: Current (Editable) */}
            <div style={{ ...S.panelCurrent, borderColor: alpha(theme.palette.primary.main, 0.3), boxShadow: `0 4px 24px ${alpha(theme.palette.primary.main, 0.08)}` }}>
              <div style={S.panelHeader}>
                <span style={{ ...S.panelBadgeCurrent, color: theme.palette.primary.dark, background: alpha(theme.palette.primary.main, 0.08) }}>今回更新案</span>
                <button
                  onClick={() => copyFromPrevious(activeGoal.id)}
                  disabled={!prevGoal}
                  aria-label={`前回の${activeGoal.label}を引用`}
                  style={{
                    ...S.copyBtn,
                    opacity: !prevGoal ? 0.4 : 1,
                    background: copiedId === activeGoal.id ? '#dcfce7' : alpha(theme.palette.primary.main, 0.06),
                    color: copiedId === activeGoal.id ? '#16a34a' : theme.palette.primary.dark,
                    borderColor: copiedId === activeGoal.id ? '#86efac' : alpha(theme.palette.primary.main, 0.4),
                  }}>
                  {copiedId === activeGoal.id
                    ? <><SvgIcon d={ICON_PATHS.check} size={14} /> 引用済</>
                    : <><SvgIcon d={ICON_PATHS.copy} size={14} /> 前回から引用</>}
                </button>
              </div>

              <label htmlFor={`goal-textarea-${activeGoal.id}`} style={S.srOnly}>
                {activeGoal.label}
              </label>
              <textarea
                id={`goal-textarea-${activeGoal.id}`}
                value={activeGoal.text}
                onChange={(e) => updateGoalText(activeGoal.id, e.target.value)}
                placeholder="目標・支援内容を入力してください…"
                rows={5}
                style={S.textarea}
                aria-describedby={showSmart ? 'smart-guide-panel' : undefined}
              />

              {/* Domain Tags */}
              <fieldset style={{ border: 'none', padding: 0, margin: '10px 0 0' }}>
                <legend style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>5領域タグ：</legend>
                <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
                  {DOMAINS.map((d) => {
                    const isOn = activeGoal.domains.includes(d.id);
                    return (
                      <button key={d.id}
                        onClick={() => toggleDomain(activeGoal.id, d.id)}
                        aria-pressed={isOn}
                        style={{
                          ...S.domainToggle,
                          background: isOn ? d.bg : '#fff',
                          color: isOn ? d.color : '#9ca3af',
                          borderColor: isOn ? d.color + '60' : '#e5e7eb',
                          fontWeight: isOn ? 700 : 400,
                          boxShadow: isOn ? `0 0 8px ${d.color}20` : 'none',
                        }}>
                        {isOn && <SvgIcon d={ICON_PATHS.check} size={12} />} {d.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              {/* Diff Preview — aria-live for screen reader */}
              {diff && (
                <div style={S.diffBox} aria-live="polite" aria-atomic="true">
                  <div style={{ fontSize: 11, fontWeight: 700, color: theme.palette.primary.main, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <SvgIcon d={ICON_PATHS.eye} size={14} /> 変更差分プレビュー（監査エビデンス）
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.8 }}>
                    {diff.map((seg, i) => (
                      <span key={i} style={
                        seg.type === 'del' ? S.diffDel :
                        seg.type === 'add' ? S.diffAdd :
                        undefined
                      }>{seg.text}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Scoped styles */}
      <style>{getCssRules(theme)}</style>
    </div>
  );
};

export default ISPComparisonEditorView;

/* ─── Scoped CSS (responsive + hover scope + animation) ─── */
const getCssRules = (t: Theme) => `
@keyframes ispFadeIn {
  from { opacity: 0; transform: translateY(-8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes ispSpin {
  to { transform: rotate(360deg); }
}
.isp-editor textarea:focus {
  outline: none;
  border-color: ${t.palette.primary.main} !important;
  box-shadow: 0 0 0 3px ${alpha(t.palette.primary.main, 0.15)} !important;
}
.isp-editor button { cursor: pointer; }
.isp-editor button:hover { filter: brightness(0.96); }
.isp-editor button:focus-visible {
  outline: 2px solid ${t.palette.primary.main};
  outline-offset: 2px;
}
* { box-sizing: border-box; }

/* Responsive: 1-column on narrow screens */
@media (max-width: 900px) {
  .isp-comparison-grid {
    grid-template-columns: 1fr !important;
  }
}
`;

/* ─── Theme-dependent styles (computed at render) ─── */
const getThemedStyles = (t: Theme) => ({
  progressBarInner: {
    height: '100%', borderRadius: 99,
    background: `linear-gradient(90deg, ${t.palette.primary.main}, ${t.palette.primary.light})`,
    transition: 'width 0.6s ease',
  } as React.CSSProperties,
});

/* ─── Inline Style Objects ─── */
const S = {
  container: {
    display: 'flex', minHeight: '100vh',
    background: 'linear-gradient(135deg, #f0fdf4 0%, #f5f5f4 50%, #f0fdf4 100%)',
    fontFamily: "'Hiragino Sans','Hiragino Kaku Gothic ProN','Noto Sans JP',-apple-system,sans-serif",
  } as React.CSSProperties,
  sidebar: {
    background: '#fff', borderRight: '1px solid #e5e7eb',
    boxShadow: '4px 0 24px rgba(0,0,0,0.04)', position: 'relative' as const,
    overflow: 'hidden', flexShrink: 0,
    transition: 'width 0.3s ease, min-width 0.3s ease',
  } as React.CSSProperties,
  sidebarToggle: {
    position: 'absolute' as const, top: 12, right: 12, background: '#f3f4f6', border: 'none',
    borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#6b7280', zIndex: 1,
  } as React.CSSProperties,
  sidebarHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, marginTop: 24 } as React.CSSProperties,
  progressBarOuter: { height: 8, borderRadius: 99, background: '#e5e7eb', overflow: 'hidden' } as React.CSSProperties,
  stepRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 } as React.CSSProperties,
  stepDot: {
    width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, transition: 'all 0.3s ease',
  } as React.CSSProperties,
  deadlineCard: {
    marginTop: 24, padding: 16, borderRadius: 14, border: '1.5px solid',
    transition: 'all 0.3s ease',
  } as React.CSSProperties,
  domainRow: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8,
    marginBottom: 4, border: '1px solid', transition: 'all 0.3s ease', fontSize: 12,
  } as React.CSSProperties,
  main: { flex: 1, padding: '24px 32px', overflowY: 'auto' as const } as React.CSSProperties,
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 20, flexWrap: 'wrap' as const, gap: 12,
  } as React.CSSProperties,
  h1: {
    fontSize: 22, fontWeight: 800, color: '#1f2937', margin: 0, display: 'flex', alignItems: 'center', gap: 10,
    letterSpacing: '-0.02em',
  } as React.CSSProperties,
  subtitle: { fontSize: 13, color: '#6b7280', marginTop: 4 } as React.CSSProperties,
  headerBtn: {
    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: '1.5px solid',
    borderRadius: 10, fontSize: 13, fontWeight: 600, transition: 'all 0.2s ease', background: '#f9fafb',
  } as React.CSSProperties,
  smartPanel: {
    display: 'flex', gap: 12, padding: 16, background: '#fffbeb', borderRadius: 14,
    border: '1px solid #fde68a', marginBottom: 16, flexWrap: 'wrap' as const,
  } as React.CSSProperties,
  smartItem: { display: 'flex', alignItems: 'flex-start', gap: 8, flex: '1 1 180px' } as React.CSSProperties,
  smartBadge: {
    width: 28, height: 28, borderRadius: 8, background: '#fbbf24', color: '#fff',
    fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  } as React.CSSProperties,
  tabBar: {
    display: 'flex', gap: 4, borderBottom: '2px solid #e5e7eb', marginBottom: 20,
    overflowX: 'auto' as const, paddingBottom: 0,
  } as React.CSSProperties,
  tab: {
    padding: '10px 16px', border: 'none', borderBottom: '3px solid', borderRadius: '8px 8px 0 0',
    fontSize: 13, transition: 'all 0.2s ease', whiteSpace: 'nowrap' as const,
    display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', minHeight: 44,
  } as React.CSSProperties,
  comparisonGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20,
    animation: 'ispFadeIn 0.3s ease',
  } as React.CSSProperties,
  panelPrev: {
    background: '#fff', borderRadius: 16, padding: 24, border: '1.5px solid #e5e7eb',
    boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
  } as React.CSSProperties,
  panelCurrent: {
    background: '#fff', borderRadius: 16, padding: 24, border: '1.5px solid #d1d5db',
    boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
  } as React.CSSProperties,
  panelHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14,
  } as React.CSSProperties,
  panelBadgePrev: {
    fontSize: 12, fontWeight: 700, color: '#6b7280', background: '#f3f4f6', padding: '4px 12px', borderRadius: 8,
  } as React.CSSProperties,
  panelBadgeCurrent: {
    fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 8,
  } as React.CSSProperties,
  readonlyBox: {
    padding: 16, background: '#f9fafb', borderRadius: 12, border: '1px solid #e5e7eb',
    fontSize: 14, lineHeight: 1.8, color: '#374151', minHeight: 100, whiteSpace: 'pre-wrap' as const,
  } as React.CSSProperties,
  copyBtn: {
    display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px',
    border: '1.5px solid', borderRadius: 10, fontSize: 12, fontWeight: 600,
    transition: 'all 0.3s ease',
  } as React.CSSProperties,
  textarea: {
    width: '100%', padding: 16, borderRadius: 12, border: '1.5px solid #d1d5db',
    fontSize: 14, lineHeight: 1.8, color: '#1f2937', resize: 'vertical' as const,
    minHeight: 120, fontFamily: 'inherit', transition: 'all 0.2s ease', background: '#f8faf7',
  } as React.CSSProperties,
  domainTag: { fontSize: 11, padding: '3px 10px', borderRadius: 99, fontWeight: 600 } as React.CSSProperties,
  domainToggle: {
    fontSize: 11, padding: '4px 12px', borderRadius: 99, border: '1.5px solid',
    display: 'flex', alignItems: 'center', gap: 4, transition: 'all 0.2s ease', background: '#fff', minHeight: 44,
  } as React.CSSProperties,
  diffBox: {
    marginTop: 16, padding: 16, background: '#f8fafc', borderRadius: 12, border: '1px dashed #d1d5db',
  } as React.CSSProperties,
  diffDel: {
    background: '#fee2e2', color: '#dc2626', textDecoration: 'line-through',
    padding: '1px 2px', borderRadius: 3,
  } as React.CSSProperties,
  diffAdd: {
    background: '#dcfce7', color: '#16a34a', fontWeight: 700,
    padding: '1px 2px', borderRadius: 3,
  } as React.CSSProperties,
  srOnly: {
    position: 'absolute' as const, width: 1, height: 1, padding: 0, margin: -1,
    overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' as const, border: 0,
  } as React.CSSProperties,
  loadingOverlay: {
    position: 'absolute' as const, inset: 0, display: 'flex', flexDirection: 'column' as const,
    alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.85)',
    zIndex: 100, backdropFilter: 'blur(4px)',
  } as React.CSSProperties,
  spinner: {
    width: 36, height: 36, border: '3px solid #e5e7eb', borderTopColor: '#10b981',
    borderRadius: '50%', animation: 'ispSpin 0.8s linear infinite',
  } as React.CSSProperties,
  errorBanner: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
    background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10,
    fontSize: 13, color: '#dc2626', margin: '0 32px 12px', position: 'relative' as const, zIndex: 50,
  } as React.CSSProperties,
};

import { useState } from 'react';
import type { ClassifiedAlert, AlertState } from '../../domain/classifyAlertState';
import {
  ALERT_STATE_COLORS,
  ALERT_STATE_LABELS,
} from '../../domain/classifyAlertState';
import type { AlertPersistence } from '../../domain/computeAlertPersistence';
import { formatPersistenceDuration, formatWorseningStreak } from '../../domain/computeAlertPersistence';
import { getPlaybookEntry } from '../../domain/alertPlaybook';
import { generateIssueDraft } from '../../domain/generateIssueDraft';
import { SectionTitle } from '../ui/SectionTitle';

function AlertChip({ classified, persistenceVal }: { classified: ClassifiedAlert; persistenceVal?: AlertPersistence }) {
  const { alert, state, delta } = classified;
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const isCritical = alert.severity === 'critical';
  const playbook = getPlaybookEntry(alert.id);

  const handleCopyDraft = () => {
    if (!playbook) return;
    const draft = generateIssueDraft(alert, playbook, persistenceVal);
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
          <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.4, marginBottom: persistenceVal ? 4 : 0 }}>
            {alert.message}
          </div>
          {persistenceVal && (
            <div style={{ display: 'flex', gap: 6, fontSize: 11, color: '#475569' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                ⏱ {formatPersistenceDuration(persistenceVal.consecutivePeriods)}
              </span>
              {persistenceVal.worseningStreak > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 2, color: '#dc2626' }}>
                  📉 {formatWorseningStreak(persistenceVal.worseningStreak)}
                </span>
              )}
            </div>
          )}
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

      {expanded && playbook && (
        <div style={{
          padding: '0 16px 14px 42px',
          borderTop: `1px solid ${isCritical ? '#fecaca40' : '#fed7aa40'}`,
        }}>
          <div style={{ marginTop: 10, marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
              🔍 想定原因
            </div>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
              {playbook.causes.map((cause, i) => <li key={i}>{cause}</li>)}
            </ul>
          </div>

          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
              ✅ 推奨確認ポイント
            </div>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
              {playbook.checkpoints.map((point, i) => <li key={i}>{point}</li>)}
            </ul>
          </div>

          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
              📍 関連画面
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {playbook.relatedScreens.map((screen) => (
                <span
                  key={screen.path}
                  style={{
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 6,
                    background: '#f1f5f9',
                    color: '#3b82f6',
                    fontWeight: 500,
                  }}
                >
                  {screen.label}
                </span>
              ))}
            </div>
          </div>

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
                onClick={(event) => { event.stopPropagation(); handleCopyDraft(); }}
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
                {playbook.issueTemplate.labels.map((label) => (
                  <span
                    key={label}
                    style={{
                      fontSize: 10,
                      padding: '1px 6px',
                      borderRadius: 4,
                      background: '#e2e8f0',
                      color: '#475569',
                    }}
                  >
                    #{label}
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

export function AlertInsightsSection({
  classifiedAlerts,
  persistence,
}: {
  classifiedAlerts: ClassifiedAlert[];
  persistence: AlertPersistence[];
}) {
  if (classifiedAlerts.length === 0) return null;

  const stateOrder: Record<AlertState, number> = { worsening: 0, new: 1, continuing: 2, improving: 3 };
  const sorted = [...classifiedAlerts].sort((a, b) => stateOrder[a.state] - stateOrder[b.state]);

  return (
    <section style={{ marginBottom: 20 }}>
      <SectionTitle>⚠️ アラート ({classifiedAlerts.length})</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sorted.map((classified) => {
          const persistenceVal = persistence.find((item) => item.alertKey === classified.alert.id);
          return <AlertChip key={classified.alert.id} classified={classified} persistenceVal={persistenceVal} />;
        })}
      </div>
    </section>
  );
}

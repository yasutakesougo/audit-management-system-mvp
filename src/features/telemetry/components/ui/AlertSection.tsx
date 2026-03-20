/**
 * AlertChip + AlertSection — KPIアラート表示
 */

import type { KpiAlert } from '../../domain/computeCtaKpiDiff';
import { SectionTitle } from './SectionTitle';

function AlertChip({ alert }: { alert: KpiAlert }) {
  const isCritical = alert.severity === 'critical';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '12px 16px',
        borderRadius: 10,
        background: isCritical ? '#fef2f2' : '#fffbeb',
        border: `1px solid ${isCritical ? '#fecaca' : '#fed7aa'}`,
      }}
    >
      <span style={{ fontSize: 16, lineHeight: 1.2, flexShrink: 0 }}>
        {isCritical ? '🔴' : '🟡'}
      </span>
      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: 13,
          fontWeight: 600,
          color: isCritical ? '#dc2626' : '#d97706',
          marginBottom: 2,
        }}>
          {alert.label}
        </div>
        <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.4 }}>
          {alert.message}
        </div>
      </div>
    </div>
  );
}

export function AlertSection({ alerts }: { alerts: KpiAlert[] }) {
  if (alerts.length === 0) return null;
  return (
    <section style={{ marginBottom: 20 }}>
      <SectionTitle>⚠️ アラート ({alerts.length})</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {alerts.map((a) => (
          <AlertChip key={a.id} alert={a} />
        ))}
      </div>
    </section>
  );
}

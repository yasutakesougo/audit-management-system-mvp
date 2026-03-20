/**
 * Telemetry Dashboard — 日時フォーマッタ
 *
 * TelemetryDashboard.tsx から抽出。
 * TelemetryDoc の ts / clientTs を表示用に変換する純粋関数。
 */

import type { TelemetryDoc } from '../hooks/useTelemetryDashboard';

export function formatTime(doc: TelemetryDoc): string {
  const d = doc.ts ?? (doc.clientTs ? new Date(doc.clientTs) : null);
  if (!d) return '—';
  return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function formatDate(doc: TelemetryDoc): string {
  const d = doc.ts ?? (doc.clientTs ? new Date(doc.clientTs) : null);
  if (!d) return '';
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

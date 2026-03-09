/**
 * Service Provision Form Helpers
 *
 * Pure utility functions and constants for the service provision form.
 * No React or MUI dependencies.
 *
 * @module features/service-provision/serviceProvisionFormHelpers
 */

import type { ServiceProvisionRecord, ServiceProvisionStatus } from './index';

// ────────────────────────────────────────────────────────────
// Date / Time Helpers
// ────────────────────────────────────────────────────────────

export const todayISO = (): string => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

/** "HH:MM" → HHMM数値。不正なら null */
export const parseHHMM = (value: string): number | null => {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hh = parseInt(match[1], 10);
  const mm = parseInt(match[2], 10);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 100 + mm;
};

/** HHMM数値 → "HH:MM" */
export const formatHHMM = (value: number | null | undefined): string => {
  if (value == null) return '—';
  const hh = Math.floor(value / 100);
  const mm = value % 100;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

// ────────────────────────────────────────────────────────────
// Status Constants
// ────────────────────────────────────────────────────────────

export const STATUS_OPTIONS: ServiceProvisionStatus[] = ['提供', '欠席', 'その他'];

export const STATUS_COLOR: Record<ServiceProvisionStatus, 'success' | 'warning' | 'default'> = {
  '提供': 'success',
  '欠席': 'warning',
  'その他': 'default',
};

// ────────────────────────────────────────────────────────────
// Addon Labels
// ────────────────────────────────────────────────────────────

/** 加算フラグをラベル配列に変換 */
export const getAddonLabels = (r: ServiceProvisionRecord): string[] => {
  const labels: string[] = [];
  if (r.hasTransportPickup && r.hasTransportDropoff) labels.push('送迎:往復');
  else if (r.hasTransportPickup) labels.push('送迎:往');
  else if (r.hasTransportDropoff) labels.push('送迎:復');
  else if (r.hasTransport) labels.push('送迎');
  if (r.hasMeal) labels.push('食事');
  if (r.hasBath) labels.push('入浴');
  if (r.hasExtended) labels.push('延長');
  if (r.hasAbsentSupport) labels.push('欠席対応');
  return labels;
};

// ────────────────────────────────────────────────────────────
// Sample Data (for Isokatsu sheet preview)
// ────────────────────────────────────────────────────────────

export const SERVICE_PROVISION_SAMPLE_RECORDS: ServiceProvisionRecord[] = [
  { id: 1, entryKey: 'I031|2026-03-02', userCode: 'I031', recordDateISO: '2026-03-02', status: '提供', startHHMM: 930, endHHMM: 1600, hasTransportPickup: true, hasTransportDropoff: true, hasMeal: true, hasBath: false },
  { id: 2, entryKey: 'I031|2026-03-03', userCode: 'I031', recordDateISO: '2026-03-03', status: '提供', startHHMM: 930, endHHMM: 1600, hasTransportPickup: true, hasTransportDropoff: true, hasMeal: true, hasBath: false },
  { id: 3, entryKey: 'I031|2026-03-04', userCode: 'I031', recordDateISO: '2026-03-04', status: '提供', startHHMM: 930, endHHMM: 1600, hasTransportPickup: true, hasTransportDropoff: true, hasMeal: true, hasBath: true },
  { id: 4, entryKey: 'I031|2026-03-05', userCode: 'I031', recordDateISO: '2026-03-05', status: '欠席', note: '発熱のため' },
  { id: 5, entryKey: 'I031|2026-03-06', userCode: 'I031', recordDateISO: '2026-03-06', status: '提供', startHHMM: 930, endHHMM: 1600, hasTransportPickup: true, hasTransportDropoff: true, hasMeal: true, hasBath: false },
  { id: 6, entryKey: 'I031|2026-03-09', userCode: 'I031', recordDateISO: '2026-03-09', status: '提供', startHHMM: 930, endHHMM: 1600, hasTransportPickup: true, hasTransportDropoff: true, hasMeal: true, hasBath: false },
  { id: 7, entryKey: 'I031|2026-03-10', userCode: 'I031', recordDateISO: '2026-03-10', status: '提供', startHHMM: 930, endHHMM: 1600, hasTransportPickup: true, hasTransportDropoff: true, hasMeal: true, hasBath: false },
  { id: 8, entryKey: 'I031|2026-03-11', userCode: 'I031', recordDateISO: '2026-03-11', status: '提供', startHHMM: 930, endHHMM: 1600, hasTransportPickup: true, hasTransportDropoff: true, hasMeal: true, hasBath: true },
  { id: 9, entryKey: 'I031|2026-03-12', userCode: 'I031', recordDateISO: '2026-03-12', status: '提供', startHHMM: 930, endHHMM: 1600, hasTransportPickup: true, hasTransportDropoff: true, hasMeal: true, hasBath: false },
  { id: 10, entryKey: 'I031|2026-03-13', userCode: 'I031', recordDateISO: '2026-03-13', status: '提供', startHHMM: 930, endHHMM: 1600, hasTransportPickup: true, hasTransportDropoff: true, hasMeal: true, hasBath: false },
];

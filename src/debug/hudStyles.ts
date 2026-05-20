import type { CSSProperties } from 'react';

export const STATUS_COLORS: Record<'good' | 'warn' | 'bad', string> = {
  good: '#34d399',
  warn: '#fbbf24',
  bad: '#f87171',
};

export const BREAKER_COLORS: Record<string, string> = {
  CLOSED: '#4ade80',
  HALF_OPEN: '#facc15',
  OPEN: '#f87171',
};

export const containerStyle: CSSProperties = {
  position: 'fixed',
  right: 16,
  bottom: 16,
  zIndex: 2147483647,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: 8,
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  color: '#fff',
  pointerEvents: 'none',
};

export const buttonStyle: CSSProperties = {
  pointerEvents: 'auto',
  borderRadius: 999,
  backgroundColor: 'rgba(15, 23, 42, 0.85)',
  border: '1px solid rgba(148, 163, 184, 0.5)',
  color: '#e2e8f0',
  padding: '6px 14px',
  fontSize: 13,
  cursor: 'pointer',
  transition: 'background-color 0.2s ease',
};

export const panelStyle: CSSProperties = {
  pointerEvents: 'none',
  minWidth: 240,
  maxWidth: 320,
  backgroundColor: 'rgba(15, 23, 42, 0.95)',
  borderRadius: 12,
  padding: '12px 16px',
  boxShadow: '0 10px 30px rgba(15, 23, 42, 0.45)',
  border: '1px solid rgba(100, 116, 139, 0.35)',
  backdropFilter: 'blur(6px)',
};

export const panelContentStyle: CSSProperties = {
  pointerEvents: 'none',
  display: 'flex',
  flexDirection: 'column',
};

export const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  fontSize: 13,
  marginBottom: 8,
};

export const totalStyle: CSSProperties = {
  fontWeight: 600,
  letterSpacing: 0.2,
};

export const sectionLabelStyle: CSSProperties = {
  ...headerStyle,
  marginTop: 12,
};

export const listStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

export const rowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  alignItems: 'center',
  gap: 12,
  fontSize: 12,
  lineHeight: 1.4,
  padding: '6px 8px 6px 10px',
  borderRadius: 8,
  border: '1px solid rgba(148, 163, 184, 0.2)',
  backgroundColor: 'rgba(30, 41, 59, 0.7)',
  position: 'relative',
};

export const telemetryRowStyle: CSSProperties = {
  ...rowStyle,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 6,
};

export const thresholdsRowStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 12,
  lineHeight: 1.4,
  padding: '6px 8px 6px 10px',
  borderRadius: 8,
  border: '1px solid rgba(148, 163, 184, 0.2)',
  backgroundColor: 'rgba(30, 41, 59, 0.7)',
};

export const emptyStateStyle: CSSProperties = {
  fontSize: 12,
  opacity: 0.7,
  textAlign: 'center',
  padding: '12px 0',
};

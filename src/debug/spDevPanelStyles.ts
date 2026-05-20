import React from 'react';

export const PANEL: React.CSSProperties = {
  position: 'fixed',
  bottom: 0,
  right: 0,
  width: '520px',
  maxHeight: '70vh',
  background: '#1a1a2e',
  color: '#e0e0e0',
  borderTopLeftRadius: '12px',
  boxShadow: '0 -4px 24px rgba(0,0,0,0.5)',
  zIndex: 99999,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: '12px',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

export const HEADER: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '8px 12px',
  background: '#16213e',
  borderBottom: '1px solid #0f3460',
  cursor: 'grab',
  userSelect: 'none',
};

export const TAB_BAR: React.CSSProperties = {
  display: 'flex', gap: '2px',
  background: '#16213e',
  padding: '0 8px',
};

export const tab = (active: boolean): React.CSSProperties => ({
  padding: '6px 10px', cursor: 'pointer',
  background: active ? '#1a1a2e' : 'transparent',
  borderBottom: active ? '2px solid #e94560' : '2px solid transparent',
  color: active ? '#e94560' : '#888',
  fontWeight: active ? 700 : 400,
  fontSize: '11px',
  transition: 'all 0.15s ease',
});

export const BODY: React.CSSProperties = {
  flex: 1, overflowY: 'auto', padding: '10px 12px',
};

export const INPUT: React.CSSProperties = {
  width: '100%', padding: '6px 8px',
  background: '#0f3460', color: '#e0e0e0', border: '1px solid #1a3a6e',
  borderRadius: '4px', fontSize: '12px', fontFamily: 'inherit',
  boxSizing: 'border-box',
};

export const BTN: React.CSSProperties = {
  padding: '6px 14px', fontSize: '11px', fontWeight: 700,
  background: '#e94560', color: '#fff', border: 'none',
  borderRadius: '4px', cursor: 'pointer',
  marginTop: '6px',
};

export const RESULT: React.CSSProperties = {
  marginTop: '8px', padding: '8px',
  background: '#0f3460', borderRadius: '4px',
  maxHeight: '250px', overflowY: 'auto',
  whiteSpace: 'pre-wrap', lineHeight: 1.5,
};

export const TH: React.CSSProperties = {
  textAlign: 'left', padding: '4px 6px', borderBottom: '1px solid #1a3a6e',
  color: '#e94560', fontSize: '11px', fontWeight: 600,
};

export const TD: React.CSSProperties = {
  padding: '3px 6px', borderBottom: '1px solid #0f3460', fontSize: '11px',
};

export const DATA_STATUS: React.CSSProperties = {
  background: '#0f3460',
  padding: '8px 12px',
  borderBottom: '1px solid #1a3a6e',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

export const BTN_COPY: React.CSSProperties = {
  ...BTN,
  background: '#2d6a4f',
  fontSize: '10px',
  padding: '3px 10px',
  marginTop: 0,
};

export const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ff1744', // Red A400
  warn: '#ff9100',     // Orange A400
  info: '#4caf50',     // Green 500
};

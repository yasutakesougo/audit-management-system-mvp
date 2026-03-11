import React from 'react';

type OvpLogConsoleProps = {
  logs: string[];
};

const consoleStyle: React.CSSProperties = {
  background: '#1e1e1e',
  color: '#d4d4d4',
  padding: '1rem',
  borderRadius: '8px',
  maxHeight: '300px',
  overflowY: 'auto',
  whiteSpace: 'pre-wrap',
  fontSize: '12px',
  lineHeight: '1.6',
  fontFamily: 'monospace',
};

export const OvpLogConsole: React.FC<OvpLogConsoleProps> = ({ logs }) => (
  <div style={consoleStyle}>
    {logs.length === 0
      ? <span style={{ color: '#666' }}>Ready. 上のボタンをクリックして開始してください。</span>
      : logs.map((l, i) => <div key={i}>{l}</div>)
    }
  </div>
);

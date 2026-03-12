/**
 * LogConsole — Dark-themed scrollable log output
 */

interface Props {
  logs: string[];
}

export function LogConsole({ logs }: Props) {
  return (
    <div style={{
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
    }}>
      {logs.length === 0
        ? <span style={{ color: '#666' }}>Ready. 上のボタンをクリックして開始してください。</span>
        : logs.map((l, i) => <div key={i}>{l}</div>)
      }
    </div>
  );
}

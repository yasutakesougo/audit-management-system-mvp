import { persistentLogger } from '@/lib/persistentLogger';
import { ActionableErrorInfo, formatZodError, isZodError } from '@/lib/zodErrorUtils';
import React from 'react';

/**
 * Error Boundary for catching unhandled React errors (especially on tablet)
 * Prevents white screen by showing error message + reload button
 * Extracted from main.tsx for single-responsibility.
 */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null; zodIssues?: ActionableErrorInfo[] }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    let zodIssues: ActionableErrorInfo[] | undefined;
    if (isZodError(error)) {
      zodIssues = formatZodError(error);
    }
    return { hasError: true, error, zodIssues };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] React error caught:', error, errorInfo);
    persistentLogger.error(error, 'MainErrorBoundary');
  }

  render() {
    if (this.state.hasError) {
      const { error, zodIssues } = this.state;
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '40px 20px',
            backgroundColor: '#0f172a',
            color: '#f1f5f9',
            fontFamily: '"Outfit", "Inter", -apple-system, sans-serif',
            textAlign: 'center'
          }}
        >
          <div style={{
            backgroundColor: '#1e293b',
            padding: '40px',
            borderRadius: '16px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            maxWidth: '600px',
            width: '100%',
            border: '1px solid #334155'
          }}>
            <div style={{
              fontSize: '48px',
              marginBottom: '20px',
              animation: 'bounce 2s infinite'
            }}>⚠️</div>
            <style>{`@keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }`}</style>

            <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px', color: '#f8fafc' }}>
              システムに異常が発生しました
            </h1>
            <p style={{ fontSize: '15px', color: '#94a3b8', marginBottom: '24px', lineHeight: 1.6 }}>
              予期しないエラーによりアプリケーションを続行できません。<br />
              管理者に連絡するか、下記ボタンからページを再読み込みしてください。
            </p>

            {zodIssues && (
              <div style={{ textAlign: 'left', marginBottom: '24px' }}>
                <h4 style={{ color: '#ef4444', marginBottom: '12px', fontSize: '14px' }}>データ不整合検知 ({zodIssues.length}件):</h4>
                <div style={{
                  backgroundColor: '#7f1d1d',
                  padding: '12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  border: '1px solid #b91c1c',
                  maxHeight: '150px',
                  overflowY: 'auto'
                }}>
                  {zodIssues.map((issue, idx) => (
                    <div key={idx} style={{ marginBottom: '4px', borderBottom: idx < zodIssues.length -1 ? '1px solid #991b1b' : 'none', paddingBottom: '4px' }}>
                      <code style={{ color: '#fecaca' }}>{issue.path}</code>: {issue.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '24px' }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: '12px 32px',
                  fontSize: '16px',
                  fontWeight: 600,
                  backgroundColor: '#5B8C5A',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#4a7a49')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#5B8C5A')}
              >
                ページを更新
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify({
                    error: error?.toString(),
                    stack: error?.stack,
                    zod: zodIssues
                  }, null, 2));
                  alert('診断情報をクリップボードにコピーしました');
                }}
                style={{
                  padding: '12px 24px',
                  fontSize: '14px',
                  fontWeight: 500,
                  backgroundColor: 'transparent',
                  color: '#94a3b8',
                  border: '1px solid #475569',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                情報をコピー
              </button>
            </div>

            {error && (
              <details style={{ textAlign: 'left' }}>
                <summary style={{ cursor: 'pointer', fontSize: '12px', color: '#64748b', outline: 'none' }}>
                  技術情報を表示 (Debug Console)
                </summary>
                <pre
                  style={{
                    fontSize: '11px',
                    backgroundColor: '#0f172a',
                    padding: '16px',
                    borderRadius: '8px',
                    overflow: 'auto',
                    marginTop: '12px',
                    border: '1px solid #1e293b',
                    color: '#cbd5e1',
                    maxHeight: '200px'
                  }}
                >
                  {error.toString()}
                  {"\n\nStack:\n"}
                  {error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

import React from 'react';
import { persistentLogger } from '../lib/persistentLogger';
import { ActionableErrorInfo, formatZodError, isZodError, translateZodIssue } from '../lib/zodErrorUtils';

interface ConfigErrorBoundaryState {
  hasError: boolean;
  message?: string;
  isConfigError: boolean;
  zodIssues?: ActionableErrorInfo[];
  rawError?: unknown;
}

const isConfigErrorMessage = (msg: string) =>
  /SharePoint 接続設定が未完了/.test(msg) || /VITE_SP_RESOURCE/.test(msg);

export class ConfigErrorBoundary extends React.Component<
  React.PropsWithChildren,
  ConfigErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false, isConfigError: false };
  }

  static getDerivedStateFromError(err: unknown): ConfigErrorBoundaryState {
    const msg = String((err as { message?: string } | null | undefined)?.message ?? err);
    const isConfigError = isConfigErrorMessage(msg);

    let zodIssues: ActionableErrorInfo[] | undefined;
    if (isZodError(err)) {
      zodIssues = formatZodError(err);
    }

    return { hasError: true, message: msg, isConfigError, zodIssues, rawError: err };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ConfigErrorBoundary]', error, info);
    persistentLogger.error(error, 'ConfigErrorBoundary');
  }

  handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const { message, isConfigError, zodIssues } = this.state;

    // SharePoint 設定エラー、または Zod スキーマエラーの場合は詳細なガイドを表示
    if (isConfigError || zodIssues) {
      return (
        <div style={{ padding: '2rem', fontFamily: 'sans-serif', lineHeight: 1.5, color: '#333' }}>
          <h2 style={{ marginTop: 0, color: '#d32f2f' }}>⚠ 環境設定エラー</h2>
          <p style={{ fontSize: '14px', color: '#666' }}>
            システム起動に必要な環境変数（.env）に不備が見つかりました。
          </p>

          {zodIssues ? (
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ marginBottom: '0.5rem' }}>不整合フィールド ({zodIssues.length}件):</h4>
              <ul style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                fontSize: '13px',
                border: '1px solid #ffcdd2',
                borderRadius: '4px',
                backgroundColor: '#fff5f5'
              }}>
                {(isZodError(this.state.rawError)
                  ? this.state.rawError.issues.map((iss, idx) => (
                      <li key={idx} style={{
                        padding: '8px 12px',
                        borderBottom: idx < zodIssues.length - 1 ? '1px solid #ffcdd2' : 'none'
                      }}>
                        <span style={{ color: '#c62828' }}>{translateZodIssue(iss)}</span>
                      </li>
                    ))
                  : zodIssues.map((issue, idx) => (
                      <li key={idx} style={{
                        padding: '8px 12px',
                        borderBottom: idx < zodIssues.length - 1 ? '1px solid #ffcdd2' : 'none'
                      }}>
                        <strong style={{ color: '#c62828' }}>{issue.path}:</strong> {issue.message}
                      </li>
                    ))
                )}
              </ul>
            </div>
          ) : (
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                background: '#222',
                color: '#f88',
                padding: '1rem',
                borderRadius: 4,
                overflowX: 'auto',
                fontSize: '13px'
              }}
            >
              {message}
            </pre>
          )}

          <h3>修正手順</h3>
          <ol style={{ fontSize: '14px' }}>
            <li>プロジェクト直下に <code>.env</code> または <code>.env.local</code> を作成 / 更新</li>
            <li>上記の不整合フィールドを実テナントに合わせて修正してください。</li>
          </ol>
          <pre
            style={{
              background: '#111',
              color: '#0f0',
              padding: '0.75rem',
              borderRadius: 4,
              fontSize: '13px'
            }}
          >{`VITE_SP_RESOURCE=https://<yourtenant>.sharepoint.com
VITE_SP_SITE_RELATIVE=/sites/<SiteName>`}</pre>

          <p style={{ marginTop: '1.5rem' }}>
            <button
              onClick={this.handleReload}
              style={{
                background: '#1976d2',
                color: '#fff',
                border: 'none',
                padding: '0.75rem 1.25rem',
                borderRadius: 4,
                cursor: 'pointer',
                marginRight: '1rem',
                fontWeight: 'bold'
              }}
            >
              再読み込み (RELOAD)
            </button>
            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  navigator.clipboard.writeText(JSON.stringify(this.state.rawError, null, 2));
                  alert('Error details copied to clipboard');
                }
              }}
              style={{
                background: '#eee',
                color: '#333',
                border: '1px solid #ccc',
                padding: '0.75rem 1.25rem',
                borderRadius: 4,
                cursor: 'pointer'
              }}
            >
              診断情報をコピー
            </button>
          </p>
        </div>
      );
    }

    // その他のエラーは、シンプルなエラー表示
    return (
      <div style={{ padding: '2rem', fontFamily: 'sans-serif', lineHeight: 1.5 }}>
        <h2 style={{ marginTop: 0 }}>エラーが発生しました</h2>
        <pre
          style={{
            whiteSpace: 'pre-wrap',
            background: '#222',
            color: '#fff',
            padding: '1rem',
            borderRadius: 4,
            overflowX: 'auto',
          }}
        >
          {message}
        </pre>
        <p style={{ marginTop: '1rem' }}>
          <button
            onClick={this.handleReload}
            style={{
              background: '#1976d2',
              color: '#fff',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            再読み込み
          </button>
        </p>
      </div>
    );
  }
}

export default ConfigErrorBoundary;

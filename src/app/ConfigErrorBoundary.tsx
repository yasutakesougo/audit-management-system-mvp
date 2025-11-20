import React from 'react';

interface ConfigErrorBoundaryState {
  hasError: boolean;
  message?: string;
  isConfigError: boolean;
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
    return { hasError: true, message: msg, isConfigError };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ConfigErrorBoundary]', error, info);
  }

  handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const { message, isConfigError } = this.state;

    // SharePoint 設定エラーの場合は、詳細なガイドを表示
    if (isConfigError) {
      return (
        <div style={{ padding: '2rem', fontFamily: 'sans-serif', lineHeight: 1.5 }}>
          <h2 style={{ marginTop: 0 }}>環境設定エラー</h2>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              background: '#222',
              color: '#f88',
              padding: '1rem',
              borderRadius: 4,
              overflowX: 'auto',
            }}
          >
            {message}
          </pre>
          <h3>修正手順</h3>
          <ol>
            <li>プロジェクト直下に <code>.env</code> を作成 / 更新</li>
            <li>以下の値を実テナントに合わせて設定:</li>
          </ol>
          <pre
            style={{
              background: '#111',
              color: '#0f0',
              padding: '0.75rem',
            }}
          >{`VITE_SP_RESOURCE=https://contoso.sharepoint.com
VITE_SP_SITE_RELATIVE=/sites/AuditSystem`}</pre>
          <ol start={3}>
            <li>プレースホルダ (&lt;yourtenant&gt;, &lt;SiteName&gt;, __FILL_ME__) を全て置換</li>
            <li>開発サーバーを再起動 (Ctrl+C → npm run dev)</li>
          </ol>
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
                marginRight: '0.75rem',
              }}
            >
              再読み込み
            </button>
            <a
              href="https://github.com/yasutakesougo/audit-management-system-mvp#environment-variables-env"
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: '0.875rem' }}
            >
              README 設定ガイドを開く ↗
            </a>
          </p>
          <p style={{ marginTop: '0.5rem' }}>
            解消しない場合は <code>ensureConfig</code> 実装 (src/lib/spClient.ts) を確認してください。
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

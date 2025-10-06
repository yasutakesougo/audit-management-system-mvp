/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';

interface ConfigErrorBoundaryState { hasError: boolean; message?: string }

export class ConfigErrorBoundary extends React.Component<React.PropsWithChildren, ConfigErrorBoundaryState> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(err: unknown): ConfigErrorBoundaryState {
    const msg = String((err as any)?.message || err);
    if (/SharePoint 接続設定が未完了/.test(msg) || /VITE_SP_RESOURCE/.test(msg)) {
      return { hasError: true, message: msg };
    }
    return { hasError: true, message: msg };
  }

  componentDidCatch(error: any, info: any) {
    // eslint-disable-next-line no-console
    console.error('[ConfigErrorBoundary]', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{ padding: '2rem', fontFamily: 'sans-serif', lineHeight: 1.5 }}>
        <h2 style={{ marginTop: 0 }}>環境設定エラー</h2>
        <pre style={{ whiteSpace: 'pre-wrap', background: '#222', color: '#f88', padding: '1rem', borderRadius: 4, overflowX: 'auto' }}>{this.state.message}</pre>
        <h3>修正手順</h3>
        <ol>
          <li>プロジェクト直下に <code>.env</code> を作成 / 更新</li>
          <li>以下の値を実テナントに合わせて設定:</li>
        </ol>
        <pre style={{ background: '#111', color: '#0f0', padding: '0.75rem' }}>{`VITE_SP_RESOURCE=https://contoso.sharepoint.com\nVITE_SP_SITE_RELATIVE=/sites/AuditSystem`}</pre>
        <ol start={3}>
          <li>プレースホルダ (&lt;yourtenant&gt;, &lt;SiteName&gt;, __FILL_ME__) を全て置換</li>
          <li>開発サーバーを再起動 (Ctrl+C → npm run dev)</li>
        </ol>
        <p style={{ marginTop: '1rem' }}>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#1976d2',
              color: '#fff',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: 4,
              cursor: 'pointer',
              marginRight: '0.75rem'
            }}
          >再読み込み</button>
          <a
            href="https://github.com/yasutakesougo/audit-management-system-mvp#environment-variables-env"
            target="_blank" rel="noreferrer"
            style={{ fontSize: '0.875rem' }}
          >README 設定ガイドを開く ↗</a>
        </p>
        <p style={{ marginTop: '0.5rem' }}>解消しない場合は <code>ensureConfig</code> 実装 (src/lib/spClient.ts) を確認してください。</p>
      </div>
    );
  }
}

export default ConfigErrorBoundary;

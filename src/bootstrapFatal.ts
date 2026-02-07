/**
 * Fatal error handler for bootstrap phase
 * Catches errors before React renders, including chunk load failures
 * 
 * Purpose:
 * - window.error: Synchronous errors during initial load
 * - window.unhandledrejection: Async errors (import() failures, fetch, etc.)
 * - Displays error detail on screen since console may not be accessible on tablet
 */

function renderFatalPanel(title: string, detail?: unknown): void {
  const root = document.getElementById('root');
  if (!root) return;

  const formatDetail = (): string => {
    if (typeof detail === 'string') {
      return detail;
    }
    if (detail instanceof Error) {
      const stack = detail.stack ?? '(no stack trace)';
      return `${detail.name}: ${detail.message}\n\n${stack}`;
    }
    try {
      return JSON.stringify(detail, null, 2);
    } catch {
      return String(detail);
    }
  };

  const detailStr = formatDetail();

  root.innerHTML = `
    <div style="
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 720px;
      margin: 24px auto;
      background: #fff;
    ">
      <h1 style="
        font-size: 18px;
        font-weight: 600;
        margin: 0 0 8px;
        color: #d32f2f;
      ">⚠️ ${title}</h1>
      <p style="
        margin: 0 0 12px;
        color: #666;
        font-size: 14px;
      ">
        アプリケーションの起動中にエラーが発生しました。<br>
        リロードボタンで再度お試しください。
      </p>
      <details open style="
        background: #f5f5f5;
        padding: 12px;
        border-radius: 8px;
        border: 1px solid #e0e0e0;
        margin: 12px 0;
      ">
        <summary style="
          cursor: pointer;
          font-weight: 500;
          font-size: 13px;
          color: #333;
        ">
          詳細情報
        </summary>
        <pre style="
          white-space: pre-wrap;
          word-break: break-word;
          margin: 8px 0 0;
          font-size: 11px;
          color: #555;
          overflow-x: auto;
        ">${detailStr}</pre>
      </details>
      <button
        onclick="location.reload()"
        style="
          padding: 10px 16px;
          font-size: 14px;
          background-color: #1976d2;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
        "
      >
        リロード
      </button>
    </div>
  `;
}

export function installFatalHandlers(): void {
  // Synchronous errors (including script load failures)
  window.addEventListener('error', (event: ErrorEvent) => {
    // eslint-disable-next-line no-console
    console.error('[bootstrap] Error event:', event.error ?? event.message);
    renderFatalPanel('起動エラー (Synchronous)', event.error ?? event.message);
  });

  // Asynchronous promise rejections (including dynamic import failures)
  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    // eslint-disable-next-line no-console
    console.error('[bootstrap] Unhandled rejection:', event.reason);
    renderFatalPanel('起動エラー (Async Promise)', event.reason);
  });
}

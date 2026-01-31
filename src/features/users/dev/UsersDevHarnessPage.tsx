import React from 'react';

/**
 * Minimal dev harness for Users feature
 * Purpose: Hermetic E2E testing (no external SharePoint/Graph calls)
 * 
 * Future: Can be replaced with actual UsersPanel once demo mode stabilizes
 */
export function UsersDevHarnessPage(): JSX.Element {
  const [count, setCount] = React.useState(0);

  return (
    <main data-testid="users-dev-harness" style={{ padding: 16 }}>
      <h1>Users Dev Harness</h1>

      {/* E2E selector: hermetic UI (no external calls) */}
      <section data-testid="users-dev">
        <p>Hermetic E2E page — no external SharePoint/Graph calls</p>

        {/* Stable markers for E2E test assertions */}
        <div data-testid="users-count">
          Count: {count}
        </div>

        <button
          type="button"
          onClick={() => setCount((c) => c + 1)}
        >
          Reload
        </button>

        {/* Future: Placeholder for actual UsersPanel when demo mode is stable */}
        <section style={{ marginTop: 16, padding: 8, border: '1px solid #ccc' }}>
          <p style={{ color: '#666', fontSize: 12 }}>
            [TODO] Load actual UsersPanel here (demo/in-memory mode only)
          </p>
        </section>
      </section>
    </main>
  );
}

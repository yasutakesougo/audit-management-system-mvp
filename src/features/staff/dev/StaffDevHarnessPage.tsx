import * as React from 'react';

export default function StaffDevHarnessPage(): JSX.Element {
  const [tick, setTick] = React.useState(0);

  return (
    <div data-testid="staff-dev-harness" style={{ padding: 16 }}>
      <h1>Staff Dev Harness</h1>
      <p>This page is hermetic (no external calls). Tick: {tick}</p>

      <button type="button" onClick={() => setTick((v) => v + 1)}>
        Reload
      </button>
    </div>
  );
}

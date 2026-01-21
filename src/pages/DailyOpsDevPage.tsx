import React from 'react';
import { DailyOpsSignalsSmokeTest } from '@/features/dailyOps/dev';

export default function DailyOpsDevPage(): JSX.Element {
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 16 }}>
      <h1>DailyOpsSignals Development</h1>
      <DailyOpsSignalsSmokeTest />
    </div>
  );
}

import React from 'react';
const DashboardPage = React.lazy(() => import('./DashboardPage'));
export default function SuspendedDashboardPage() {
  return (
    <React.Suspense fallback={<div className="p-4 text-sm text-slate-600" role="status">黒ノートを読み込んでいます…</div>}>
      <DashboardPage />
    </React.Suspense>
  );
}

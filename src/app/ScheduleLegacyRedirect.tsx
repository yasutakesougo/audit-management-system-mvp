import * as React from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';

export default function ScheduleLegacyRedirect() {
  const [sp] = useSearchParams();
  const legacy = sp.get('ui') === 'legacy';
  return legacy ? <Navigate to="/schedule/legacy" replace /> : <Navigate to="/schedules/week" replace />;
}

/**
 * Daily record domain routes: /daily/*, /dailysupport
 */
import { Navigate, type RouteObject } from 'react-router-dom';

import {
    SuspendedAttendanceRecordPage,
    SuspendedDailyRecordMenuPage,
    SuspendedDailyRecordPage,
    SuspendedHealthObservationPage,
    SuspendedTableDailyRecordPage,
    SuspendedTimeBasedSupportRecordPage,
    SuspendedTimeFlowSupportRecordPage,
} from './lazyPages';

export const dailyRoutes: RouteObject[] = [
  { path: 'daily', element: <Navigate to="/dailysupport" replace /> },
  { path: 'dailysupport', element: <SuspendedDailyRecordMenuPage /> },
  { path: 'daily/menu', element: <Navigate to="/dailysupport" replace /> },
  { path: 'daily/table', element: <SuspendedTableDailyRecordPage /> },
  { path: 'daily/activity', element: <SuspendedDailyRecordPage /> },
  { path: 'daily/attendance', element: <SuspendedAttendanceRecordPage /> },
  { path: 'daily/support', element: <SuspendedTimeBasedSupportRecordPage /> },
  { path: 'daily/support-checklist', element: <SuspendedTimeFlowSupportRecordPage /> },
  { path: 'daily/time-based', element: <Navigate to="/daily/support" replace /> },
  { path: 'daily/health', element: <SuspendedHealthObservationPage /> },
];

/**
 * callLogRoutes — 電話ログ機能のルート定義
 */
import React from 'react';
import type { RouteObject } from 'react-router-dom';
import { createSuspended } from '../createSuspended';

const CallLogPage = React.lazy(() =>
  import('@/pages/CallLogPage').then((m) => ({ default: m.default })),
);

const SuspendedCallLogPage = createSuspended(
  CallLogPage,
  '電話・連絡ログを読み込んでいます…',
);

export const callLogRoutes: RouteObject[] = [
  {
    path: 'call-logs',
    element: <SuspendedCallLogPage />,
  },
];

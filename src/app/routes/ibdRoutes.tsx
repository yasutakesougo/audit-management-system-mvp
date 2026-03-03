/**
 * IBD (強度行動障害) domain routes: /ibd*, /ibd-demo
 */
import { isDev } from '@/env';
import type { RouteObject } from 'react-router-dom';

import {
    SuspendedIBDDemoPage,
    SuspendedIBDHubPage,
} from './lazyPages';

export const ibdRoutes: RouteObject[] = [
  ...(isDev ? [
    { path: 'ibd-demo', element: <SuspendedIBDDemoPage /> },
  ] : []),
  { path: 'ibd', element: <SuspendedIBDHubPage /> },
];

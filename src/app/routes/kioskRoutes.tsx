/**
 * Kiosk mode routes: /kiosk/*
 */
import { type RouteObject } from 'react-router-dom';
import { SuspendedKioskHomePage } from './lazyPages';

export const kioskRoutes: RouteObject[] = [
  {
    path: 'kiosk',
    element: <SuspendedKioskHomePage />,
  },
];

/**
 * Kiosk mode routes: /kiosk/*
 */
import { type RouteObject } from 'react-router-dom';
import { SuspendedKioskHomePage, SuspendedKioskUserSelectPage } from './lazyPages';

export const kioskRoutes: RouteObject[] = [
  {
    path: 'kiosk',
    children: [
      {
        index: true,
        element: <SuspendedKioskHomePage />,
      },
      {
        path: 'users',
        children: [
          {
            index: true,
            element: <SuspendedKioskUserSelectPage />,
          },
          {
            path: ':userId/procedures',
            element: <div>支援手順一覧（開発中）</div>,
          },
        ],
      },
    ],
  },
];

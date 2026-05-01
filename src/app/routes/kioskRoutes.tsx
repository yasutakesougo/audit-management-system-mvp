/**
 * Kiosk mode routes: /kiosk/*
 */
import { type RouteObject } from 'react-router-dom';
import { 
  SuspendedKioskHomePage, 
  SuspendedKioskUserSelectPage,
  SuspendedKioskProcedureListPage,
  SuspendedKioskProcedureDetailPage,
} from './lazyPages';

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
            children: [
              {
                index: true,
                element: <SuspendedKioskProcedureListPage />,
              },
              {
                path: ':slotKey',
                element: <SuspendedKioskProcedureDetailPage />,
              },
            ],
          },
        ],
      },
    ],
  },
];

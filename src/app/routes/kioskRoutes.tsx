/**
 * Kiosk mode routes: /kiosk/*
 */
import { type RouteObject, Outlet } from 'react-router-dom';
import { 
  SuspendedKioskHomePage, 
  SuspendedKioskUserSelectPage,
  SuspendedKioskProcedureListPage,
  SuspendedKioskProcedureDetailPage,
} from './lazyPages';
import ProtectedRoute from '@/app/ProtectedRoute';

export const kioskRoutes: RouteObject[] = [
  {
    path: 'kiosk',
    element: (
      <ProtectedRoute>
        <Outlet />
      </ProtectedRoute>
    ),
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

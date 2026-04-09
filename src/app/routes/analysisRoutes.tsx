/**
 * Analysis domain routes: /analysis/*, /assessment, /survey/tokusei
 */
import RequireAudience from '@/components/RequireAudience';
import AdminSurfaceRouteGuard from '@/components/AdminSurfaceRouteGuard';
import { IcebergPdcaGate } from '@/features/ibd/analysis/pdca/IcebergPdcaGate';
import { Navigate, type RouteObject } from 'react-router-dom';

import {
    SuspendedAnalysisDashboardPage,
    SuspendedAssessmentDashboardPage,
    SuspendedIcebergAnalysisPage,
    SuspendedIcebergPdcaPage,
    SuspendedInterventionDashboardPage,
    SuspendedTokuseiSurveyResultsPage,
} from './lazyPages';

export const analysisRoutes: RouteObject[] = [
  {
    path: 'analysis',
    element: (
      <RequireAudience requiredRole="viewer">
        <AdminSurfaceRouteGuard minimumRole="viewer">
          <Navigate to="/analysis/dashboard" replace />
        </AdminSurfaceRouteGuard>
      </RequireAudience>
    ),
  },
  {
    path: 'analysis/dashboard',
    element: (
      <RequireAudience requiredRole="viewer">
        <AdminSurfaceRouteGuard minimumRole="viewer">
          <SuspendedAnalysisDashboardPage />
        </AdminSurfaceRouteGuard>
      </RequireAudience>
    ),
  },
  {
    path: 'analysis/iceberg-pdca',
    element: (
      <RequireAudience requiredRole="viewer">
        <AdminSurfaceRouteGuard minimumRole="viewer">
          <IcebergPdcaGate>
            <SuspendedIcebergPdcaPage />
          </IcebergPdcaGate>
        </AdminSurfaceRouteGuard>
      </RequireAudience>
    ),
  },
  {
    path: 'analysis/iceberg-pdca/edit',
    element: (
      <RequireAudience requiredRole="viewer">
        <AdminSurfaceRouteGuard minimumRole="viewer">
          <IcebergPdcaGate requireEdit>
            <SuspendedIcebergPdcaPage />
          </IcebergPdcaGate>
        </AdminSurfaceRouteGuard>
      </RequireAudience>
    ),
  },
  {
    path: 'analysis/iceberg',
    element: (
      <RequireAudience requiredRole="viewer">
        <AdminSurfaceRouteGuard minimumRole="viewer">
          <SuspendedIcebergAnalysisPage />
        </AdminSurfaceRouteGuard>
      </RequireAudience>
    ),
  },
  {
    path: 'analysis/intervention',
    element: (
      <RequireAudience requiredRole="viewer">
        <AdminSurfaceRouteGuard minimumRole="viewer">
          <SuspendedInterventionDashboardPage />
        </AdminSurfaceRouteGuard>
      </RequireAudience>
    ),
  },
  {
    path: 'assessment',
    element: (
      <RequireAudience requiredRole="viewer">
        <SuspendedAssessmentDashboardPage />
      </RequireAudience>
    ),
  },
  {
    path: 'survey/tokusei',
    element: (
      <RequireAudience requiredRole="admin">
        <SuspendedTokuseiSurveyResultsPage />
      </RequireAudience>
    ),
  },
];

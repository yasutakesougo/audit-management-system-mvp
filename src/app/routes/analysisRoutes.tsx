/**
 * Analysis domain routes: /analysis/*, /assessment, /survey/tokusei
 */
import RequireAudience from '@/components/RequireAudience';
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
  { path: 'analysis', element: <Navigate to="/analysis/dashboard" replace /> },
  {
    path: 'analysis/dashboard',
    element: (
      <RequireAudience requiredRole="viewer">
        <SuspendedAnalysisDashboardPage />
      </RequireAudience>
    ),
  },
  {
    path: 'analysis/iceberg-pdca',
    element: (
      <RequireAudience requiredRole="viewer">
        <IcebergPdcaGate>
          <SuspendedIcebergPdcaPage />
        </IcebergPdcaGate>
      </RequireAudience>
    ),
  },
  {
    path: 'analysis/iceberg-pdca/edit',
    element: (
      <RequireAudience requiredRole="viewer">
        <IcebergPdcaGate requireEdit>
          <SuspendedIcebergPdcaPage />
        </IcebergPdcaGate>
      </RequireAudience>
    ),
  },
  {
    path: 'analysis/iceberg',
    element: (
      <RequireAudience requiredRole="viewer">
        <SuspendedIcebergAnalysisPage />
      </RequireAudience>
    ),
  },
  {
    path: 'analysis/intervention',
    element: (
      <RequireAudience requiredRole="viewer">
        <SuspendedInterventionDashboardPage />
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
      <RequireAudience requiredRole="viewer">
        <SuspendedTokuseiSurveyResultsPage />
      </RequireAudience>
    ),
  },
];

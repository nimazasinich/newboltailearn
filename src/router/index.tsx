import React, { Suspense, lazy } from 'react';
import { Navigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { LandingPage } from '../components/LandingPage';
import { PageSkeleton } from '../components/ui/PageSkeleton';
import { NotFoundPage } from '../pages/NotFoundPage';
import { AuthGuard } from '../components/AuthGuard';

// Lazy load pages for code splitting
const DashboardPage = lazy(() => import('../pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const TrainingPage = lazy(() => import('../pages/TrainingPage').then(m => ({ default: m.TrainingPage })));
const DocumentsPage = lazy(() => import('../pages/DocumentsPage').then(m => ({ default: m.DocumentsPage })));
const DownloadPage = lazy(() => import('../pages/DownloadPage').then(m => ({ default: m.DownloadPage })));

// Import additional page components
const AnalyticsPage = lazy(() => import('../components/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })));
const DataPage = lazy(() => import('../components/DataPage').then(m => ({ default: m.DataPage })));
const ModelsPage = lazy(() => import('../components/ModelsPage').then(m => ({ default: m.ModelsPage })));
const MonitoringPage = lazy(() => import('../components/MonitoringPage').then(m => ({ default: m.MonitoringPage })));
const LogsPage = lazy(() => import('../components/LogsPage').then(m => ({ default: m.LogsPage })));
const SettingsPage = lazy(() => import('../components/SettingsPage').then(m => ({ default: m.SettingsPage })));

// Phase 4: New pages
const LeaderboardPage = lazy(() => import('../components/LeaderboardPage').then(m => ({ default: m.LeaderboardPage })));
const TrainingHistoryPage = lazy(() => import('../components/TrainingHistoryPage').then(m => ({ default: m.TrainingHistoryPage })));
const ModelManagementPage = lazy(() => import('../components/ModelManagementPage').then(m => ({ default: m.ModelManagementPage })));

export const routes = [
  {
    path: '/',
    element: <LandingPage />,
  },
  {
    path: '/app',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/app/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: (
          <AuthGuard>
            <DashboardPage />
          </AuthGuard>
        ),
      },
      {
        path: 'training',
        element: (
          <AuthGuard requiredRole="trainer">
            <TrainingPage />
          </AuthGuard>
        ),
      },
      {
        path: 'leaderboard',
        element: (
          <AuthGuard>
            <LeaderboardPage />
          </AuthGuard>
        ),
      },
      {
        path: 'history',
        element: (
          <AuthGuard>
            <TrainingHistoryPage />
          </AuthGuard>
        ),
      },
      {
        path: 'management',
        element: (
          <AuthGuard requiredRole="admin">
            <ModelManagementPage />
          </AuthGuard>
        ),
      },
      {
        path: 'documents',
        element: <DocumentsPage />,
      },
      {
        path: 'download',
        element: <DownloadPage />,
      },
      {
        path: 'analytics',
        element: <AnalyticsPage />,
      },
      {
        path: 'data',
        element: <DataPage />,
      },
      {
        path: 'models',
        element: <ModelsPage />,
      },
      {
        path: 'monitoring',
        element: <MonitoringPage />,
      },
      {
        path: 'logs',
        element: <LogsPage />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
    ],
  },
  // Redirect old hash routes to new structure
  {
    path: '/dashboard',
    element: <Navigate to="/app/dashboard" replace />,
  },
  {
    path: '/training',
    element: <Navigate to="/app/training" replace />,
  },
  {
    path: '/documents',
    element: <Navigate to="/app/documents" replace />,
  },
  {
    path: '/download',
    element: <Navigate to="/app/download" replace />,
  },
  {
    path: '/analytics',
    element: <Navigate to="/app/analytics" replace />,
  },
  {
    path: '/data',
    element: <Navigate to="/app/data" replace />,
  },
  {
    path: '/models',
    element: <Navigate to="/app/models" replace />,
  },
  {
    path: '/monitoring',
    element: <Navigate to="/app/monitoring" replace />,
  },
  {
    path: '/logs',
    element: <Navigate to="/app/logs" replace />,
  },
  {
    path: '/settings',
    element: <Navigate to="/app/settings" replace />,
  },
  // 404 page
  {
    path: '*',
    element: <NotFoundPage />,
  },
];

// Router is now created in App.tsx based on environment variable
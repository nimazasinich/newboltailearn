import React, { Suspense, lazy } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { LandingPage } from './components/LandingPage'

const lazyCompat = <T extends Record<string, any>>(imp: () => Promise<T>, key: string) =>
  lazy(async () => { const m = await imp(); return { default: m.default ?? m[key] } })

const Overview           = lazyCompat(() => import('./components/Overview'), 'Overview')
const DashboardAdvanced  = lazyCompat(() => import('./components/Dashboard'), 'Dashboard')
const AnalyticsPage      = lazyCompat(() => import('./components/AnalyticsPage'), 'AnalyticsPage')
const DataPage           = lazyCompat(() => import('./components/DataPage'), 'DataPage')
const ModelsPage         = lazyCompat(() => import('./components/ModelsPage'), 'ModelsPage')
const MonitoringPage     = lazyCompat(() => import('./components/MonitoringPage'), 'MonitoringPage')
const LogsPage           = lazyCompat(() => import('./components/LogsPage'), 'LogsPage')
const SettingsPage       = lazyCompat(() => import('./components/SettingsPage'), 'SettingsPage')
const TeamPage           = lazyCompat(() => import('./components/TeamPage'), 'TeamPage')
const TrainingManagement = lazyCompat(() => import('./components/TrainingManagement'), 'TrainingManagement')
const ProjectDownloader  = lazyCompat(() => import('./components/ProjectDownloader'), 'ProjectDownloader')

function AppLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-12 h-12 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
    </div>
  )
}

export default function App() {
  return (
    <Router>
      <ErrorBoundary>
        <Suspense fallback={<AppLoading />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route element={<AppLayout />}>
              <Route path="/overview" element={<Overview />} />
              <Route path="/dashboard-advanced" element={<DashboardAdvanced />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/data" element={<DataPage />} />
              <Route path="/logs" element={<LogsPage />} />
              <Route path="/models" element={<ModelsPage />} />
              <Route path="/monitoring" element={<MonitoringPage />} />
              <Route path="/training" element={<TrainingManagement />} />
              <Route path="/team" element={<TeamPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/download" element={<ProjectDownloader />} />
            </Route>
            <Route path="/dashboard" element={<Navigate to="/dashboard-advanced" replace />} />
            <Route path="*" element={<Navigate to="/overview" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </Router>
  )
}
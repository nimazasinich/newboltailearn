import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Loading } from './components/Loading';
import { Dashboard } from './components/Dashboard';
import { LandingPage } from './components/LandingPage';
import { AppLayout } from './components/layout/AppLayout';
import { Overview } from './components/dashboard/Overview';
import { TrainingManagement } from './components/dashboard/TrainingManagement';
import { AnalyticsPage } from './components/AnalyticsPage';
import { DataPage } from './components/DataPage';
import { ModelsPage } from './components/ModelsPage';
import { MonitoringPage } from './components/MonitoringPage';
import { LogsPage } from './components/LogsPage';
import { SettingsPage } from './components/SettingsPage';
import { TeamPage } from './components/TeamPage';
import { ProjectDownloader } from './components/ProjectDownloader';
import { DocumentsPage } from './pages/DocumentsPage';
import { TrainingPage } from './pages/TrainingPage';
import { DashboardPage } from './pages/DashboardPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ErrorBoundary } from './components/ErrorBoundary';

function MainApp() {
  const [showLoading, setShowLoading] = useState(true);

  const handleLoadingComplete = () => {
    setShowLoading(false);
  };

  if (showLoading) {
    return <Loading onComplete={handleLoadingComplete} />;
  }

  return <Dashboard />;
}

export default function App() {
  return (
    <Router>
      <ErrorBoundary>
        <Routes>
          {/* Main App with Loading → Dashboard flow */}
          <Route path="/" element={<MainApp />} />
          
          {/* Legacy Landing Page */}
          <Route path="/landing" element={<LandingPage />} />

          {/* App Routes with Layout */}
          <Route path="/app" element={<AppLayout />}>
            <Route path="dashboard" element={<Overview />} />
            <Route path="training" element={<TrainingManagement />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="data" element={<DataPage />} />
            <Route path="models" element={<ModelsPage />} />
            <Route path="monitoring" element={<MonitoringPage />} />
            <Route path="logs" element={<LogsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="team" element={<TeamPage />} />
            <Route path="download" element={<ProjectDownloader />} />
            <Route path="documents" element={<DocumentsPage />} />
            <Route path="training-page" element={<TrainingPage />} />
            <Route path="dashboard-page" element={<DashboardPage />} />
          </Route>

          {/* Direct Dashboard Access */}
          <Route path="/dashboard" element={<Dashboard />} />

          {/* 404 Page */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </ErrorBoundary>
    </Router>
  );
}

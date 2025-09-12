import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Dashboard } from './Dashboard';
import { Overview } from './dashboard/Overview';
import { TrainingControlPanel } from './TrainingControlPanel';
import { AnalyticsPage } from './AnalyticsPage';
import { DataPage } from './DataPage';
import { ModelsPage } from './ModelsPage';
import { MonitoringPage } from './MonitoringPage';
import { LogsPage } from './LogsPage';
import { TeamPage } from './TeamPage';

export function AppRoutes() {
  return (
    <Routes>
      {/* Redirect root to dashboard */}
      <Route path="/" element={<Navigate to="/app/dashboard" replace />} />
      
      {/* Dashboard Hub - Main Layout */}
      <Route path="/app" element={<Dashboard />}>
        <Route index element={<Navigate to="/app/dashboard" replace />} />
        <Route path="dashboard" element={<Overview />} />
        <Route path="training" element={<TrainingControlPanel />} />
        <Route path="monitoring" element={<MonitoringPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="models" element={<ModelsPage />} />
        <Route path="data" element={<DataPage />} />
        <Route path="logs" element={<LogsPage />} />
        <Route path="team" element={<TeamPage />} />
      </Route>
      
      {/* Catch all - redirect to dashboard */}
      <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
    </Routes>
  );
}
import React, { useState, useEffect } from 'react';
import { Cpu, HardDrive, Activity, Clock, Server, Zap, TrendingUp, AlertTriangle, Download, FileText, FileSpreadsheet } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { apiClient, connectSocket, onSystemMetrics, SystemMetrics } from '../services/api';

export function MonitoringPage() {
  const [currentMetrics, setCurrentMetrics] = useState<SystemMetrics | null>(null);
  const [metricsHistory, setMetricsHistory] = useState<SystemMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [timeRange, setTimeRange] = useState('24h');

  useEffect(() => {
    loadInitialMetrics();
    connectSocket();

    const unsubscribeMetrics = onSystemMetrics((metrics) => {
      setCurrentMetrics(metrics);
      setMetricsHistory(prev => {
        const newHistory = [...prev, metrics].slice(-50); // Keep last 50 data points
        return newHistory;
      });
    });

    return () => {
      unsubscribeMetrics();
    };
  }, []);

  const loadInitialMetrics = async () => {
    try {
      const metrics = await apiClient.getMonitoring();
      setCurrentMetrics(metrics);
      setMetricsHistory([metrics]);
    } catch (error) {
      console.error('Failed to load monitoring data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      setExporting(true);
      await apiClient.exportMonitoring(format, timeRange);
    } catch (error) {
      console.error('Failed to export monitoring data:', error);
    } finally {
      setExporting(false);
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days} روز، ${hours} ساعت`;
    } else if (hours > 0) {
      return `${hours} ساعت، ${minutes} دقیقه`;
    } else {
      return `${minutes} دقیقه`;
    }
  };

  const getHealthStatus = (cpu: number, memory: number) => {
    if (cpu > 90 || memory > 90) {
      return { status: 'critical', label: 'بحرانی', color: 'text-red-600' };
    } else if (cpu > 70 || memory > 70) {
      return { status: 'warning', label: 'هشدار', color: 'text-yellow-600' };
    } else {
      return { status: 'healthy', label: 'سالم', color: 'text-green-600' };
    }
  };

  const chartData = metricsHistory.map((metric, index) => ({
    time: index,
    cpu: metric.cpu,
    memory: metric.memory.percentage,
    timestamp: new Date(metric.timestamp).toLocaleTimeString('fa-IR')
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!currentMetrics) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-16 w-16 text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          خطا در دریافت اطلاعات سیستم
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          لطفاً صفحه را بروزرسانی کنید
        </p>
      </div>
    );
  }

  const health = getHealthStatus(currentMetrics.cpu, currentMetrics.memory.percentage);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">نظارت بر سیستم</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            مانیتورینگ بلادرنگ عملکرد سیستم و منابع
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800`}>
            <div className={`w-3 h-3 rounded-full ${
              health.status === 'healthy' ? 'bg-green-500' :
              health.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
            } animate-pulse`}></div>
            <span className={`font-medium ${health.color}`}>{health.label}</span>
          </div>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="1h">۱ ساعت گذشته</option>
            <option value="24h">۲۴ ساعت گذشته</option>
            <option value="7d">۷ روز گذشته</option>
          </select>
          <div className="flex gap-2">
            <button
              onClick={() => handleExport('csv')}
              disabled={exporting}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-3 py-2 rounded-lg flex items-center gap-2 transition-colors text-sm"
            >
              <FileSpreadsheet className="h-4 w-4" />
              {exporting ? '...' : 'CSV'}
            </button>
            <button
              onClick={() => handleExport('json')}
              disabled={exporting}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-3 py-2 rounded-lg flex items-center gap-2 transition-colors text-sm"
            >
              <FileText className="h-4 w-4" />
              {exporting ? '...' : 'JSON'}
            </button>
          </div>
        </div>
      </div>

      {/* System Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* CPU Usage */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Cpu className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {currentMetrics.cpu.toFixed(1)}%
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">CPU</span>
              <span className="text-gray-900 dark:text-white">{currentMetrics.cpu.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${
                  currentMetrics.cpu > 80 ? 'bg-red-500' :
                  currentMetrics.cpu > 60 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(currentMetrics.cpu, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Memory Usage */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
              <HardDrive className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {currentMetrics.memory.percentage}%
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">حافظه</span>
              <span className="text-gray-900 dark:text-white">
                {currentMetrics.memory.used}MB / {currentMetrics.memory.total}MB
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${
                  currentMetrics.memory.percentage > 80 ? 'bg-red-500' :
                  currentMetrics.memory.percentage > 60 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(currentMetrics.memory.percentage, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* System Uptime */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <Clock className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <span className="text-lg font-bold text-gray-900 dark:text-white">
              {formatUptime(currentMetrics.uptime)}
            </span>
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            زمان فعالیت سیستم
          </div>
        </div>

        {/* Training Status */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
              <Activity className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {currentMetrics.training.active}
            </span>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              آموزش فعال
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-500">
              از {currentMetrics.training.total} مدل کل
            </div>
          </div>
        </div>
      </div>

      {/* Performance Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CPU & Memory Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            عملکرد CPU و حافظه
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis 
                  dataKey="timestamp" 
                  stroke="#6B7280"
                  fontSize={12}
                  tick={{ fill: '#6B7280' }}
                />
                <YAxis 
                  stroke="#6B7280"
                  fontSize={12}
                  tick={{ fill: '#6B7280' }}
                  domain={[0, 100]}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#F9FAFB'
                  }}
                  labelStyle={{ color: '#F9FAFB' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="cpu" 
                  stroke="#3B82F6" 
                  strokeWidth={2}
                  dot={false}
                  name="CPU (%)"
                />
                <Line 
                  type="monotone" 
                  dataKey="memory" 
                  stroke="#10B981" 
                  strokeWidth={2}
                  dot={false}
                  name="حافظه (%)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* System Load Area Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            بار سیستم
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis 
                  dataKey="timestamp" 
                  stroke="#6B7280"
                  fontSize={12}
                  tick={{ fill: '#6B7280' }}
                />
                <YAxis 
                  stroke="#6B7280"
                  fontSize={12}
                  tick={{ fill: '#6B7280' }}
                  domain={[0, 100]}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#F9FAFB'
                  }}
                  labelStyle={{ color: '#F9FAFB' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="cpu" 
                  stackId="1"
                  stroke="#8B5CF6" 
                  fill="#8B5CF6"
                  fillOpacity={0.6}
                  name="CPU (%)"
                />
                <Area 
                  type="monotone" 
                  dataKey="memory" 
                  stackId="2"
                  stroke="#F59E0B" 
                  fill="#F59E0B"
                  fillOpacity={0.6}
                  name="حافظه (%)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* System Information */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* System Status */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Server className="h-5 w-5" />
            وضعیت سیستم
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">وضعیت کلی</span>
              <span className={`font-medium ${health.color}`}>{health.label}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">آخرین بروزرسانی</span>
              <span className="text-gray-900 dark:text-white text-sm">
                {new Date(currentMetrics.timestamp).toLocaleTimeString('fa-IR')}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">مدل‌های فعال</span>
              <span className="text-gray-900 dark:text-white">
                {currentMetrics.training.active} از {currentMetrics.training.total}
              </span>
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            متریک‌های عملکرد
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">میانگین CPU</span>
              <span className="text-gray-900 dark:text-white">
                {chartData.length > 0 
                  ? (chartData.reduce((sum, d) => sum + d.cpu, 0) / chartData.length).toFixed(1)
                  : '0.0'
                }%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">میانگین حافظه</span>
              <span className="text-gray-900 dark:text-white">
                {chartData.length > 0 
                  ? (chartData.reduce((sum, d) => sum + d.memory, 0) / chartData.length).toFixed(1)
                  : '0.0'
                }%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">حداکثر CPU</span>
              <span className="text-gray-900 dark:text-white">
                {chartData.length > 0 
                  ? Math.max(...chartData.map(d => d.cpu)).toFixed(1)
                  : '0.0'
                }%
              </span>
            </div>
          </div>
        </div>

        {/* Alerts & Warnings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5" />
            هشدارها
          </h3>
          <div className="space-y-3">
            {currentMetrics.cpu > 80 && (
              <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                <span className="text-sm text-red-800 dark:text-red-200">
                  استفاده بالای CPU ({currentMetrics.cpu.toFixed(1)}%)
                </span>
              </div>
            )}
            {currentMetrics.memory.percentage > 80 && (
              <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                <span className="text-sm text-red-800 dark:text-red-200">
                  استفاده بالای حافظه ({currentMetrics.memory.percentage}%)
                </span>
              </div>
            )}
            {currentMetrics.cpu <= 80 && currentMetrics.memory.percentage <= 80 && (
              <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900 rounded-lg">
                <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                <span className="text-sm text-green-800 dark:text-green-200">
                  همه سیستم‌ها عادی هستند
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
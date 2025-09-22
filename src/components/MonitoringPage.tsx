import React, { useState, useEffect } from 'react';
import { Activity, Cpu, HardDrive, Clock, AlertTriangle, CheckCircle, RefreshCw, Download } from 'lucide-react';
import { getSystemMetrics, getHealthCheck, getLogs, formatUptime, getMetricColor, ALERT_THRESHOLDS, type MonitoringData, type LogEntry } from '@/services/monitoring';
import { PageSkeleton } from './ui/PageSkeleton';
import DataTable, { type Column } from './ui/DataTable';
import { useToast } from './ui/Toast';

export function MonitoringPage() {
  const [metrics, setMetrics] = useState<MonitoringData | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    loadData();
    
    // Auto-refresh every 10 seconds
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [metricsData, logsData] = await Promise.all([
        getSystemMetrics(),
        getLogs({ limit: 100 })
      ]);
      setMetrics(metricsData);
      setLogs(logsData);
    } catch (err) {
      console.error('Failed to load monitoring data:', err);
      setError('خطا در بارگذاری داده‌های نظارت');
    } finally {
      setLoading(false);
    }
  };

  const getHealthStatus = () => {
    if (!metrics) return 'unknown';
    
    const cpuHigh = metrics.cpu > ALERT_THRESHOLDS.cpu.critical;
    const memoryHigh = metrics.memory.percentage > ALERT_THRESHOLDS.memory.critical;
    
    if (cpuHigh || memoryHigh) return 'critical';
    
    const cpuWarning = metrics.cpu > ALERT_THRESHOLDS.cpu.warning;
    const memoryWarning = metrics.memory.percentage > ALERT_THRESHOLDS.memory.warning;
    
    if (cpuWarning || memoryWarning) return 'warning';
    
    return 'healthy';
  };

  const getHealthIcon = () => {
    const status = getHealthStatus();
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'critical':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      default:
        return <Activity className="h-5 w-5 text-gray-600" />;
    }
  };

  const getHealthLabel = () => {
    const status = getHealthStatus();
    switch (status) {
      case 'healthy': return 'سالم';
      case 'warning': return 'هشدار';
      case 'critical': return 'بحرانی';
      default: return 'نامشخص';
    }
  };

  const getHealthColor = () => {
    const status = getHealthStatus();
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-50 dark:bg-green-950';
      case 'warning': return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950';
      case 'critical': return 'text-red-600 bg-red-50 dark:bg-red-950';
      default: return 'text-gray-600 bg-gray-50 dark:bg-gray-950';
    }
  };

  const logColumns: Column<LogEntry>[] = [
    {
      key: 'timestamp',
      title: 'زمان',
      sortable: true,
      width: '150px',
      render: (value) => (
        <span className="text-sm font-mono">
          {new Date(value).toLocaleString('fa-IR')}
        </span>
      ),
    },
    {
      key: 'level',
      title: 'سطح',
      sortable: true,
      width: '80px',
      align: 'center',
      render: (value) => {
        const colors = {
          info: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
          warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
          error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
          debug: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
        };
        
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[value as keyof typeof colors] || colors.debug}`}>
            {value}
          </span>
        );
      },
    },
    {
      key: 'category',
      title: 'دسته‌بندی',
      sortable: true,
      width: '120px',
    },
    {
      key: 'message',
      title: 'پیام',
      render: (value, row) => (
        <div>
          <div className="text-sm">{value}</div>
          {row.model_name && (
            <div className="text-xs text-gray-500 mt-1">
              مدل: {row.model_name}
            </div>
          )}
        </div>
      ),
    },
  ];

  if (loading && !metrics) {
    return <PageSkeleton showHeader />;
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">نظارت سیستم</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            وضعیت سیستم و گزارش‌های عملکرد
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            بروزرسانی
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        </div>
      )}

      {/* System Health Overview */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">وضعیت کلی سیستم</h2>
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${getHealthColor()}`}>
            {getHealthIcon()}
            <span className="font-medium">{getHealthLabel()}</span>
          </div>
        </div>

        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* CPU Usage */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-medium">CPU</span>
                </div>
                <span className={`text-sm font-bold ${getMetricColor(metrics.cpu, ALERT_THRESHOLDS.cpu)}`}>
                  {metrics.cpu.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    metrics.cpu > ALERT_THRESHOLDS.cpu.critical ? 'bg-red-500' :
                    metrics.cpu > ALERT_THRESHOLDS.cpu.warning ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(100, metrics.cpu)}%` }}
                ></div>
              </div>
            </div>

            {/* Memory Usage */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-medium">حافظه</span>
                </div>
                <span className={`text-sm font-bold ${getMetricColor(metrics.memory.percentage, ALERT_THRESHOLDS.memory)}`}>
                  {metrics.memory.percentage.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    metrics.memory.percentage > ALERT_THRESHOLDS.memory.critical ? 'bg-red-500' :
                    metrics.memory.percentage > ALERT_THRESHOLDS.memory.warning ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(100, metrics.memory.percentage)}%` }}
                ></div>
              </div>
              <div className="text-xs text-gray-500">
                {(metrics.memory.used / 1024).toFixed(1)} GB / {(metrics.memory.total / 1024).toFixed(1)} GB
              </div>
            </div>

            {/* Uptime */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium">آپ‌تایم</span>
              </div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                {formatUptime(metrics.uptime)}
              </div>
              <div className="text-xs text-gray-500">
                سیستم: {formatUptime(metrics.system_uptime)}
              </div>
            </div>

            {/* Active Training */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium">آموزش فعال</span>
              </div>
              <div className="text-lg font-bold text-blue-600">
                {metrics.active_training}
              </div>
              {metrics.training && (
                <div className="text-xs text-gray-500">
                  کل: {metrics.training.total} | تکمیل: {metrics.training.completed}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* System Logs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">گزارش‌های سیستم</h2>
            <button
              onClick={() => {
                // Export logs functionality
                showToast('قابلیت صادرات گزارش‌ها در حال توسعه است', 'info');
              }}
              className="flex items-center gap-2 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-md transition-colors"
            >
              <Download className="h-4 w-4" />
              صادرات
            </button>
          </div>
          
          <DataTable
            data={logs}
            columns={logColumns}
            loading={loading}
            error={error}
            emptyMessage="هیچ گزارشی یافت نشد"
            searchPlaceholder="جستجوی گزارش‌ها..."
            itemsPerPage={20}
          />
        </div>
      </div>
    </div>
  );
}

export default MonitoringPage;
import React, { useState, useEffect } from 'react';
import { FileText, Filter, Download, RefreshCw, AlertCircle, Search } from 'lucide-react';
import { getLogs, getSystemLogs, getTrainingLogs, getErrorLogs, type LogEntry } from '@/services/monitoring';
import { PageSkeleton } from './ui/PageSkeleton';
import DataTable, { type Column } from './ui/DataTable';
import { useToast } from './ui/Toast';

type LogFilter = 'all' | 'system' | 'training' | 'error';

export function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<LogFilter>('all');
  const { showToast } = useToast();

  useEffect(() => {
    loadLogs();
  }, [filter]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let logsData: LogEntry[];
      switch (filter) {
        case 'system':
          logsData = await getSystemLogs(200);
          break;
        case 'training':
          logsData = await getTrainingLogs(200);
          break;
        case 'error':
          logsData = await getErrorLogs(200);
          break;
        default:
          logsData = await getLogs({ limit: 200 });
      }
      
      setLogs(logsData);
    } catch (err) {
      console.error('Failed to load logs:', err);
      setError('خطا در بارگذاری گزارش‌ها');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    try {
      const csvContent = [
        ['زمان', 'سطح', 'دسته‌بندی', 'پیام', 'جزئیات'].join(','),
        ...logs.map(log => [
          new Date(log.timestamp).toLocaleString('fa-IR'),
          log.level,
          log.category || '',
          `"${log.message.replace(/"/g, '""')}"`,
          log.metadata ? `"${log.metadata.replace(/"/g, '""')}"` : ''
        ].join(','))
      ].join('\n');

      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `logs_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showToast('گزارش‌ها با موفقیت صادر شد', 'success');
    } catch (err) {
      console.error('Failed to export logs:', err);
      showToast('خطا در صادرات گزارش‌ها', 'error');
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error':
        return '🔴';
      case 'warning':
        return '🟡';
      case 'info':
        return '🔵';
      case 'debug':
        return '⚪';
      default:
        return '📝';
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'info':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'debug':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const columns: Column<LogEntry>[] = [
    {
      key: 'timestamp',
      title: 'زمان',
      sortable: true,
      width: '160px',
      render: (value) => (
        <div className="text-xs font-mono">
          <div>{new Date(value).toLocaleDateString('fa-IR')}</div>
          <div className="text-gray-500">{new Date(value).toLocaleTimeString('fa-IR')}</div>
        </div>
      ),
    },
    {
      key: 'level',
      title: 'سطح',
      sortable: true,
      width: '90px',
      align: 'center',
      render: (value) => (
        <div className="flex items-center justify-center gap-1">
          <span>{getLevelIcon(value)}</span>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getLevelColor(value)}`}>
            {value}
          </span>
        </div>
      ),
    },
    {
      key: 'category',
      title: 'دسته‌بندی',
      sortable: true,
      width: '120px',
      render: (value) => (
        <span className="text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-700 dark:text-gray-300">
          {value || 'عمومی'}
        </span>
      ),
    },
    {
      key: 'message',
      title: 'پیام',
      render: (value, row) => (
        <div className="space-y-1">
          <div className="text-sm">{value}</div>
          {row.model_name && (
            <div className="text-xs text-blue-600 dark:text-blue-400">
              مدل: {row.model_name}
            </div>
          )}
          {(row.epoch !== undefined || row.accuracy !== undefined) && (
            <div className="text-xs text-gray-500 space-x-2 space-x-reverse">
              {row.epoch !== undefined && <span>Epoch: {row.epoch}</span>}
              {row.accuracy !== undefined && <span>دقت: {(row.accuracy * 100).toFixed(1)}%</span>}
              {row.loss !== undefined && <span>Loss: {row.loss.toFixed(4)}</span>}
            </div>
          )}
          {row.metadata && (
            <details className="text-xs">
              <summary className="cursor-pointer text-gray-500 hover:text-gray-700">جزئیات</summary>
              <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-700 rounded text-xs overflow-auto">
                {JSON.stringify(JSON.parse(row.metadata), null, 2)}
              </pre>
            </details>
          )}
        </div>
      ),
    },
  ];

  const filterOptions = [
    { value: 'all', label: 'همه گزارش‌ها', count: logs.length },
    { value: 'system', label: 'سیستم', count: logs.filter(l => l.category !== 'training').length },
    { value: 'training', label: 'آموزش', count: logs.filter(l => l.category === 'training').length },
    { value: 'error', label: 'خطاها', count: logs.filter(l => l.level === 'error').length },
  ];

  if (loading && logs.length === 0) {
    return <PageSkeleton showHeader />;
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">گزارش‌های سیستم</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            مشاهده و تحلیل گزارش‌های سیستم و فعالیت‌های آموزش
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            disabled={logs.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-4 w-4" />
            صادرات CSV
          </button>
          <button
            onClick={loadLogs}
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
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">فیلتر:</span>
          </div>
          <div className="flex gap-2">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setFilter(option.value as LogFilter)}
                className={`flex items-center gap-2 px-3 py-1 rounded-lg text-sm transition-colors ${
                  filter === option.value
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <span>{option.label}</span>
                <span className="bg-white dark:bg-gray-800 px-2 py-0.5 rounded-full text-xs">
                  {option.count.toLocaleString('fa-IR')}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {filterOptions.find(f => f.value === filter)?.label || 'گزارش‌ها'}
            </h2>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {logs.length.toLocaleString('fa-IR')} مورد
            </div>
          </div>
          
          <DataTable
            data={logs}
            columns={columns}
            loading={loading}
            error={error}
            emptyMessage="هیچ گزارشی یافت نشد"
            searchPlaceholder="جستجوی گزارش‌ها..."
            itemsPerPage={25}
            compact
          />
        </div>
      </div>
    </div>
  );
}

export default LogsPage;
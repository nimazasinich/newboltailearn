import React, { useState, useEffect } from 'react';
import { Database, Download, Plus, Trash2, RefreshCw, AlertCircle, CheckCircle, Clock, HardDrive } from 'lucide-react';
import { getDatasets, downloadDataset, getDatasetStats, type Dataset } from '@/services/datasets';
import { PageSkeleton } from './ui/PageSkeleton';
import DataTable, { type Column } from './ui/DataTable';
import { useToast } from './ui/Toast';
import { formatBytes } from '@/services/monitoring';

export function DataPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [datasetsData, statsData] = await Promise.all([
        getDatasets(),
        getDatasetStats()
      ]);
      setDatasets(datasetsData);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to load datasets:', err);
      setError('خطا در بارگذاری داده‌ها');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (dataset: Dataset) => {
    try {
      showToast(`شروع دانلود ${dataset.name}...`, 'info');
      await downloadDataset(dataset.id);
      showToast(`دانلود ${dataset.name} با موفقیت شروع شد`, 'success');
      // Reload data to get updated status
      setTimeout(loadData, 1000);
    } catch (err) {
      console.error('Failed to download dataset:', err);
      showToast(`خطا در دانلود ${dataset.name}`, 'error');
    }
  };

  const getStatusIcon = (status: Dataset['status']) => {
    switch (status) {
      case 'available':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'downloading':
        return <Clock className="h-4 w-4 text-blue-600 animate-spin" />;
      case 'processing':
        return <RefreshCw className="h-4 w-4 text-yellow-600 animate-spin" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Database className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusLabel = (status: Dataset['status']) => {
    switch (status) {
      case 'available': return 'در دسترس';
      case 'downloading': return 'در حال دانلود';
      case 'processing': return 'در حال پردازش';
      case 'error': return 'خطا';
      default: return status;
    }
  };

  const getStatusColor = (status: Dataset['status']) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'downloading': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'processing': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'error': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const columns: Column<Dataset>[] = [
    {
      key: 'name',
      title: 'نام دیتاست',
      sortable: true,
      render: (value, row) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-white">{value}</div>
          {row.description && (
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{row.description}</div>
          )}
        </div>
      ),
    },
    {
      key: 'samples',
      title: 'تعداد نمونه',
      sortable: true,
      align: 'center',
      render: (value) => (
        <span className="font-mono">{value?.toLocaleString('fa-IR') || '0'}</span>
      ),
    },
    {
      key: 'size_mb',
      title: 'حجم',
      sortable: true,
      align: 'center',
      render: (value) => (
        <span className="font-mono">{formatBytes(value * 1024 * 1024)}</span>
      ),
    },
    {
      key: 'status',
      title: 'وضعیت',
      sortable: true,
      align: 'center',
      render: (value, row) => (
        <div className="flex items-center justify-center gap-2">
          {getStatusIcon(value)}
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(value)}`}>
            {getStatusLabel(value)}
          </span>
        </div>
      ),
    },
    {
      key: 'created_at',
      title: 'تاریخ ایجاد',
      sortable: true,
      align: 'center',
      render: (value) => (
        <span className="text-sm">
          {new Date(value).toLocaleDateString('fa-IR')}
        </span>
      ),
    },
    {
      key: 'id',
      title: 'عملیات',
      align: 'center',
      render: (_, row) => (
        <div className="flex items-center justify-center gap-2">
          {row.status === 'available' ? (
            <button
              onClick={() => handleDownload(row)}
              className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-lg transition-colors"
              title="دانلود مجدد"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          ) : row.status !== 'downloading' && row.status !== 'processing' ? (
            <button
              onClick={() => handleDownload(row)}
              className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-950 rounded-lg transition-colors"
              title="دانلود"
            >
              <Download className="h-4 w-4" />
            </button>
          ) : (
            <div className="p-2 text-gray-400">
              <Clock className="h-4 w-4" />
            </div>
          )}
        </div>
      ),
    },
  ];

  if (loading) {
    return <PageSkeleton showHeader />;
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">مدیریت دیتاست‌ها</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            دانلود و مدیریت مجموعه‌های داده برای آموزش مدل‌ها
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
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                <Database className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.total.toLocaleString('fa-IR')}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">کل دیتاست‌ها</div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.available.toLocaleString('fa-IR')}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">در دسترس</div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.downloading.toLocaleString('fa-IR')}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">در حال دانلود</div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                <HardDrive className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.totalSamples.toLocaleString('fa-IR')}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">کل نمونه‌ها</div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center">
                <HardDrive className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatBytes(stats.totalSizeMB * 1024 * 1024)}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">کل حجم</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Data Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            لیست دیتاست‌ها
          </h2>
          
          <DataTable
            data={datasets}
            columns={columns}
            loading={loading}
            error={error}
            emptyMessage="هیچ دیتاستی یافت نشد"
            searchPlaceholder="جستجوی دیتاست..."
          />
        </div>
      </div>
    </div>
  );
}

export default DataPage;
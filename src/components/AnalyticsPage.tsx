import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Area, AreaChart } from 'recharts';
import { TrendingUp, Users, Database, Brain, Activity, Calendar, Target, Award, Download, FileText, FileSpreadsheet } from 'lucide-react';
import { apiClient } from '../services/api';

interface AnalyticsData {
  modelStats: Array<{
    type: string;
    count: number;
    avg_accuracy: number;
    max_accuracy: number;
  }>;
  trainingStats: Array<{
    date: string;
    models_created: number;
  }>;
  recentActivity: Array<{
    level: string;
    count: number;
  }>;
  summary: {
    totalModels: number;
    activeTraining: number;
    completedModels: number;
    totalDatasets: number;
  };
}

export function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = async () => {
    try {
      const data = await apiClient.getAnalytics();
      setAnalytics(data);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      setExporting(true);
      await apiClient.exportAnalytics(format, timeRange);
    } catch (error) {
      console.error('Failed to export analytics:', error);
    } finally {
      setExporting(false);
    }
  };

  const getModelTypeLabel = (type: string) => {
    switch (type) {
      case 'dora': return 'DoRA';
      case 'qr-adaptor': return 'QR-Adaptor';
      case 'persian-bert': return 'Persian BERT';
      default: return type;
    }
  };

  const getActivityLevelLabel = (level: string) => {
    switch (level) {
      case 'info': return 'اطلاعات';
      case 'warning': return 'هشدار';
      case 'error': return 'خطا';
      case 'debug': return 'دیباگ';
      default: return level;
    }
  };

  const getActivityColor = (level: string) => {
    switch (level) {
      case 'info': return '#3B82F6';
      case 'warning': return '#F59E0B';
      case 'error': return '#EF4444';
      case 'debug': return '#8B5CF6';
      default: return '#6B7280';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500 dark:text-gray-400">خطا در بارگذاری داده‌های تحلیلی</div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">تحلیل‌ها و گزارش‌ها</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            آمار و تحلیل عملکرد سیستم آموزش هوش مصنوعی
          </p>
        </div>
        <div className="flex gap-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="7d">۷ روز گذشته</option>
            <option value="30d">۳۰ روز گذشته</option>
            <option value="90d">۹۰ روز گذشته</option>
          </select>
          <div className="relative">
            <button
              onClick={() => handleExport('csv')}
              disabled={exporting}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <FileSpreadsheet className="h-4 w-4" />
              {exporting ? 'در حال صادرات...' : 'CSV'}
            </button>
          </div>
          <div className="relative">
            <button
              onClick={() => handleExport('json')}
              disabled={exporting}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <FileText className="h-4 w-4" />
              {exporting ? 'در حال صادرات...' : 'JSON'}
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Brain className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="ms-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">کل مدل‌ها</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.summary.totalModels}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
              <Activity className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="ms-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">آموزش فعال</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.summary.activeTraining}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <Award className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="ms-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">مدل‌های تکمیل شده</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.summary.completedModels}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
              <Database className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="ms-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">دیتاست‌ها</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.summary.totalDatasets}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Model Types Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            توزیع انواع مدل‌ها
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.modelStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis 
                  dataKey="type" 
                  stroke="#6B7280"
                  fontSize={12}
                  tick={{ fill: '#6B7280' }}
                  tickFormatter={getModelTypeLabel}
                />
                <YAxis 
                  stroke="#6B7280"
                  fontSize={12}
                  tick={{ fill: '#6B7280' }}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#F9FAFB'
                  }}
                  labelStyle={{ color: '#F9FAFB' }}
                  labelFormatter={(value) => getModelTypeLabel(value)}
                />
                <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} name="تعداد مدل" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Model Accuracy */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            دقت مدل‌ها
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.modelStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis 
                  dataKey="type" 
                  stroke="#6B7280"
                  fontSize={12}
                  tick={{ fill: '#6B7280' }}
                  tickFormatter={getModelTypeLabel}
                />
                <YAxis 
                  stroke="#6B7280"
                  fontSize={12}
                  tick={{ fill: '#6B7280' }}
                  domain={[0, 1]}
                  tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#F9FAFB'
                  }}
                  labelStyle={{ color: '#F9FAFB' }}
                  labelFormatter={(value) => getModelTypeLabel(value)}
                  formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, 'دقت میانگین']}
                />
                <Bar dataKey="avg_accuracy" fill="#10B981" radius={[4, 4, 0, 0]} name="دقت میانگین" />
                <Bar dataKey="max_accuracy" fill="#F59E0B" radius={[4, 4, 0, 0]} name="حداکثر دقت" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Training Activity Over Time */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            فعالیت آموزش در طول زمان
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.trainingStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis 
                  dataKey="date" 
                  stroke="#6B7280"
                  fontSize={12}
                  tick={{ fill: '#6B7280' }}
                  tickFormatter={(value) => new Date(value).toLocaleDateString('fa-IR')}
                />
                <YAxis 
                  stroke="#6B7280"
                  fontSize={12}
                  tick={{ fill: '#6B7280' }}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#F9FAFB'
                  }}
                  labelStyle={{ color: '#F9FAFB' }}
                  labelFormatter={(value) => new Date(value).toLocaleDateString('fa-IR')}
                />
                <Area 
                  type="monotone" 
                  dataKey="models_created" 
                  stroke="#8B5CF6" 
                  fill="#8B5CF6"
                  fillOpacity={0.6}
                  name="مدل‌های ایجاد شده"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* System Activity Levels */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            سطح فعالیت سیستم
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics.recentActivity}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ level, percent }) => `${getActivityLevelLabel(level)} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                  nameKey="level"
                >
                  {analytics.recentActivity.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getActivityColor(entry.level)} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#F9FAFB'
                  }}
                  formatter={(value, name) => [value, getActivityLevelLabel(name as string)]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Detailed Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Model Performance */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Target className="h-5 w-5" />
            عملکرد مدل‌ها
          </h3>
          <div className="space-y-4">
            {analytics.modelStats.map((stat) => (
              <div key={stat.type} className="border-b border-gray-200 dark:border-gray-700 pb-3 last:border-b-0">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-gray-900 dark:text-white">
                    {getModelTypeLabel(stat.type)}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {stat.count} مدل
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">میانگین دقت:</span>
                  <span className="text-gray-900 dark:text-white">
                    {(stat.avg_accuracy * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">حداکثر دقت:</span>
                  <span className="text-gray-900 dark:text-white">
                    {(stat.max_accuracy * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity Summary */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            خلاصه فعالیت‌ها
          </h3>
          <div className="space-y-4">
            {analytics.recentActivity.map((activity) => (
              <div key={activity.level} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: getActivityColor(activity.level) }}
                  ></div>
                  <span className="text-gray-900 dark:text-white">
                    {getActivityLevelLabel(activity.level)}
                  </span>
                </div>
                <span className="text-gray-600 dark:text-gray-400">
                  {activity.count} مورد
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            شاخص‌های کلیدی
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">نرخ موفقیت آموزش</span>
              <span className="text-gray-900 dark:text-white font-medium">
                {analytics.summary.totalModels > 0 
                  ? ((analytics.summary.completedModels / analytics.summary.totalModels) * 100).toFixed(1)
                  : '0'
                }%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">مدل‌های در حال آموزش</span>
              <span className="text-gray-900 dark:text-white font-medium">
                {analytics.summary.activeTraining}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">میانگین دقت کل</span>
              <span className="text-gray-900 dark:text-white font-medium">
                {analytics.modelStats.length > 0
                  ? (analytics.modelStats.reduce((sum, stat) => sum + stat.avg_accuracy, 0) / analytics.modelStats.length * 100).toFixed(1)
                  : '0'
                }%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">بهترین عملکرد</span>
              <span className="text-gray-900 dark:text-white font-medium">
                {analytics.modelStats.length > 0
                  ? (Math.max(...analytics.modelStats.map(stat => stat.max_accuracy)) * 100).toFixed(1)
                  : '0'
                }%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
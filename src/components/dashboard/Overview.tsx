import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Progress } from '../ui/Progress';
import { 
  Activity, 
  Brain, 
  FileText, 
  Users, 
  TrendingUp, 
  Clock,
  CheckCircle,
  AlertCircle,
  Cpu,
  HardDrive,
  Database,
  Zap
} from 'lucide-react';
import { 
  apiClient, 
  onSystemMetrics, 
  onTrainingProgress, 
  onTrainingCompleted,
  SystemMetrics 
} from '../../services/api';
import { formatPersianDate, formatPersianDuration, formatPersianPercentage } from '../../services/PersianUtils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';

export function Overview() {
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [models, setModels] = useState<any[]>([]);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [monitoring, setMonitoring] = useState<any>(null);
  const [trainingProgress, setTrainingProgress] = useState<Map<number, any>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [modelsData, datasetsData, analyticsData, monitoringData] = await Promise.all([
          apiClient.getModels(),
          apiClient.getDatasets(), 
          apiClient.getAnalytics(),
          apiClient.getMonitoring()
        ]);
        
        setModels(modelsData);
        setDatasets(datasetsData);
        setAnalytics(analyticsData);
        setMonitoring(monitoringData);
      } catch (error) {
        console.error('Error loading overview data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
    
    // Update data every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  // WebSocket listeners for real-time updates
  useEffect(() => {
    const unsubscribeMetrics = onSystemMetrics((metrics) => {
      setSystemMetrics(metrics);
    });

    const unsubscribeProgress = onTrainingProgress((data) => {
      setTrainingProgress(prev => new Map(prev.set(data.modelId, data)));
    });

    const unsubscribeCompleted = onTrainingCompleted((data) => {
      setTrainingProgress(prev => {
        const newMap = new Map(prev);
        newMap.delete(data.modelId);
        return newMap;
      });
      // Reload data to get updated model status
      setTimeout(() => {
        apiClient.getModels().then(setModels).catch(console.error);
        apiClient.getAnalytics().then(setAnalytics).catch(console.error);
      }, 1000);
    });

    return () => {
      unsubscribeMetrics();
      unsubscribeProgress();
      unsubscribeCompleted();
    };
  }, []);

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'excellent': return 'success';
      case 'good': return 'default';
      case 'fair': return 'warning';
      case 'poor': return 'destructive';
      default: return 'secondary';
    }
  };

  const getHealthText = (health: string) => {
    switch (health) {
      case 'excellent': return 'عالی';
      case 'good': return 'خوب';
      case 'fair': return 'متوسط';
      case 'poor': return 'ضعیف';
      default: return 'نامشخص';
    }
  };

  // Process analytics data for charts
  const trainingProgressData = analytics?.trainingStats || [];
  
  const modelPerformanceData = analytics?.modelStats?.map((stat: any) => ({
    name: stat.type === 'dora' ? 'DoRA' : 
          stat.type === 'qr-adaptor' ? 'QR-Adaptor' : 
          stat.type === 'persian-bert' ? 'Persian BERT' : stat.type,
    performance: Math.round(stat.avg_accuracy * 100),
    sessions: stat.count,
    max_accuracy: Math.round(stat.max_accuracy * 100)
  })) || [];

  const systemHealthData = systemMetrics ? [
    { name: 'CPU', value: systemMetrics.cpu, color: '#3B82F6' },
    { name: 'Memory', value: systemMetrics.memory.percentage, color: '#10B981' },
    { name: 'Active Training', value: (monitoring?.training?.active || 0) * 10, color: '#8B5CF6' }
  ] : [];

  const getSystemHealthLevel = () => {
    if (!systemMetrics) return 'good';
    const cpu = systemMetrics.cpu;
    const memory = systemMetrics.memory.percentage;
    
    if (cpu > 90 || memory > 90) return 'poor';
    if (cpu > 70 || memory > 70) return 'fair';
    if (cpu > 50 || memory > 50) return 'good';
    return 'excellent';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {[...Array(8)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-gray-300 rounded w-1/2 mb-4"></div>
              <div className="h-8 bg-gray-300 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          داشبورد سیستم آموزش هوش مصنوعی
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          آخرین بروزرسانی: {systemMetrics ? new Date(systemMetrics.timestamp).toLocaleString('fa-IR') : 'در حال بارگذاری...'}
        </p>
      </div>

      {/* System Health Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
              وضعیت سیستم
            </CardTitle>
            <Activity className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              <Badge variant={getHealthColor(getSystemHealthLevel())}>
                {getHealthText(getSystemHealthLevel())}
              </Badge>
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
              آپ‌تایم: {systemMetrics ? formatPersianDuration(systemMetrics.uptime * 1000) : '---'}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
              جلسات آموزش فعال
            </CardTitle>
            <Brain className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900 dark:text-green-100">
              {monitoring?.training?.active || 0}
            </div>
            <p className="text-xs text-green-600 dark:text-green-400 mt-2">
              کل مدل‌ها: {monitoring?.training?.total || 0}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">
              دیتاست‌ها
            </CardTitle>
            <Database className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
              {monitoring?.datasets?.available || 0}
            </div>
            <p className="text-xs text-purple-600 dark:text-purple-400 mt-2">
              کل دیتاست: {monitoring?.datasets?.total || 0}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-300">
              بهترین دقت مدل
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
              {formatPersianPercentage(
                analytics?.modelStats?.length > 0 
                  ? Math.max(...analytics.modelStats.map((stat: any) => stat.max_accuracy)) * 100 
                  : 0, 1
              )}
            </div>
            <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">
              نرخ موفقیت: {monitoring?.training?.success_rate || '0'}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* System Resources */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-xl font-bold">
              <Cpu className="h-6 w-6" />
              منابع سیستم
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex justify-between mb-3">
                <span className="text-base font-medium text-gray-600 dark:text-gray-400">CPU</span>
                <span className="text-base font-bold">
                  {formatPersianPercentage(systemMetrics?.cpu || 0, 0)}
                </span>
              </div>
              <Progress 
                value={systemMetrics?.cpu || 0} 
                className={systemMetrics?.cpu && systemMetrics.cpu > 80 ? 'bg-red-200' : systemMetrics?.cpu && systemMetrics.cpu > 60 ? 'bg-yellow-200' : 'bg-blue-200'}
              />
            </div>
            
            <div>
              <div className="flex justify-between mb-3">
                <span className="text-base font-medium text-gray-600 dark:text-gray-400">حافظه</span>
                <span className="text-base font-bold">
                  {formatPersianPercentage(systemMetrics?.memory?.percentage || 0, 0)}
                </span>
              </div>
              <Progress 
                value={systemMetrics?.memory?.percentage || 0} 
                className={systemMetrics?.memory?.percentage && systemMetrics.memory.percentage > 80 ? 'bg-red-200' : systemMetrics?.memory?.percentage && systemMetrics.memory.percentage > 60 ? 'bg-yellow-200' : 'bg-green-200'}
              />
              <p className="text-xs text-gray-500 mt-1">
                {systemMetrics?.memory?.used || 0} / {systemMetrics?.memory?.total || 0} MB
              </p>
            </div>
            
            <div>
              <div className="flex justify-between mb-3">
                <span className="text-base font-medium text-gray-600 dark:text-gray-400">آموزش فعال</span>
                <span className="text-base font-bold">
                  {monitoring?.training?.active || 0} جلسه
                </span>
              </div>
              <Progress 
                value={(monitoring?.training?.active || 0) * 20} 
                className="bg-purple-200"
              />
            </div>
            
            <div>
              <div className="flex justify-between mb-3">
                <span className="text-base font-medium text-gray-600 dark:text-gray-400">فعالیت سیستم</span>
                <span className="text-base font-bold">
                  {Object.values(monitoring?.activity || {}).reduce((sum: number, count: any) => sum + count, 0)} رویداد
                </span>
              </div>
              <Progress value={Math.min(100, Object.values(monitoring?.activity || {}).reduce((sum: number, count: any) => sum + count, 0))} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-xl font-bold">
              <Clock className="h-6 w-6" />
              آمار آموزش
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-xl">
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle className="h-5 w-5 text-blue-600" />
                  <span className="text-base font-medium text-blue-700 dark:text-blue-300">تکمیل شده</span>
                </div>
                <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                  {monitoring?.training?.completed || 0}
                </div>
              </div>
              
              <div className="bg-yellow-50 dark:bg-yellow-950 p-4 rounded-xl">
                <div className="flex items-center gap-3 mb-2">
                  <Activity className="h-5 w-5 text-yellow-600" />
                  <span className="text-base font-medium text-yellow-700 dark:text-yellow-300">در حال اجرا</span>
                </div>
                <div className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">
                  {monitoring?.training?.active || 0}
                </div>
              </div>
              
              <div className="bg-red-50 dark:bg-red-950 p-4 rounded-xl">
                <div className="flex items-center gap-3 mb-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <span className="text-base font-medium text-red-700 dark:text-red-300">ناموفق</span>
                </div>
                <div className="text-2xl font-bold text-red-900 dark:text-red-100">
                  {monitoring?.training?.failed || 0}
                </div>
              </div>
              
              <div className="bg-green-50 dark:bg-green-950 p-4 rounded-xl">
                <div className="flex items-center gap-3 mb-2">
                  <Zap className="h-5 w-5 text-green-600" />
                  <span className="text-base font-medium text-green-700 dark:text-green-300">نرخ موفقیت</span>
                </div>
                <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                  {monitoring?.training?.success_rate || '0'}%
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-bold">فعالیت آموزش در طول زمان</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <ResponsiveContainer width="100%" height={350}>
              {trainingProgressData.length > 0 ? (
                <AreaChart data={trainingProgressData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Area 
                    type="monotone" 
                    dataKey="models_created" 
                    stroke="#3B82F6" 
                    fill="#3B82F6"
                    fillOpacity={0.6}
                  />
                </AreaChart>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  هیچ داده‌ای برای نمایش وجود ندارد
                </div>
              )}
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-bold">عملکرد مدل‌های مختلف</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <ResponsiveContainer width="100%" height={350}>
              {modelPerformanceData.length > 0 ? (
                <BarChart data={modelPerformanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value, name) => [
                      name === 'performance' ? `${value}%` : value,
                      name === 'performance' ? 'میانگین دقت' : 'تعداد جلسات'
                    ]}
                  />
                  <Bar dataKey="performance" fill="#10B981" radius={[4, 4, 0, 0]} name="performance" />
                  <Bar dataKey="max_accuracy" fill="#3B82F6" radius={[4, 4, 0, 0]} name="max_accuracy" />
                </BarChart>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  هیچ داده‌ای برای نمایش وجود ندارد
                </div>
              )}
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* System Activity Pie Chart */}
      {systemHealthData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-bold">وضعیت سیستم</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={systemHealthData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value.toFixed(1)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {systemHealthData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value.toFixed(1)}%`, 'استفاده']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-bold">فعالیت‌های اخیر</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-5">
            {models.slice(0, 5).map((model) => {
              const progress = trainingProgress.get(model.id);
              return (
                <div key={model.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center gap-4">
                    <Brain className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-semibold text-base">{model.name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {model.type === 'dora' ? 'DoRA' : 
                         model.type === 'qr-adaptor' ? 'QR-Adaptor' : 
                         model.type === 'persian-bert' ? 'Persian BERT' : model.type}
                        {progress && ` • Epoch ${progress.epoch}/${progress.totalEpochs}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {progress && (
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {progress.completionPercentage.toFixed(1)}%
                      </div>
                    )}
                    <Badge variant={
                      model.status === 'completed' ? 'success' :
                      model.status === 'training' ? 'default' :
                      model.status === 'failed' ? 'destructive' : 
                      model.status === 'paused' ? 'warning' : 'secondary'
                    }>
                      {model.status === 'completed' ? 'تکمیل شده' :
                       model.status === 'training' ? 'در حال آموزش' :
                       model.status === 'failed' ? 'ناموفق' :
                       model.status === 'paused' ? 'متوقف شده' : 'آماده'}
                    </Badge>
                  </div>
                </div>
              );
            })}
            {models.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                هیچ مدلی یافت نشد
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
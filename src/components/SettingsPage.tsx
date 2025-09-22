import React, { useState, useEffect } from 'react';
import { Settings, Save, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { apiRequest, API_ENDPOINTS } from '@/lib/api-config';
import { PageSkeleton } from './ui/PageSkeleton';
import { Input } from './ui/Input';
import { useToast } from './ui/Toast';

interface SystemSettings {
  [key: string]: {
    value: string;
    description: string;
    updated_at: string;
  };
}

export function SettingsPage() {
  const [settings, setSettings] = useState<SystemSettings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiRequest(API_ENDPOINTS.SETTINGS);
      const data = await response.json();
      setSettings(data);
    } catch (err) {
      console.error('Failed to load settings:', err);
      setError('خطا در بارگذاری تنظیمات');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      const updates: Record<string, string> = {};
      Object.entries(settings).forEach(([key, setting]) => {
        updates[key] = setting.value;
      });

      await apiRequest(API_ENDPOINTS.SETTINGS, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });

      showToast('تنظیمات با موفقیت ذخیره شد', 'success');
      await loadSettings(); // Reload to get updated timestamps
    } catch (err) {
      console.error('Failed to save settings:', err);
      showToast('خطا در ذخیره تنظیمات', 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: string, value: string) => {
    setSettings(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        value
      }
    }));
  };

  const settingCategories = [
    {
      title: 'تنظیمات عمومی',
      keys: ['dataset_directory', 'model_directory']
    },
    {
      title: 'تنظیمات آموزش',
      keys: ['max_concurrent_training', 'default_batch_size', 'default_learning_rate']
    },
    {
      title: 'تنظیمات API',
      keys: ['huggingface_token_configured']
    }
  ];

  if (loading) {
    return <PageSkeleton showHeader />;
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">تنظیمات سیستم</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            پیکربندی و تنظیمات عمومی سیستم
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={loadSettings}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            بروزرسانی
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Save className={`h-4 w-4 ${saving ? 'animate-pulse' : ''}`} />
            {saving ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
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

      {/* Settings Categories */}
      <div className="space-y-6">
        {settingCategories.map((category) => (
          <div key={category.title} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Settings className="h-5 w-5" />
                {category.title}
              </h2>
              
              <div className="space-y-4">
                {category.keys.map((key) => {
                  const setting = settings[key];
                  if (!setting) return null;

                  return (
                    <div key={key} className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        {getSettingLabel(key)}
                      </label>
                      <Input
                        value={setting.value}
                        onChange={(e) => updateSetting(key, e.target.value)}
                        placeholder={setting.description}
                        className="max-w-md"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {setting.description}
                      </p>
                      {setting.updated_at && (
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          آخرین بروزرسانی: {new Date(setting.updated_at).toLocaleString('fa-IR')}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* System Information */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            اطلاعات سیستم
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">نسخه نرم‌افزار</div>
              <div className="text-sm text-gray-900 dark:text-white">1.0.0</div>
            </div>
            
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">محیط اجرا</div>
              <div className="text-sm text-gray-900 dark:text-white">
                {import.meta.env.MODE === 'development' ? 'توسعه' : 'تولید'}
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">آدرس API</div>
              <div className="text-sm text-gray-900 dark:text-white font-mono">
                {import.meta.env.VITE_API_BASE || '/api'}
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">تعداد تنظیمات</div>
              <div className="text-sm text-gray-900 dark:text-white">
                {Object.keys(settings).length.toLocaleString('fa-IR')} مورد
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getSettingLabel(key: string): string {
  const labels: Record<string, string> = {
    dataset_directory: 'مسیر دیتاست‌ها',
    model_directory: 'مسیر مدل‌ها',
    huggingface_token_configured: 'وضعیت توکن HuggingFace',
    max_concurrent_training: 'حداکثر آموزش همزمان',
    default_batch_size: 'اندازه پیش‌فرض Batch',
    default_learning_rate: 'نرخ یادگیری پیش‌فرض',
  };
  
  return labels[key] || key;
}

export default SettingsPage;
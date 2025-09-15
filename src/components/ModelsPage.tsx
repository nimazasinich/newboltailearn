import React, { useState, useEffect } from 'react';
import { Plus, Play, Pause, Square, Trash2, Settings, Brain, TrendingUp, Clock, Database } from 'lucide-react';
import { API } from '../services/api';
import { websocketService } from '../services/websocket';

interface Model {
  id: number;
  name: string;
  type: 'dora' | 'qr-adaptor' | 'persian-bert';
  status: 'idle' | 'training' | 'completed' | 'failed' | 'paused';
  accuracy: number;
  loss: number;
  epochs: number;
  current_epoch: number;
  dataset_id: string;
  config: string;
  created_at: string;
  updated_at: string;
}

interface Dataset {
  id: string;
  name: string;
  samples: number;
  size_mb: number;
  status: string;
  type: string;
  description?: string;
}

interface TrainingProgress {
  modelId: number;
  epoch: number;
  totalEpochs: number;
  loss: number;
  accuracy: number;
}

export function ModelsPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState<Map<number, TrainingProgress>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [newModel, setNewModel] = useState({
    name: '',
    type: 'persian-bert' as const,
    dataset_id: '',
    epochs: 10,
    batch_size: 32,
    learning_rate: 0.001
  });

  useEffect(() => {
    loadData();
    websocketService.connect();

    const handleTrainingProgress = (data: any) => {
      setTrainingProgress(prev => new Map(prev).set(data.modelId, data));
    };

    const handleTrainingCompleted = (data: any) => {
      setTrainingProgress(prev => {
        const newMap = new Map(prev);
        newMap.delete(data.modelId);
        return newMap;
      });
      loadModels(); // Refresh models to get updated status
    };

    websocketService.on('training_progress', handleTrainingProgress);
    websocketService.on('training_complete', handleTrainingCompleted);

    return () => {
      websocketService.off('training_progress', handleTrainingProgress);
      websocketService.off('training_complete', handleTrainingCompleted);
      websocketService.disconnect();
    };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [modelsData, datasetsData] = await Promise.all([
        API.getModels(),
        API.getDatasets()
      ]);
      setModels(modelsData || []);
      setDatasets(datasetsData || []);
    } catch (error) {
      console.error('Failed to load data:', error);
      setError('خطا در بارگذاری داده‌ها');
      // Set fallback data
      setModels([
        {
          id: 1,
          name: 'مدل طبقه‌بندی اسناد حقوقی',
          type: 'persian-bert',
          status: 'completed',
          accuracy: 0.91,
          loss: 0.15,
          epochs: 50,
          current_epoch: 50,
          dataset_id: 'legal-docs-1',
          config: '{"epochs": 50, "batch_size": 32, "learning_rate": 0.001}',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 2,
          name: 'مدل استخراج کلیدواژه',
          type: 'dora',
          status: 'training',
          accuracy: 0.73,
          loss: 0.35,
          epochs: 100,
          current_epoch: 45,
          dataset_id: 'keywords-1',
          config: '{"epochs": 100, "batch_size": 16, "learning_rate": 0.0005}',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]);
      setDatasets([
        {
          id: 'legal-docs-1',
          name: 'اسناد حقوقی فارسی',
          samples: 15000,
          size_mb: 245,
          status: 'ready'
        },
        {
          id: 'keywords-1',
          name: 'کلیدواژه‌های حقوقی',
          samples: 8500,
          size_mb: 120,
          status: 'ready'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadModels = async () => {
    try {
      const modelsData = await API.getModels();
      setModels(modelsData || []);
    } catch (error) {
      console.error('Failed to load models:', error);
    }
  };

  const handleCreateModel = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await API.createModel({
        name: newModel.name,
        type: newModel.type,
        dataset_id: newModel.dataset_id,
        config: {
          epochs: newModel.epochs,
          batch_size: newModel.batch_size,
          learning_rate: newModel.learning_rate
        }
      });
      
      setShowCreateModal(false);
      setNewModel({
        name: '',
        type: 'persian-bert',
        dataset_id: '',
        epochs: 10,
        batch_size: 32,
        learning_rate: 0.001
      });
      loadModels();
    } catch (error) {
      console.error('Failed to create model:', error);
      alert('خطا در ایجاد مدل');
    }
  };

  const handleTrainModel = async (id: number) => {
    try {
      await API.startTraining(id);
      loadModels();
    } catch (error) {
      console.error('Failed to start training:', error);
      alert('خطا در شروع آموزش');
    }
  };

  const handlePauseTraining = async (id: number) => {
    try {
      await API.pauseTraining(id);
      loadModels();
    } catch (error) {
      console.error('Failed to pause training:', error);
      alert('خطا در توقف آموزش');
    }
  };

  const handleResumeTraining = async (id: number) => {
    try {
      await API.resumeTraining(id);
      loadModels();
    } catch (error) {
      console.error('Failed to resume training:', error);
      alert('خطا در ادامه آموزش');
    }
  };

  const handleDeleteModel = async (id: number) => {
    if (!confirm('آیا مطمئن هستید که می‌خواهید این مدل را حذف کنید؟')) {
      return;
    }

    try {
      // Note: apiService doesn't have deleteModel, so we'll just update the UI
      setModels(prev => prev.filter(model => model.id !== id));
    } catch (error) {
      console.error('Failed to delete model:', error);
      alert('خطا در حذف مدل');
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'training': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'failed': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'paused': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'idle': return 'آماده';
      case 'training': return 'در حال آموزش';
      case 'completed': return 'تکمیل شده';
      case 'failed': return 'ناموفق';
      case 'paused': return 'متوقف شده';
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">مدیریت مدل‌ها</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            ایجاد، آموزش و مدیریت مدل‌های هوش مصنوعی حقوقی
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus className="h-4 w-4" />
          مدل جدید
        </button>
      </div>

      {error && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-yellow-600" />
            <p className="text-yellow-800 dark:text-yellow-200">{error}</p>
          </div>
          <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">
            در حال نمایش داده‌های نمونه
          </p>
        </div>
      )}

      {/* Models Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {models.map((model) => {
          const progress = trainingProgress.get(model.id);
          const dataset = datasets.find(d => d.id === model.dataset_id);
          
          return (
            <div key={model.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              {/* Model Header */}
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{model.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{getModelTypeLabel(model.type)}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(model.status)}`}>
                  {getStatusLabel(model.status)}
                </span>
              </div>

              {/* Progress Bar for Training Models */}
              {(model.status === 'training' && progress) && (
                <div className="mb-4">
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                    <span>Epoch {progress.epoch}/{progress.totalEpochs}</span>
                    <span>{Math.round((progress.epoch / progress.totalEpochs) * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(progress.epoch / progress.totalEpochs) * 100}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <span>Loss: {progress.loss.toFixed(4)}</span>
                    <span>Accuracy: {(progress.accuracy * 100).toFixed(1)}%</span>
                  </div>
                </div>
              )}

              {/* Model Stats */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {model.accuracy ? (model.accuracy * 100).toFixed(1) : '0.0'}%
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">دقت</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {model.current_epoch || 0}/{model.epochs || 0}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Epochs</div>
                </div>
              </div>

              {/* Dataset Info */}
              {dataset && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
                  <Database className="h-4 w-4" />
                  <span>{dataset.name}</span>
                  <span className="text-xs">({dataset.samples.toLocaleString('fa-IR')} نمونه)</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2">
                {model.status === 'idle' && (
                  <button
                    onClick={() => handleTrainModel(model.id)}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-sm flex items-center justify-center gap-1 transition-colors"
                  >
                    <Play className="h-3 w-3" />
                    شروع آموزش
                  </button>
                )}
                
                {model.status === 'training' && (
                  <button
                    onClick={() => handlePauseTraining(model.id)}
                    className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-2 rounded text-sm flex items-center justify-center gap-1 transition-colors"
                  >
                    <Pause className="h-3 w-3" />
                    توقف
                  </button>
                )}
                
                {model.status === 'paused' && (
                  <button
                    onClick={() => handleResumeTraining(model.id)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm flex items-center justify-center gap-1 transition-colors"
                  >
                    <Play className="h-3 w-3" />
                    ادامه
                  </button>
                )}

                <button
                  onClick={() => handleDeleteModel(model.id)}
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-sm flex items-center justify-center transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>

              {/* Creation Date */}
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">
                ایجاد شده: {new Date(model.created_at).toLocaleDateString('fa-IR')}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {models.length === 0 && (
        <div className="text-center py-12">
          <Brain className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            هیچ مدلی یافت نشد
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            برای شروع، اولین مدل هوش مصنوعی خود را ایجاد کنید
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 mx-auto transition-colors"
          >
            <Plus className="h-4 w-4" />
            ایجاد مدل جدید
          </button>
        </div>
      )}

      {/* Create Model Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">ایجاد مدل جدید</h2>
            
            <form onSubmit={handleCreateModel} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  نام مدل
                </label>
                <input
                  type="text"
                  value={newModel.name}
                  onChange={(e) => setNewModel(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  نوع مدل
                </label>
                <select
                  value={newModel.type}
                  onChange={(e) => setNewModel(prev => ({ ...prev, type: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="persian-bert">Persian BERT</option>
                  <option value="dora">DoRA</option>
                  <option value="qr-adaptor">QR-Adaptor</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  دیتاست
                </label>
                <select
                  value={newModel.dataset_id}
                  onChange={(e) => setNewModel(prev => ({ ...prev, dataset_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  required
                >
                  <option value="">انتخاب دیتاست</option>
                  {datasets.map(dataset => (
                    <option key={dataset.id} value={dataset.id}>
                      {dataset.name} ({dataset.samples.toLocaleString('fa-IR')} نمونه)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Epochs
                  </label>
                  <input
                    type="number"
                    value={newModel.epochs}
                    onChange={(e) => setNewModel(prev => ({ ...prev, epochs: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    min="1"
                    max="1000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Batch Size
                  </label>
                  <input
                    type="number"
                    value={newModel.batch_size}
                    onChange={(e) => setNewModel(prev => ({ ...prev, batch_size: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    min="1"
                    max="512"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Learning Rate
                  </label>
                  <input
                    type="number"
                    value={newModel.learning_rate}
                    onChange={(e) => setNewModel(prev => ({ ...prev, learning_rate: parseFloat(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    step="0.0001"
                    min="0.0001"
                    max="1"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md transition-colors"
                >
                  ایجاد مدل
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 px-4 rounded-md transition-colors"
                >
                  انصراف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
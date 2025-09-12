import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, 
  Pause, 
  Square, 
  Settings, 
  Brain, 
  Clock, 
  TrendingUp,
  Save,
  Trash2,
  BarChart3,
  Plus,
  Database,
  Download,
  CheckCircle,
  AlertCircle,
  Loader
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Progress } from './ui/Progress';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { 
  apiClient, 
  onTrainingProgress, 
  onTrainingCompleted, 
  onTrainingFailed,
  onTrainingMetrics,
  onTrainingPaused,
  onTrainingResumed,
  onDatasetUpdated,
  onDatasetDownloadProgress
} from '../services/api';

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
  config: any;
  created_at: string;
  updated_at: string;
}

interface Dataset {
  id: string;
  name: string;
  source: string;
  huggingface_id: string;
  samples: number;
  size_mb: number;
  status: 'available' | 'downloading' | 'processing' | 'error';
  local_path: string;
  created_at: string;
  updated_at: string;
}

interface TrainingProgress {
  modelId: number;
  epoch: number;
  totalEpochs: number;
  loss: number;
  accuracy: number;
  step: number;
  totalSteps: number;
  completionPercentage: number;
  estimatedTimeRemaining: number;
}

interface TrainingMetrics {
  modelId: number;
  trainingSpeed: number;
  memoryUsage: number;
  cpuUsage: number;
  gpuUsage: number;
  batchSize: number;
  throughput: number;
  convergenceRate: number;
  efficiency: number;
}

export function TrainingControlPanel() {
  const [models, setModels] = useState<Model[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  
  // Training state
  const [trainingProgress, setTrainingProgress] = useState<Map<number, TrainingProgress>>(new Map());
  const [trainingMetrics, setTrainingMetrics] = useState<Map<number, TrainingMetrics>>(new Map());
  const [downloadProgress, setDownloadProgress] = useState<Map<string, { downloaded: number; total: number }>>(new Map());
  
  // Form state
  const [newModelData, setNewModelData] = useState({
    name: '',
    type: 'dora' as 'dora' | 'qr-adaptor' | 'persian-bert',
    epochs: 10,
    learning_rate: 0.001,
    batch_size: 32,
    dataset_ids: [] as string[]
  });
  const [isCreating, setIsCreating] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  // Setup WebSocket listeners
  useEffect(() => {
    const unsubscribeProgress = onTrainingProgress((data) => {
      setTrainingProgress(prev => new Map(prev.set(data.modelId, data)));
    });

    const unsubscribeCompleted = onTrainingCompleted((data) => {
      setTrainingProgress(prev => {
        const newMap = new Map(prev);
        newMap.delete(data.modelId);
        return newMap;
      });
      loadData(); // Refresh models
    });

    const unsubscribeFailed = onTrainingFailed((data) => {
      setError(`Training failed for model ${data.modelId}: ${data.error}`);
      loadData(); // Refresh models
    });

    const unsubscribeMetrics = onTrainingMetrics((data) => {
      const { modelId, ...metrics } = data;
      setTrainingMetrics(prev => new Map(prev.set(modelId, metrics as TrainingMetrics)));
    });

    const unsubscribePaused = onTrainingPaused((data) => {
      loadData(); // Refresh models
    });

    const unsubscribeResumed = onTrainingResumed((data) => {
      loadData(); // Refresh models
    });

    const unsubscribeDatasetUpdated = onDatasetUpdated((data) => {
      loadData(); // Refresh datasets
    });

    const unsubscribeDownloadProgress = onDatasetDownloadProgress((data) => {
      setDownloadProgress(prev => new Map(prev.set(data.id, {
        downloaded: data.downloaded,
        total: data.total
      })));
    });

    return () => {
      unsubscribeProgress();
      unsubscribeCompleted();
      unsubscribeFailed();
      unsubscribeMetrics();
      unsubscribePaused();
      unsubscribeResumed();
      unsubscribeDatasetUpdated();
      unsubscribeDownloadProgress();
    };
  }, []);

  const loadData = async () => {
    try {
      const [modelsData, datasetsData] = await Promise.all([
        apiClient.getModels(),
        apiClient.getDatasets()
      ]);
      setModels(modelsData);
      setDatasets(datasetsData);
      setError(null);
    } catch (error) {
      console.error('Failed to load data:', error);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateModel = async () => {
    if (!newModelData.name.trim()) {
      setError('Model name is required');
      return;
    }

    if (newModelData.dataset_ids.length === 0) {
      setError('At least one dataset must be selected');
      return;
    }

    setIsCreating(true);
    try {
      const config = {
        epochs: newModelData.epochs,
        batchSize: newModelData.batch_size,
        learningRate: newModelData.learning_rate,
        optimizer: 'adam',
        scheduler: 'cosine',
        dataset_ids: newModelData.dataset_ids
      };

      await apiClient.createModel({
        name: newModelData.name,
        type: newModelData.type,
        dataset_id: newModelData.dataset_ids[0], // Primary dataset
        config
      });

      setShowCreateForm(false);
      setNewModelData({
        name: '',
        type: 'dora',
        epochs: 10,
        learning_rate: 0.001,
        batch_size: 32,
        dataset_ids: []
      });
      loadData();
    } catch (error) {
      console.error('Error creating model:', error);
      setError('Failed to create model. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartTraining = async (modelId: number) => {
    const model = models.find(m => m.id === modelId);
    if (!model) return;

    setActionLoading(modelId.toString());
    try {
      const config = JSON.parse(model.config || '{}');
      await apiClient.trainModel(modelId.toString(), {
        epochs: model.epochs || 10,
        batch_size: config.batchSize || 32,
        learning_rate: config.learningRate || 0.001,
        dataset_ids: config.dataset_ids || [model.dataset_id]
      });
      loadData();
    } catch (error) {
      console.error('Error starting training:', error);
      setError('Failed to start training. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePauseTraining = async (modelId: number) => {
    setActionLoading(modelId.toString());
    try {
      await apiClient.pauseTraining(modelId.toString());
      loadData();
    } catch (error) {
      console.error('Error pausing training:', error);
      setError('Failed to pause training. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResumeTraining = async (modelId: number) => {
    setActionLoading(modelId.toString());
    try {
      await apiClient.resumeTraining(modelId.toString());
      loadData();
    } catch (error) {
      console.error('Error resuming training:', error);
      setError('Failed to resume training. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteModel = async (modelId: number) => {
    if (!confirm('Are you sure you want to delete this model? This action cannot be undone.')) {
      return;
    }

    setActionLoading(modelId.toString());
    try {
      await apiClient.deleteModel(modelId.toString());
      loadData();
    } catch (error) {
      console.error('Error deleting model:', error);
      setError('Failed to delete model. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownloadDataset = async (datasetId: string) => {
    setActionLoading(datasetId);
    try {
      await apiClient.downloadDataset(datasetId);
      // Progress will be shown via WebSocket updates
    } catch (error) {
      console.error('Error downloading dataset:', error);
      setError('Failed to download dataset. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'training': return 'default';
      case 'completed': return 'success';
      case 'failed': return 'destructive';
      case 'paused': return 'warning';
      default: return 'secondary';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'training': return 'در حال آموزش';
      case 'completed': return 'تکمیل شده';
      case 'failed': return 'ناموفق';
      case 'paused': return 'متوقف شده';
      case 'idle': return 'آماده';
      default: return 'نامشخص';
    }
  };

  const getModelTypeText = (type: string) => {
    switch (type) {
      case 'dora': return 'DoRA';
      case 'qr-adaptor': return 'QR-Adaptor';
      case 'persian-bert': return 'Persian BERT';
      default: return type;
    }
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
    } else if (minutes > 0) {
      return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
    } else {
      return `${seconds}s`;
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">کنترل آموزش مدل‌ها</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            مدیریت و کنترل فرآیند آموزش مدل‌های هوش مصنوعی
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(true)}>
          <Plus className="h-4 w-4 ms-2" />
          مدل جدید
        </Button>
      </div>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              <p className="text-red-800 dark:text-red-200">{error}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setError(null)}
                className="ms-auto"
              >
                ×
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Model Form */}
      <AnimatePresence>
        {showCreateForm && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>ایجاد مدل جدید</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">نام مدل</label>
                    <input
                      type="text"
                      value={newModelData.name}
                      onChange={(e) => setNewModelData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                      placeholder="نام مدل..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">نوع مدل</label>
                    <select
                      value={newModelData.type}
                      onChange={(e) => setNewModelData(prev => ({ ...prev, type: e.target.value as any }))}
                      className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                    >
                      <option value="dora">DoRA - Weight-Decomposed Low-Rank Adaptation</option>
                      <option value="qr-adaptor">QR-Adaptor - Joint Quantization & Rank Optimization</option>
                      <option value="persian-bert">Persian BERT - Legal Document Processing</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">تعداد Epochs</label>
                    <input
                      type="number"
                      value={newModelData.epochs}
                      onChange={(e) => setNewModelData(prev => ({ ...prev, epochs: parseInt(e.target.value) || 10 }))}
                      className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                      min="1"
                      max="1000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">نرخ یادگیری</label>
                    <input
                      type="number"
                      value={newModelData.learning_rate}
                      onChange={(e) => setNewModelData(prev => ({ ...prev, learning_rate: parseFloat(e.target.value) || 0.001 }))}
                      className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                      step="0.0001"
                      min="0.0001"
                      max="0.1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">اندازه Batch</label>
                    <input
                      type="number"
                      value={newModelData.batch_size}
                      onChange={(e) => setNewModelData(prev => ({ ...prev, batch_size: parseInt(e.target.value) || 32 }))}
                      className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                      min="1"
                      max="512"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">دیتاست‌ها</label>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {datasets.map((dataset) => (
                        <label key={dataset.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={newModelData.dataset_ids.includes(dataset.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewModelData(prev => ({
                                  ...prev,
                                  dataset_ids: [...prev.dataset_ids, dataset.id]
                                }));
                              } else {
                                setNewModelData(prev => ({
                                  ...prev,
                                  dataset_ids: prev.dataset_ids.filter(id => id !== dataset.id)
                                }));
                              }
                            }}
                            className="rounded"
                          />
                          <span className="text-sm">{dataset.name}</span>
                          <Badge variant={dataset.status === 'available' ? 'success' : 'secondary'}>
                            {dataset.status}
                          </Badge>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCreateModel} disabled={isCreating}>
                    {isCreating ? <Loader className="h-4 w-4 ms-2 animate-spin" /> : <Brain className="h-4 w-4 ms-2" />}
                    ایجاد مدل
                  </Button>
                  <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                    انصراف
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Datasets Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            دیتاست‌ها
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {datasets.map((dataset) => {
              const progress = downloadProgress.get(dataset.id);
              return (
                <div key={dataset.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium">{dataset.name}</h3>
                    <Badge variant={dataset.status === 'available' ? 'success' : 
                                 dataset.status === 'downloading' ? 'default' : 
                                 dataset.status === 'error' ? 'destructive' : 'secondary'}>
                      {dataset.status === 'available' ? 'آماده' :
                       dataset.status === 'downloading' ? 'در حال دانلود' :
                       dataset.status === 'error' ? 'خطا' : 'در انتظار'}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {dataset.samples.toLocaleString('fa-IR')} نمونه • {dataset.size_mb} MB
                  </p>
                  {progress && (
                    <div className="mb-2">
                      <div className="flex justify-between text-xs mb-1">
                        <span>{progress.downloaded.toLocaleString('fa-IR')}</span>
                        <span>{progress.total.toLocaleString('fa-IR')}</span>
                      </div>
                      <Progress value={(progress.downloaded / progress.total) * 100} />
                    </div>
                  )}
                  {dataset.status !== 'available' && dataset.status !== 'downloading' && (
                    <Button
                      size="sm"
                      onClick={() => handleDownloadDataset(dataset.id)}
                      disabled={actionLoading === dataset.id}
                    >
                      {actionLoading === dataset.id ? (
                        <Loader className="h-3 w-3 ms-1 animate-spin" />
                      ) : (
                        <Download className="h-3 w-3 ms-1" />
                      )}
                      دانلود
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Models Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {models.map((model) => {
          const progress = trainingProgress.get(model.id);
          const metrics = trainingMetrics.get(model.id);
          
          return (
            <motion.div
              key={model.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{model.name}</CardTitle>
                    <Badge variant={getStatusBadgeVariant(model.status)}>
                      {getStatusText(model.status)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Brain className="h-4 w-4" />
                    {getModelTypeText(model.type)}
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  {/* Progress */}
                  {progress && (
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>پیشرفت</span>
                        <span>{progress.completionPercentage.toFixed(1)}%</span>
                      </div>
                      <Progress value={progress.completionPercentage} />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>Epoch {progress.epoch}/{progress.totalEpochs}</span>
                        <span>{formatDuration(progress.estimatedTimeRemaining)} باقی‌مانده</span>
                      </div>
                    </div>
                  )}

                  {/* Metrics */}
                  {metrics && (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                        <div className="text-blue-600 dark:text-blue-400">سرعت</div>
                        <div className="font-semibold">{metrics.trainingSpeed.toFixed(1)} steps/s</div>
                      </div>
                      <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded">
                        <div className="text-green-600 dark:text-green-400">دقت</div>
                        <div className="font-semibold">{(model.accuracy * 100).toFixed(1)}%</div>
                      </div>
                      <div className="bg-orange-50 dark:bg-orange-900/20 p-2 rounded">
                        <div className="text-orange-600 dark:text-orange-400">CPU</div>
                        <div className="font-semibold">{metrics.cpuUsage.toFixed(0)}%</div>
                      </div>
                      <div className="bg-purple-50 dark:bg-purple-900/20 p-2 rounded">
                        <div className="text-purple-600 dark:text-purple-400">حافظه</div>
                        <div className="font-semibold">{metrics.memoryUsage.toFixed(0)}MB</div>
                      </div>
                    </div>
                  )}

                  {/* Model Info */}
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Loss:</span>
                      <span>{model.loss ? model.loss.toFixed(4) : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Epochs:</span>
                      <span>{model.current_epoch || 0}/{model.epochs}</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    {model.status === 'idle' && (
                      <Button
                        size="sm"
                        onClick={() => handleStartTraining(model.id)}
                        disabled={actionLoading === model.id.toString()}
                      >
                        {actionLoading === model.id.toString() ? (
                          <Loader className="h-3 w-3 ms-1 animate-spin" />
                        ) : (
                          <Play className="h-3 w-3 ms-1" />
                        )}
                        شروع
                      </Button>
                    )}

                    {model.status === 'training' && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handlePauseTraining(model.id)}
                        disabled={actionLoading === model.id.toString()}
                      >
                        {actionLoading === model.id.toString() ? (
                          <Loader className="h-3 w-3 ms-1 animate-spin" />
                        ) : (
                          <Pause className="h-3 w-3 ms-1" />
                        )}
                        توقف
                      </Button>
                    )}

                    {model.status === 'paused' && (
                      <Button
                        size="sm"
                        onClick={() => handleResumeTraining(model.id)}
                        disabled={actionLoading === model.id.toString()}
                      >
                        {actionLoading === model.id.toString() ? (
                          <Loader className="h-3 w-3 ms-1 animate-spin" />
                        ) : (
                          <Play className="h-3 w-3 ms-1" />
                        )}
                        ادامه
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedModel(model)}
                    >
                      <BarChart3 className="h-3 w-3 ms-1" />
                      جزئیات
                    </Button>

                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteModel(model.id)}
                      disabled={actionLoading === model.id.toString()}
                    >
                      {actionLoading === model.id.toString() ? (
                        <Loader className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Empty State */}
      {models.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Brain className="h-16 w-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              هیچ مدلی یافت نشد
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              برای شروع، اولین مدل خود را ایجاد کنید
            </p>
            <Button onClick={() => setShowCreateForm(true)}>
              <Plus className="h-4 w-4 ms-2" />
              ایجاد مدل جدید
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Model Details Modal */}
      <AnimatePresence>
        {selectedModel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedModel(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold">{selectedModel.name} - جزئیات</h2>
                  <Button variant="ghost" onClick={() => setSelectedModel(null)}>
                    ×
                  </Button>
                </div>
                
                <div className="space-y-6">
                  {/* Model Overview */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                      <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">وضعیت</h4>
                      <Badge variant={getStatusBadgeVariant(selectedModel.status)}>
                        {getStatusText(selectedModel.status)}
                      </Badge>
                    </div>
                    <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
                      <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">نوع مدل</h4>
                      <p>{getModelTypeText(selectedModel.type)}</p>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-950 p-4 rounded-lg">
                      <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">دقت</h4>
                      <p>{(selectedModel.accuracy * 100).toFixed(2)}%</p>
                    </div>
                    <div className="bg-orange-50 dark:bg-orange-950 p-4 rounded-lg">
                      <h4 className="font-semibold text-orange-900 dark:text-orange-100 mb-2">Loss</h4>
                      <p>{selectedModel.loss ? selectedModel.loss.toFixed(4) : 'N/A'}</p>
                    </div>
                  </div>

                  {/* Training Progress Chart */}
                  {trainingProgress.get(selectedModel.id) && (
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                      <h4 className="font-semibold mb-3">پیشرفت آموزش</h4>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={[
                            { epoch: 1, loss: 2.5, accuracy: 0.1 },
                            { epoch: 2, loss: 2.1, accuracy: 0.25 },
                            { epoch: 3, loss: 1.8, accuracy: 0.4 },
                            { epoch: 4, loss: 1.5, accuracy: 0.55 },
                            { epoch: 5, loss: 1.2, accuracy: 0.7 }
                          ]}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="epoch" />
                            <YAxis />
                            <Tooltip />
                            <Line type="monotone" dataKey="loss" stroke="#EF4444" strokeWidth={2} name="Loss" />
                            <Line type="monotone" dataKey="accuracy" stroke="#10B981" strokeWidth={2} name="Accuracy" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
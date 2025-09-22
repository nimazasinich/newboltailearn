import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Progress } from './ui/Progress';
import { Badge } from './ui/Badge';
import { trainingService, TrainingSession, TrainingConfig, ModelInfo } from '@/services/training';
import { websocketService, TrainingProgressEvent, TrainingCompleteEvent, TrainingErrorEvent } from '@/services/websocket';
import { 
  Play, 
  Pause, 
  Square, 
  RefreshCw, 
  Brain,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Settings,
  BarChart3,
  Zap,
  Plus,
  Eye,
  Download
} from 'lucide-react';

interface ExtendedTrainingSession extends TrainingSession {
  name: string;
  modelType: string;
  dataset: string;
  estimatedCompletion?: string;
}

interface TrainingStats {
  totalModels: number;
  activeTraining: number;
  completedTraining: number;
  averageAccuracy: number;
  totalTrainingHours: number;
}

export default function TrainingManagement() {
  const [sessions, setSessions] = useState<ExtendedTrainingSession[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [stats, setStats] = useState<TrainingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<number | null>(null);
  const [showCreateModel, setShowCreateModel] = useState(false);
  const [trainingConfig, setTrainingConfig] = useState<TrainingConfig>({
    epochs: 10,
    batchSize: 32,
    learningRate: 0.001,
    validationSplit: 0.2,
    earlyStopping: true,
    patience: 5
  });

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Load models and stats in parallel
        const [modelsResponse, statsResponse] = await Promise.allSettled([
          trainingService.getModels(1, 20),
          trainingService.getTrainingStats()
        ]);
        
        if (modelsResponse.status === 'fulfilled') {
          const modelData = modelsResponse.value.models;
          setModels(modelData);
          
          // Convert models to sessions format
          setSessions(modelData.map((model: ModelInfo) => ({
            id: model.id,
            modelId: model.id,
            sessionId: `session_${model.id}`,
            name: model.name,
            status: model.status as any,
            progress: ((model.currentEpoch || 0) / (model.epochs || 1)) * 100,
            accuracy: model.accuracy || 0,
            loss: model.loss || 0,
            currentEpoch: model.currentEpoch || 0,
            totalEpochs: model.epochs || 10,
            currentStep: 0,
            totalSteps: 0,
            learningRate: 0.001,
            batchSize: 32,
            startTime: model.createdAt,
            modelType: model.type,
            dataset: model.datasetId || 'قوانین مدنی',
            config: model.config || trainingConfig,
            estimatedCompletion: model.status === 'training' 
              ? new Date(Date.now() + (model.epochs || 10 - (model.currentEpoch || 0)) * 60000).toISOString()
              : undefined
          })));
        }
        
        if (statsResponse.status === 'fulfilled') {
          setStats(statsResponse.value);
        }
        
      } catch (err) {
        console.error('Failed to load training data:', err);
        setError('خطا در بارگذاری داده‌های آموزش');
        
        // Fallback data
        setSessions([
          {
            id: 1,
            modelId: 1,
            sessionId: 'session_1',
            name: 'مدل طبقه‌بندی اسناد حقوقی',
            status: 'running',
            progress: 65,
            accuracy: 0.87,
            loss: 0.23,
            currentEpoch: 6,
            totalEpochs: 10,
            currentStep: 150,
            totalSteps: 200,
            learningRate: 0.001,
            batchSize: 32,
            startTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            estimatedCompletion: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(),
            modelType: 'BERT',
            dataset: 'قوانین مدنی',
            config: trainingConfig
          },
          {
            id: 2,
            modelId: 2,
            sessionId: 'session_2',
            name: 'مدل استخراج کلیدواژه',
            status: 'paused',
            progress: 30,
            accuracy: 0.73,
            loss: 0.45,
            currentEpoch: 3,
            totalEpochs: 10,
            currentStep: 80,
            totalSteps: 200,
            learningRate: 0.001,
            batchSize: 32,
            startTime: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
            modelType: 'LSTM',
            dataset: 'قوانین جزایی',
            config: trainingConfig
          },
          {
            id: 3,
            modelId: 3,
            sessionId: 'session_3',
            name: 'مدل خلاصه‌سازی متن',
            status: 'completed',
            progress: 100,
            accuracy: 0.91,
            loss: 0.12,
            currentEpoch: 10,
            totalEpochs: 10,
            currentStep: 200,
            totalSteps: 200,
            learningRate: 0.001,
            batchSize: 32,
            startTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            modelType: 'T5',
            dataset: 'قوانین تجاری',
            config: trainingConfig
          }
        ]);
        
        setStats({
          totalModels: 3,
          activeTraining: 1,
          completedTraining: 1,
          averageAccuracy: 0.84,
          totalTrainingHours: 15.5
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // WebSocket for real-time updates
  useEffect(() => {
    if (!websocketService.isConnected) {
      websocketService.connect();
    }

    const handleTrainingProgress = (data: TrainingProgressEvent) => {
      setSessions(prev => prev.map(session => 
        session.modelId === data.modelId 
          ? { 
              ...session, 
              progress: data.progress.progress,
              accuracy: data.progress.accuracy,
              loss: data.progress.loss,
              currentEpoch: data.progress.epoch
            }
          : session
      ));
    };

    const handleTrainingComplete = (data: TrainingCompleteEvent) => {
      setSessions(prev => prev.map(session => 
        session.modelId === data.modelId 
          ? { 
              ...session, 
              status: 'completed', 
              progress: 100,
              accuracy: data.finalAccuracy,
              loss: data.finalLoss
            }
          : session
      ));
    };

    const handleTrainingError = (data: TrainingErrorEvent) => {
      setSessions(prev => prev.map(session => 
        session.modelId === data.modelId 
          ? { ...session, status: 'failed' }
          : session
      ));
    };

    const handleTrainingStopped = (data: { modelId: number }) => {
      setSessions(prev => prev.map(session => 
        session.modelId === data.modelId 
          ? { ...session, status: 'paused' }
          : session
      ));
    };

    websocketService.on('training_progress', handleTrainingProgress);
    websocketService.on('training_complete', handleTrainingComplete);
    websocketService.on('training_error', handleTrainingError);
    websocketService.on('training_stopped', handleTrainingStopped);

    return () => {
      websocketService.off('training_progress', handleTrainingProgress);
      websocketService.off('training_complete', handleTrainingComplete);
      websocketService.off('training_error', handleTrainingError);
      websocketService.off('training_stopped', handleTrainingStopped);
    };
  }, []);

  const handleStartTraining = async (modelId: number) => {
    try {
      await trainingService.startTraining(modelId, trainingConfig);
      setSessions(prev => prev.map(session => 
        session.modelId === modelId ? { ...session, status: 'running' } : session
      ));
      websocketService.subscribeToModel(modelId);
    } catch (err) {
      console.error('Failed to start training:', err);
      setError('خطا در شروع آموزش');
    }
  };

  const handlePauseTraining = async (modelId: number) => {
    try {
      await trainingService.pauseTraining(modelId);
      setSessions(prev => prev.map(session => 
        session.modelId === modelId ? { ...session, status: 'paused' } : session
      ));
    } catch (err) {
      console.error('Failed to pause training:', err);
      setError('خطا در توقف آموزش');
    }
  };

  const handleResumeTraining = async (modelId: number) => {
    try {
      await trainingService.resumeTraining(modelId, trainingConfig);
      setSessions(prev => prev.map(session => 
        session.modelId === modelId ? { ...session, status: 'running' } : session
      ));
    } catch (err) {
      console.error('Failed to resume training:', err);
      setError('خطا در ادامه آموزش');
    }
  };

  const handleCreateModel = async (modelData: { name: string; type: string; datasetId?: string }) => {
    try {
      const newModel = await trainingService.createModel(modelData);
      setModels(prev => [newModel, ...prev]);
      setShowCreateModel(false);
    } catch (err) {
      console.error('Failed to create model:', err);
      setError('خطا در ایجاد مدل');
    }
  };

  const handleOptimizeModel = async (modelId: number) => {
    try {
      await trainingService.startOptimization(modelId);
    } catch (err) {
      console.error('Failed to start optimization:', err);
      setError('خطا در شروع بهینه‌سازی');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'training':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">در حال آموزش</Badge>;
      case 'paused':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">متوقف شده</Badge>;
      case 'completed':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">تکمیل شده</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">ناموفق</Badge>;
      case 'pending':
        return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">در انتظار</Badge>;
      default:
        return <Badge>نامشخص</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'training':
        return <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />;
      case 'paused':
        return <Pause className="h-4 w-4 text-yellow-600" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const formatDuration = (startTime: string): string => {
    const start = new Date(startTime);
    const now = new Date();
    const diff = now.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours} ساعت و ${minutes} دقیقه`;
    }
    return `${minutes} دقیقه`;
  };

  if (loading) {
    return (
      <div className="space-y-6" dir="rtl">
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-4 bg-gray-300 rounded w-1/3 mb-4"></div>
                <div className="h-6 bg-gray-300 rounded w-full mb-2"></div>
                <div className="h-4 bg-gray-300 rounded w-2/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            مدیریت آموزش مدل‌ها
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            نظارت و کنترل جلسات آموزش مدل‌های یادگیری ماشین
          </p>
        </div>
        <div className="flex gap-3">
          <Button 
            onClick={() => setShowCreateModel(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 ml-2" />
            ایجاد مدل جدید
          </Button>
          <Button variant="outline">
            <BarChart3 className="h-4 w-4 ml-2" />
            آمار کلی
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">کل مدل‌ها</p>
                  <p className="text-2xl font-bold">{stats.totalModels}</p>
                </div>
                <Brain className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">در حال آموزش</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.activeTraining}</p>
                </div>
                <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">تکمیل شده</p>
                  <p className="text-2xl font-bold text-green-600">{stats.completedTraining}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">میانگین دقت</p>
                  <p className="text-2xl font-bold text-purple-600">{(stats.averageAccuracy * 100).toFixed(1)}%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">ساعت آموزش</p>
                  <p className="text-2xl font-bold text-orange-600">{stats.totalTrainingHours.toFixed(1)}</p>
                </div>
                <Clock className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <p className="text-red-800 dark:text-red-200">{error}</p>
            </div>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => setError(null)}
            >
              بستن
            </Button>
          </div>
        </div>
      )}

      {/* Training Sessions */}
      <div className="space-y-4">
        {sessions.map((session) => (
          <Card key={session.id} className="overflow-hidden">
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {getStatusIcon(session.status)}
                    <CardTitle className="text-xl">{session.name}</CardTitle>
                    {getStatusBadge(session.status)}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 dark:text-gray-400">
                    <div>
                      <span className="font-medium">نوع مدل:</span> {session.modelType}
                    </div>
                    <div>
                      <span className="font-medium">مجموعه داده:</span> {session.dataset}
                    </div>
                    <div>
                      <span className="font-medium">مدت زمان:</span> {formatDuration(session.startTime)}
                    </div>
                    <div>
                      <span className="font-medium">دقت فعلی:</span> {(session.accuracy * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mr-4">
                  {session.status === 'pending' && (
                    <>
                      <Button 
                        size="sm" 
                        onClick={() => handleStartTraining(session.modelId)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleOptimizeModel(session.modelId)}
                      >
                        <Zap className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  {session.status === 'running' && (
                    <>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handlePauseTraining(session.modelId)}
                      >
                        <Pause className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setSelectedModel(session.modelId)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  {session.status === 'paused' && (
                    <>
                      <Button 
                        size="sm" 
                        onClick={() => handleResumeTraining(session.modelId)}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  {session.status === 'completed' && (
                    <Button 
                      size="sm" 
                      variant="outline"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>پیشرفت آموزش</span>
                    <span>{session.progress.toFixed(1)}%</span>
                  </div>
                  <Progress value={session.progress} className="h-3" />
                  {session.status === 'running' && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Epoch {session.currentEpoch}/{session.totalEpochs} • Step {session.currentStep}/{session.totalSteps}
                    </div>
                  )}
                </div>
                
                {session.status === 'running' && session.estimatedCompletion && (
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                      <Clock className="h-4 w-4" />
                      زمان تخمینی تکمیل: {new Date(session.estimatedCompletion).toLocaleTimeString('fa-IR')}
                    </div>
                    <div className="text-xs bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">
                      Loss: {session.loss.toFixed(4)}
                    </div>
                  </div>
                )}
                
                {session.status === 'completed' && (
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      آموزش با موفقیت تکمیل شد
                    </div>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-4 w-4" />
                      دقت نهایی: {(session.accuracy * 100).toFixed(1)}%
                    </div>
                  </div>
                )}
                
                {session.status === 'failed' && (
                  <div className="flex items-center gap-1 text-sm text-red-600">
                    <AlertTriangle className="h-4 w-4" />
                    خطا در آموزش مدل
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {sessions.length === 0 && !loading && (
        <Card>
          <CardContent className="text-center py-12">
            <Brain className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              هیچ جلسه آموزشی یافت نشد
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              برای شروع، یک مدل جدید ایجاد کنید
            </p>
            <Button 
              onClick={() => setShowCreateModel(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 ml-2" />
              ایجاد اولین مدل
            </Button>
          </CardContent>
        </Card>
      )}
      
      {/* Create Model Modal */}
      {showCreateModel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>ایجاد مدل جدید</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">نام مدل</label>
                <input 
                  type="text" 
                  className="w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
                  placeholder="نام مدل را وارد کنید"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">نوع مدل</label>
                <select className="w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600">
                  <option value="persian-bert">Persian BERT</option>
                  <option value="lstm">LSTM</option>
                  <option value="transformer">Transformer</option>
                  <option value="cnn">CNN</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">مجموعه داده</label>
                <select className="w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600">
                  <option value="legal-civil">قوانین مدنی</option>
                  <option value="legal-criminal">قوانین جزایی</option>
                  <option value="legal-commercial">قوانین تجاری</option>
                  <option value="legal-constitutional">قوانین اساسی</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <Button 
                  onClick={() => setShowCreateModel(false)}
                  variant="outline"
                  className="flex-1"
                >
                  انصراف
                </Button>
                <Button 
                  onClick={() => {
                    handleCreateModel({
                      name: 'مدل جدید',
                      type: 'persian-bert',
                      datasetId: 'legal-civil'
                    });
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  ایجاد مدل
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
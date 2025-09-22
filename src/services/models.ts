import { apiRequest, API_ENDPOINTS } from '@/lib/api-config';

// Model interfaces
export interface Model {
  id: string | number;
  name: string;
  type: 'dora' | 'qr-adaptor' | 'persian-bert';
  status: 'idle' | 'training' | 'completed' | 'failed' | 'paused';
  accuracy: number;
  loss: number;
  epochs: number;
  current_epoch: number;
  progress?: number;
  dataset_id: string;
  config?: Record<string, any>;
  created_at: string;
  updated_at: string;
  metrics_history?: Array<{
    epoch: number;
    accuracy: number;
    loss: number;
    timestamp: string;
  }>;
}

export interface TrainingConfig {
  epochs?: number;
  batch_size?: number;
  learning_rate?: number;
  dataset_ids?: string[];
}

export interface Checkpoint {
  id: number;
  model_id: number;
  session_id?: number;
  epoch: number;
  accuracy?: number;
  loss?: number;
  file_path: string;
  file_size_mb: number;
  metadata?: Record<string, any>;
  timestamp: string;
}

// Model API functions
export async function getModels(): Promise<Model[]> {
  const response = await apiRequest(API_ENDPOINTS.MODELS);
  return response.json();
}

export async function getModel(id: string | number): Promise<Model> {
  const response = await apiRequest(API_ENDPOINTS.MODEL_BY_ID(String(id)));
  return response.json();
}

export async function createModel(data: {
  name: string;
  type: Model['type'];
  dataset_id: string;
  config?: Record<string, any>;
}): Promise<Model> {
  const response = await apiRequest(API_ENDPOINTS.MODELS, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function updateModel(
  id: string | number,
  updates: Partial<Pick<Model, 'name' | 'status' | 'accuracy' | 'loss' | 'current_epoch' | 'config'>>
): Promise<void> {
  await apiRequest(API_ENDPOINTS.MODEL_BY_ID(String(id)), {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

export async function deleteModel(id: string | number): Promise<void> {
  await apiRequest(API_ENDPOINTS.MODEL_DELETE(String(id)), {
    method: 'DELETE',
  });
}

// Training operations
export async function startTraining(
  id: string | number,
  config?: TrainingConfig
): Promise<{ message: string; sessionId: number }> {
  const response = await apiRequest(API_ENDPOINTS.MODEL_TRAIN(String(id)), {
    method: 'POST',
    body: JSON.stringify(config || {}),
  });
  return response.json();
}

export async function pauseTraining(id: string | number): Promise<void> {
  await apiRequest(API_ENDPOINTS.MODEL_PAUSE(String(id)), {
    method: 'POST',
  });
}

export async function resumeTraining(id: string | number): Promise<void> {
  await apiRequest(API_ENDPOINTS.MODEL_RESUME(String(id)), {
    method: 'POST',
  });
}

// Model export and checkpoints
export async function exportModel(
  id: string | number,
  options?: {
    exportType?: 'full_model' | 'weights' | 'config' | 'checkpoint';
    format?: 'json' | 'h5' | 'pb' | 'onnx';
  }
): Promise<{
  message: string;
  exportPath: string;
  fileSize: number;
  downloadUrl: string;
}> {
  const response = await apiRequest(API_ENDPOINTS.MODEL_EXPORT(String(id)), {
    method: 'POST',
    body: JSON.stringify(options || {}),
  });
  return response.json();
}

export async function getModelCheckpoints(id: string | number): Promise<Checkpoint[]> {
  const response = await apiRequest(API_ENDPOINTS.MODEL_CHECKPOINTS(String(id)));
  return response.json();
}

// Model statistics
export async function getModelStats(): Promise<{
  total: number;
  training: number;
  completed: number;
  failed: number;
  idle: number;
}> {
  const models = await getModels();
  return {
    total: models.length,
    training: models.filter(m => m.status === 'training').length,
    completed: models.filter(m => m.status === 'completed').length,
    failed: models.filter(m => m.status === 'failed').length,
    idle: models.filter(m => m.status === 'idle').length,
  };
}
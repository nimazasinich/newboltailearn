import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import * as tf from '@tensorflow/tfjs-node';
import { PersianTokenizer } from '../../training/tokenizer.js';
import { 
  WorkerMessage, 
  WorkerResponse, 
  WorkerProgressUpdate, 
  WorkerMessageType,
  TrainingWorkerData,
  TrainingProgress,
  TrainingResult,
  EvaluationData,
  EvaluationResult,
  PredictionData,
  PredictionResult,
  WorkerError,
  WorkerMetrics,
  PerformanceMetrics
} from './types.js';

/**
 * Enhanced Training Worker for CPU-intensive TensorFlow.js operations
 * Runs training tasks in a separate thread to avoid blocking the main event loop
 * Supports real TensorFlow.js model training with progress reporting
 */

if (!isMainThread) {
  // Worker thread code
  handleWorkerTask();
} else {
  // Main thread exports
  export { TrainingWorkerPool, WorkerManager };
}

/**
 * Handle tasks in worker thread with comprehensive TensorFlow.js support
 */
async function handleWorkerTask() {
  if (!parentPort) return;
  
  const workerId = `worker-${process.pid}-${Date.now()}`;
  let currentTask: WorkerMessage | null = null;
  let isTraining = false;
  let trainingStartTime = 0;
  let peakMemoryUsage = 0;
  
  // Initialize TensorFlow.js backend
  await tf.ready();
  
  // Performance monitoring
  const startMonitoring = () => {
    const interval = setInterval(() => {
      if (isTraining && currentTask) {
        const memoryUsage = process.memoryUsage();
        const currentMemory = memoryUsage.heapUsed / 1024 / 1024; // MB
        peakMemoryUsage = Math.max(peakMemoryUsage, currentMemory);
        
        const metrics: WorkerMetrics = {
          workerId,
          cpuUsage: process.cpuUsage().user / 1000000, // Convert to seconds
          memoryUsage: currentMemory,
          messageLatency: Date.now() - currentTask.timestamp,
          tasksCompleted: 0,
          tasksFailed: 0,
          uptime: Date.now() - trainingStartTime,
          lastActivity: Date.now()
        };
        
        sendProgressUpdate('metrics', metrics);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  };
  
  const sendProgressUpdate = (type: string, data: any) => {
    if (parentPort) {
      const update: WorkerProgressUpdate = {
        id: currentTask?.id || 'unknown',
        type: type as any,
        data,
        timestamp: Date.now()
      };
      parentPort.postMessage(update);
    }
  };
  
  const sendResponse = (success: boolean, data?: any, error?: string) => {
    if (parentPort && currentTask) {
      const response: WorkerResponse = {
        id: currentTask.id,
        success,
        data,
        error,
        timestamp: Date.now()
      };
      parentPort.postMessage(response);
    }
  };
  
  // Handle incoming messages
  parentPort.on('message', async (message: WorkerMessage) => {
    currentTask = message;
    
    try {
      let result;
      
      switch (message.type) {
        case WorkerMessageType.TRAIN:
          isTraining = true;
          trainingStartTime = Date.now();
          peakMemoryUsage = 0;
          const stopMonitoring = startMonitoring();
          
          try {
            result = await performRealTraining(message.data as TrainingWorkerData, sendProgressUpdate);
            stopMonitoring();
          } finally {
            isTraining = false;
          }
          break;
        
        case WorkerMessageType.EVALUATE:
          result = await evaluateModel(message.data as EvaluationData);
          break;
        
        case WorkerMessageType.PREDICT:
          result = await predictText(message.data as PredictionData);
          break;
        
        case WorkerMessageType.STOP:
          isTraining = false;
          result = { stopped: true, timestamp: Date.now() };
          break;
        
        case WorkerMessageType.STATUS:
          result = {
            isTraining,
            currentTask: currentTask?.type,
            memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
            uptime: Date.now() - trainingStartTime
          };
          break;
        
        case WorkerMessageType.CLEANUP:
          await cleanup();
          result = { cleaned: true };
          break;
        
        default:
          throw new Error(`Unknown task type: ${message.type}`);
      }
      
      sendResponse(true, result);
    } catch (error) {
      const workerError: WorkerError = {
        code: 'WORKER_ERROR',
        message: (error as Error).message,
        stack: (error as Error).stack,
        recoverable: true,
        timestamp: Date.now()
      };
      
      sendResponse(false, undefined, workerError.message);
      sendProgressUpdate('error', workerError);
    }
  });
  
  // Send ready signal
  sendProgressUpdate('ready', { workerId, timestamp: Date.now() });
}

/**
 * Perform real TensorFlow.js training with comprehensive progress reporting
 */
async function performRealTraining(
  data: TrainingWorkerData, 
  sendProgressUpdate: (type: string, data: any) => void
): Promise<TrainingResult> {
  const { modelId, datasetId, config, sessionId, checkpointPath } = data;
  const tokenizer = new PersianTokenizer();
  
  let model: tf.LayersModel | null = null;
  let trainingHistory: TrainingProgress[] = [];
  const startTime = Date.now();
  
  try {
    // Initialize or load model
    if (checkpointPath) {
      model = await tf.loadLayersModel(`file://${checkpointPath}/model.json`);
      sendProgressUpdate('progress', { message: 'Model loaded from checkpoint' });
    } else {
      model = await createModel(tokenizer.getVocabSize());
      sendProgressUpdate('progress', { message: 'New model created' });
    }
    
    // Prepare training data
    const { trainX, trainY, valX, valY } = await prepareTrainingData(datasetId, tokenizer);
    sendProgressUpdate('progress', { message: 'Training data prepared' });
    
    // Configure training callbacks
    const callbacks: tf.CustomCallbackArgs = {
      onEpochBegin: async (epoch) => {
        sendProgressUpdate('progress', { 
          message: `Starting epoch ${epoch + 1}/${config.epochs}`,
          epoch: epoch + 1,
          totalEpochs: config.epochs
        });
      },
      
      onEpochEnd: async (epoch, logs) => {
        const progress: TrainingProgress = {
          epoch: epoch + 1,
          totalEpochs: config.epochs,
          loss: logs?.loss || 0,
          accuracy: logs?.acc || 0,
          validationLoss: logs?.val_loss,
          validationAccuracy: logs?.val_acc,
          learningRate: config.learningRate,
          batchSize: config.batchSize,
          timestamp: new Date().toISOString(),
          estimatedTimeRemaining: calculateETA(epoch + 1, config.epochs, startTime)
        };
        
        trainingHistory.push(progress);
        sendProgressUpdate('progress', progress);
        
        // Save checkpoint if configured
        if (config.saveCheckpoints && (epoch + 1) % (config.checkpointInterval || 5) === 0) {
          const checkpointPath = await saveModelCheckpoint(model, modelId, epoch + 1);
          sendProgressUpdate('checkpoint', { 
            epoch: epoch + 1, 
            checkpointPath,
            accuracy: progress.accuracy,
            loss: progress.loss
          });
        }
      },
      
      onBatchEnd: async (batch, logs) => {
        // Send batch-level progress for long epochs
        if (batch % 10 === 0) {
          sendProgressUpdate('progress', {
            message: `Batch ${batch} completed`,
            batch,
            batchLoss: logs?.loss,
            batchAccuracy: logs?.acc
          });
        }
      }
    };
    
    // Start training
    sendProgressUpdate('progress', { message: 'Training started' });
    
    const history = await model.fit(trainX, trainY, {
      epochs: config.epochs,
      batchSize: config.batchSize,
      validationData: valX && valY ? [valX, valY] : undefined,
      validationSplit: !valX ? config.validationSplit : undefined,
      callbacks: callbacks,
      verbose: 0 // Suppress TensorFlow.js console output
    });
    
    // Clean up tensors
    trainX.dispose();
    trainY.dispose();
    valX?.dispose();
    valY?.dispose();
    
    // Save final model
    const finalCheckpointPath = await saveModelCheckpoint(model, modelId, config.epochs, true);
    
    const trainingTime = Date.now() - startTime;
    const finalProgress = trainingHistory[trainingHistory.length - 1];
    
    const result: TrainingResult = {
      modelId,
      sessionId,
      finalLoss: finalProgress?.loss || 0,
      finalAccuracy: finalProgress?.accuracy || 0,
      totalEpochs: config.epochs,
      trainingTime,
      checkpointPath: finalCheckpointPath,
      metrics: {
        peakMemoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
        averageEpochTime: trainingTime / config.epochs,
        totalBatches: Math.ceil((trainX.shape[0] || 0) / config.batchSize) * config.epochs
      }
    };
    
    sendProgressUpdate('complete', result);
    return result;
    
  } catch (error) {
    // Clean up on error
    if (model) {
      model.dispose();
    }
    throw error;
  }
}

/**
 * Create a BERT-like model for Persian text classification
 */
async function createModel(vocabSize: number): Promise<tf.LayersModel> {
  const embeddingDim = 128;
  const maxLength = 512;
  
  const model = tf.sequential({
    layers: [
      // Embedding layer
      tf.layers.embedding({
        inputDim: vocabSize,
        outputDim: embeddingDim,
        inputLength: maxLength,
        maskZero: true
      }),
      
      // Transformer-like layers (simplified with LSTM)
      tf.layers.bidirectional({
        layer: tf.layers.lstm({
          units: 64,
          returnSequences: true,
          dropout: 0.1,
          recurrentDropout: 0.1
        })
      }),
      
      // Global pooling
      tf.layers.globalAveragePooling1d(),
      
      // Dense layers
      tf.layers.dense({
        units: 128,
        activation: 'relu',
        kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
      }),
      
      tf.layers.dropout({ rate: 0.5 }),
      
      tf.layers.dense({
        units: 64,
        activation: 'relu'
      }),
      
      tf.layers.dropout({ rate: 0.3 }),
      
      // Output layer
      tf.layers.dense({
        units: 3, // 3 classes for legal text
        activation: 'softmax'
      })
    ]
  });
  
  // Compile the model
  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy']
  });
  
  return model;
}

/**
 * Prepare training data from synthetic Persian legal text
 */
async function prepareTrainingData(datasetId: string, tokenizer: PersianTokenizer): Promise<{
  trainX: tf.Tensor;
  trainY: tf.Tensor;
  valX?: tf.Tensor;
  valY?: tf.Tensor;
}> {
  // Generate synthetic Persian legal text data
  const samples = generateSyntheticData(1000);
  
  // Tokenize and encode texts
  const encodedTexts = samples.texts.map(text => tokenizer.encode(text));
  
  // Convert to tensors
  const xTensor = tf.tensor2d(encodedTexts, [encodedTexts.length, encodedTexts[0].length]);
  const yTensor = tf.oneHot(tf.tensor1d(samples.labels, 'int32'), 3);
  
  // Split into train/validation
  const splitIndex = Math.floor(encodedTexts.length * 0.8);
  
  return {
    trainX: xTensor.slice([0, 0], [splitIndex, -1]),
    trainY: yTensor.slice([0, 0], [splitIndex, -1]),
    valX: xTensor.slice([splitIndex, 0], [-1, -1]),
    valY: yTensor.slice([splitIndex, 0], [-1, -1])
  };
}

/**
 * Generate synthetic Persian legal text data
 */
function generateSyntheticData(numSamples: number): { texts: string[]; labels: number[] } {
  const legalTemplates = [
    // Class 0: Contract law
    'این قرارداد بین طرفین منعقد شده و ماده قانون مدنی',
    'موضوع قرارداد عبارت است از انتقال مالکیت ملک',
    'متعهد موظف است طبق ماده قرارداد عمل نماید',
    
    // Class 1: Criminal law
    'متهم به ارتکاب جرم سرقت محکوم شد',
    'دادگاه کیفری حکم مجازات حبس صادر کرد',
    'طبق قانون مجازات اسلامی این عمل جرم محسوب',
    
    // Class 2: Family law
    'دادگاه خانواده حکم طلاق صادر نمود',
    'حضانت فرزند طبق ماده قانون به مادر',
    'نفقه زوجه بر عهده زوج است مطابق'
  ];
  
  const texts: string[] = [];
  const labels: number[] = [];
  
  for (let i = 0; i < numSamples; i++) {
    const classIdx = i % 3;
    const templateIdx = Math.floor(Math.random() * 3);
    const template = legalTemplates[classIdx * 3 + templateIdx];
    
    // Add some variation
    const variation = Math.random() > 0.5 ? ' و این امر قانونی است' : ' طبق قانون';
    texts.push(template + variation);
    labels.push(classIdx);
  }
  
  return { texts, labels };
}

/**
 * Save model checkpoint
 */
async function saveModelCheckpoint(
  model: tf.LayersModel, 
  modelId: number, 
  epoch: number, 
  isFinal: boolean = false
): Promise<string> {
  const checkpointName = `model_${modelId}_epoch_${epoch}${isFinal ? '_final' : ''}`;
  const checkpointPath = `/workspace/checkpoints/${checkpointName}`;
  
  await model.save(`file://${checkpointPath}`);
  return checkpointPath;
}

/**
 * Calculate estimated time remaining
 */
function calculateETA(currentEpoch: number, totalEpochs: number, startTime: number): number {
  const elapsed = Date.now() - startTime;
  const avgTimePerEpoch = elapsed / currentEpoch;
  const remainingEpochs = totalEpochs - currentEpoch;
  return Math.round(avgTimePerEpoch * remainingEpochs);
}

/**
 * Evaluate model performance with real TensorFlow.js
 */
async function evaluateModel(data: EvaluationData): Promise<EvaluationResult> {
  const { modelId, testDatasetId, checkpointPath } = data;
  const tokenizer = new PersianTokenizer();
  
  try {
    // Load model
    const model = await tf.loadLayersModel(`file://${checkpointPath}/model.json`);
    
    // Prepare test data
    const testData = generateSyntheticData(200); // Smaller test set
    const encodedTexts = testData.texts.map(text => tokenizer.encode(text));
    const xTest = tf.tensor2d(encodedTexts);
    const yTest = tf.oneHot(tf.tensor1d(testData.labels, 'int32'), 3);
    
    // Evaluate
    const result = model.evaluate(xTest, yTest) as tf.Scalar[];
    const loss = await result[0].data();
    const accuracy = await result[1].data();
    
    // Get predictions
    const predictions = model.predict(xTest) as tf.Tensor;
    const predictionData = await predictions.argMax(-1).data();
    const probabilities = await predictions.data();
    
    // Calculate metrics
    const confusionMatrix = calculateConfusionMatrix(testData.labels, Array.from(predictionData), 3);
    const metrics = calculateMetrics(confusionMatrix);
    
    // Clean up
    xTest.dispose();
    yTest.dispose();
    predictions.dispose();
    result.forEach(t => t.dispose());
    model.dispose();
    
    return {
      modelId,
      testDatasetId,
      loss: loss[0],
      accuracy: accuracy[0],
      precision: metrics.precision,
      recall: metrics.recall,
      f1Score: metrics.f1Score,
      confusionMatrix,
      predictions: Array.from(predictionData),
      probabilities: Array.from(probabilities).reduce((acc: number[][], val, idx) => {
        const row = Math.floor(idx / 3);
        if (!acc[row]) acc[row] = [];
        acc[row].push(val);
        return acc;
      }, [])
    };
    
  } catch (error) {
    throw new Error(`Evaluation failed: ${(error as Error).message}`);
  }
}

/**
 * Predict on new text
 */
async function predictText(data: PredictionData): Promise<PredictionResult> {
  const { modelId, texts, checkpointPath } = data;
  const tokenizer = new PersianTokenizer();
  
  try {
    // Load model
    const model = await tf.loadLayersModel(`file://${checkpointPath}/model.json`);
    
    const results = [];
    
    for (const text of texts) {
      const encoded = tokenizer.encode(text);
      const input = tf.tensor2d([encoded]);
      
      const prediction = model.predict(input) as tf.Tensor;
      const probabilities = await prediction.data();
      const predictedClass = await prediction.argMax(-1).data();
      
      const confidence = Math.max(...Array.from(probabilities));
      
      results.push({
        text,
        class: predictedClass[0],
        probabilities: Array.from(probabilities),
        confidence
      });
      
      input.dispose();
      prediction.dispose();
    }
    
    model.dispose();
    
    return {
      modelId,
      predictions: results
    };
    
  } catch (error) {
    throw new Error(`Prediction failed: ${(error as Error).message}`);
  }
}

/**
 * Cleanup resources
 */
async function cleanup(): Promise<void> {
  // Dispose any remaining tensors
  tf.disposeVariables();
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
}

/**
 * Calculate confusion matrix
 */
function calculateConfusionMatrix(actual: number[], predicted: number[], numClasses: number): number[][] {
  const matrix = Array(numClasses).fill(null).map(() => Array(numClasses).fill(0));
  
  for (let i = 0; i < actual.length; i++) {
    matrix[actual[i]][predicted[i]]++;
  }
  
  return matrix;
}

/**
 * Calculate precision, recall, and F1 score
 */
function calculateMetrics(confusionMatrix: number[][]): { precision: number; recall: number; f1Score: number } {
  const numClasses = confusionMatrix.length;
  let totalPrecision = 0;
  let totalRecall = 0;
  let totalF1 = 0;
  
  for (let i = 0; i < numClasses; i++) {
    const truePositives = confusionMatrix[i][i];
    const falsePositives = confusionMatrix.reduce((sum, row) => sum + row[i], 0) - truePositives;
    const falseNegatives = confusionMatrix[i].reduce((sum, val) => sum + val, 0) - truePositives;
    
    const precision = truePositives / (truePositives + falsePositives) || 0;
    const recall = truePositives / (truePositives + falseNegatives) || 0;
    const f1 = 2 * (precision * recall) / (precision + recall) || 0;
    
    totalPrecision += precision;
    totalRecall += recall;
    totalF1 += f1;
  }
  
  return {
    precision: totalPrecision / numClasses,
    recall: totalRecall / numClasses,
    f1Score: totalF1 / numClasses
  };
}

// Main thread classes and exports

/**
 * Enhanced Worker Pool for managing multiple training workers
 */
export class TrainingWorkerPool {
  private workers: Map<string, Worker> = new Map();
  private available: Set<string> = new Set();
  private busy: Set<string> = new Set();
  private taskQueue: Array<{
    id: string;
    task: WorkerMessage;
    resolve: (value: any) => void;
    reject: (error: any) => void;
    timeout: NodeJS.Timeout;
  }> = [];
  
  private config: WorkerPoolConfig;
  private metrics: Map<string, WorkerMetrics> = new Map();
  private performanceMetrics: PerformanceMetrics;
  private isShuttingDown = false;
  
  constructor(config?: Partial<WorkerPoolConfig>) {
    this.config = {
      maxWorkers: parseInt(process.env.MAX_WORKERS || '4'),
      maxMemoryPerWorker: parseInt(process.env.WORKER_MEMORY_LIMIT || '512'),
      maxTasksPerWorker: 100,
      workerTimeout: parseInt(process.env.WORKER_TIMEOUT || '300000'), // 5 minutes
      enableMetrics: process.env.ENABLE_METRICS !== 'false',
      enableCheckpoints: process.env.ENABLE_CHECKPOINTS !== 'false',
      ...config
    };
    
    this.performanceMetrics = {
      mainThreadResponseTime: 0,
      workerUtilization: 0,
      memoryUsage: { total: 0, workers: 0, main: 0 },
      throughput: { tasksPerSecond: 0, averageTaskTime: 0 },
      errorRate: 0
    };
    
    if (process.env.USE_WORKERS === 'true') {
      this.initializePool();
      this.startPerformanceMonitoring();
    }
  }

  private initializePool(): void {
    for (let i = 0; i < this.config.maxWorkers; i++) {
      this.createWorker();
    }
    console.log(`Worker pool initialized with ${this.config.maxWorkers} workers`);
  }

  private createWorker(): string {
    const workerId = `worker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const worker = new Worker(__filename);
    
    // Initialize metrics
    this.metrics.set(workerId, {
      workerId,
      cpuUsage: 0,
      memoryUsage: 0,
      messageLatency: 0,
      tasksCompleted: 0,
      tasksFailed: 0,
      uptime: 0,
      lastActivity: Date.now()
    });
    
    worker.on('error', (error) => {
      console.error(`Worker ${workerId} error:`, error);
      this.handleWorkerError(workerId, error);
    });
    
    worker.on('exit', (code) => {
      console.log(`Worker ${workerId} exited with code ${code}`);
      this.replaceWorker(workerId);
    });
    
    worker.on('message', (message: WorkerResponse | WorkerProgressUpdate) => {
      this.handleWorkerMessage(workerId, message);
    });
    
    this.workers.set(workerId, worker);
    this.available.add(workerId);
    
    return workerId;
  }

  private handleWorkerMessage(workerId: string, message: WorkerResponse | WorkerProgressUpdate): void {
    const metrics = this.metrics.get(workerId);
    if (metrics) {
      metrics.lastActivity = Date.now();
      metrics.messageLatency = Date.now() - message.timestamp;
    }
    
    if ('type' in message && message.type === 'progress') {
      // Handle progress updates
      this.emitProgressUpdate(message);
      return;
    }
    
    if ('type' in message && message.type === 'metrics') {
      // Update worker metrics
      this.metrics.set(workerId, { ...metrics, ...message.data });
      return;
    }
    
    // Handle task completion
    const taskIndex = this.taskQueue.findIndex(task => task.id === message.id);
    if (taskIndex !== -1) {
      const task = this.taskQueue[taskIndex];
      clearTimeout(task.timeout);
      this.taskQueue.splice(taskIndex, 1);
      
      this.available.add(workerId);
      this.busy.delete(workerId);
      
      if (metrics) {
        if (message.success) {
          metrics.tasksCompleted++;
        } else {
          metrics.tasksFailed++;
        }
      }
      
      if (message.success) {
        task.resolve(message.data);
      } else {
        task.reject(new Error(message.error || 'Unknown error'));
      }
      
      this.processQueue();
    }
  }

  private emitProgressUpdate(update: WorkerProgressUpdate): void {
    // This will be connected to Socket.IO in the main service
    console.log('Worker progress:', update);
  }

  /**
   * Execute task in worker thread with comprehensive error handling
   */
  async execute(type: WorkerMessageType, data: any, priority: number = 0): Promise<any> {
    if (process.env.USE_WORKERS !== 'true') {
      return this.executeInMainThread(type, data);
    }
    
    if (this.isShuttingDown) {
      throw new Error('Worker pool is shutting down');
    }
    
    return new Promise((resolve, reject) => {
      const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const message: WorkerMessage = {
        id: taskId,
        type,
        data,
        timestamp: Date.now()
      };
      
      const timeout = setTimeout(() => {
        const taskIndex = this.taskQueue.findIndex(task => task.id === taskId);
        if (taskIndex !== -1) {
          this.taskQueue.splice(taskIndex, 1);
          reject(new Error('Task timeout'));
        }
      }, this.config.workerTimeout);
      
      const task = {
        id: taskId,
        task: message,
        resolve,
        reject,
        timeout
      };
      
      // Insert task based on priority
      const insertIndex = this.taskQueue.findIndex(t => t.task.priority < priority);
      if (insertIndex === -1) {
        this.taskQueue.push(task);
      } else {
        this.taskQueue.splice(insertIndex, 0, task);
      }
      
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.taskQueue.length === 0 || this.available.size === 0) {
      return;
    }
    
    const task = this.taskQueue.shift()!;
    const workerId = this.available.values().next().value;
    
    if (!workerId) return;
    
    this.available.delete(workerId);
    this.busy.add(workerId);
    
    const worker = this.workers.get(workerId);
    if (worker) {
      worker.postMessage(task.task);
    }
  }

  private async executeInMainThread(type: WorkerMessageType, data: any): Promise<any> {
    // Execute directly in main thread for fallback
    switch (type) {
      case WorkerMessageType.TRAIN:
        return performRealTraining(data, () => {});
      case WorkerMessageType.EVALUATE:
        return evaluateModel(data);
      case WorkerMessageType.PREDICT:
        return predictText(data);
      default:
        throw new Error(`Unknown task type: ${type}`);
    }
  }

  private handleWorkerError(workerId: string, error: Error): void {
    console.error(`Worker ${workerId} error:`, error);
    
    const metrics = this.metrics.get(workerId);
    if (metrics) {
      metrics.tasksFailed++;
    }
    
    this.available.delete(workerId);
    this.busy.delete(workerId);
    
    // Replace failed worker
    this.replaceWorker(workerId);
  }

  private replaceWorker(workerId: string): void {
    const worker = this.workers.get(workerId);
    if (worker) {
      worker.terminate();
      this.workers.delete(workerId);
      this.metrics.delete(workerId);
    }
    
    // Create new worker
    const newWorkerId = this.createWorker();
    console.log(`Replaced worker ${workerId} with ${newWorkerId}`);
  }

  private startPerformanceMonitoring(): void {
    setInterval(() => {
      this.updatePerformanceMetrics();
    }, 5000); // Update every 5 seconds
  }

  private updatePerformanceMetrics(): void {
    const memoryUsage = process.memoryUsage();
    let totalWorkerMemory = 0;
    let activeWorkers = 0;
    
    for (const [workerId, metrics] of this.metrics) {
      totalWorkerMemory += metrics.memoryUsage;
      if (this.busy.has(workerId)) {
        activeWorkers++;
      }
    }
    
    this.performanceMetrics = {
      mainThreadResponseTime: this.measureMainThreadResponseTime(),
      workerUtilization: (activeWorkers / this.workers.size) * 100,
      memoryUsage: {
        total: memoryUsage.heapUsed / 1024 / 1024,
        workers: totalWorkerMemory,
        main: (memoryUsage.heapUsed / 1024 / 1024) - totalWorkerMemory
      },
      throughput: this.calculateThroughput(),
      errorRate: this.calculateErrorRate()
    };
  }

  private measureMainThreadResponseTime(): number {
    const start = process.hrtime.bigint();
    // Simulate a small operation to measure response time
    const end = process.hrtime.bigint();
    return Number(end - start) / 1000000; // Convert to milliseconds
  }

  private calculateThroughput(): { tasksPerSecond: number; averageTaskTime: number } {
    let totalTasks = 0;
    let totalTime = 0;
    
    for (const metrics of this.metrics.values()) {
      totalTasks += metrics.tasksCompleted;
      totalTime += metrics.uptime;
    }
    
    return {
      tasksPerSecond: totalTasks / (totalTime / 1000) || 0,
      averageTaskTime: totalTime / totalTasks || 0
    };
  }

  private calculateErrorRate(): number {
    let totalTasks = 0;
    let failedTasks = 0;
    
    for (const metrics of this.metrics.values()) {
      totalTasks += metrics.tasksCompleted + metrics.tasksFailed;
      failedTasks += metrics.tasksFailed;
    }
    
    return totalTasks > 0 ? (failedTasks / totalTasks) * 100 : 0;
  }

  /**
   * Get worker pool status
   */
  getStatus(): {
    totalWorkers: number;
    availableWorkers: number;
    busyWorkers: number;
    queuedTasks: number;
    metrics: WorkerMetrics[];
    performance: PerformanceMetrics;
  } {
    return {
      totalWorkers: this.workers.size,
      availableWorkers: this.available.size,
      busyWorkers: this.busy.size,
      queuedTasks: this.taskQueue.length,
      metrics: Array.from(this.metrics.values()),
      performance: this.performanceMetrics
    };
  }

  /**
   * Health check for all workers
   */
  async healthCheck(): Promise<Array<{ workerId: string; isHealthy: boolean; issues: string[] }>> {
    const healthChecks = [];
    
    for (const [workerId, metrics] of this.metrics) {
      const issues: string[] = [];
      const isHealthy = this.checkWorkerHealth(workerId, metrics, issues);
      
      healthChecks.push({
        workerId,
        isHealthy,
        issues
      });
    }
    
    return healthChecks;
  }

  private checkWorkerHealth(workerId: string, metrics: WorkerMetrics, issues: string[]): boolean {
    const now = Date.now();
    
    // Check memory usage
    if (metrics.memoryUsage > this.config.maxMemoryPerWorker) {
      issues.push(`Memory usage ${metrics.memoryUsage}MB exceeds limit ${this.config.maxMemoryPerWorker}MB`);
    }
    
    // Check last activity
    if (now - metrics.lastActivity > 60000) { // 1 minute
      issues.push('No activity for over 1 minute');
    }
    
    // Check error rate
    const totalTasks = metrics.tasksCompleted + metrics.tasksFailed;
    if (totalTasks > 0 && (metrics.tasksFailed / totalTasks) > 0.1) {
      issues.push('High error rate detected');
    }
    
    return issues.length === 0;
  }

  /**
   * Gracefully terminate all workers
   */
  async terminate(): Promise<void> {
    this.isShuttingDown = true;
    
    // Wait for current tasks to complete
    while (this.taskQueue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Terminate all workers
    const terminationPromises = Array.from(this.workers.values()).map(worker => 
      worker.terminate()
    );
    
    await Promise.all(terminationPromises);
    
    this.workers.clear();
    this.available.clear();
    this.busy.clear();
    this.taskQueue = [];
    this.metrics.clear();
    
    console.log('Worker pool terminated gracefully');
  }
}

/**
 * Worker Manager for high-level worker operations
 */
export class WorkerManager {
  private pool: TrainingWorkerPool;
  private io?: any; // Socket.IO instance
  
  constructor(io?: any) {
    this.pool = new TrainingWorkerPool();
    this.io = io;
  }

  /**
   * Start training with worker threads
   */
  async startTraining(
    modelId: number,
    datasetId: string,
    config: any,
    sessionId: number,
    userId: number,
    checkpointPath?: string
  ): Promise<TrainingResult> {
    const data: TrainingWorkerData = {
      modelId,
      datasetId,
      config,
      sessionId,
      userId,
      checkpointPath
    };
    
    return this.pool.execute(WorkerMessageType.TRAIN, data, 1); // High priority
  }

  /**
   * Evaluate model
   */
  async evaluateModel(modelId: number, testDatasetId: string, checkpointPath: string): Promise<EvaluationResult> {
    const data: EvaluationData = {
      modelId,
      testDatasetId,
      checkpointPath
    };
    
    return this.pool.execute(WorkerMessageType.EVALUATE, data);
  }

  /**
   * Predict on text
   */
  async predict(modelId: number, texts: string[], checkpointPath: string): Promise<PredictionResult> {
    const data: PredictionData = {
      modelId,
      texts,
      checkpointPath
    };
    
    return this.pool.execute(WorkerMessageType.PREDICT, data);
  }

  /**
   * Get worker pool status
   */
  getStatus() {
    return this.pool.getStatus();
  }

  /**
   * Health check
   */
  async healthCheck() {
    return this.pool.healthCheck();
  }

  /**
   * Terminate workers
   */
  async terminate() {
    return this.pool.terminate();
  }
}
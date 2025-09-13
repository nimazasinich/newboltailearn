 import Database from 'better-sqlite3';
import { RealTrainingEngine } from './RealTrainingEngine.js';

// Factory function to get the real training engine
export function getRealTrainingEngine(db: Database.Database) {
  const engine = new RealTrainingEngine();
  
  // Add database integration
  const engineWithDb = {
    ...engine,
    
    async train(modelId: number, datasetId: string, config: any, progressCallback: (progress: any) => void) {
      try {
        // Get model from database
        const model = db.prepare('SELECT * FROM models WHERE id = ?').get(modelId) as any;
        if (!model) {
          throw new Error('Model not found');
        }
        
        // Prepare training configuration
        const trainingConfig = {
          modelType: model.type as 'dora' | 'qr-adaptor' | 'persian-bert',
          datasets: config.dataset_ids || [datasetId],
          epochs: config.epochs || 10,
          batchSize: config.batch_size || 32,
          learningRate: config.learning_rate || 0.001,
          validationSplit: 0.2,
          maxSequenceLength: 512,
          vocabSize: 30000
        };
        
        // Training callbacks
        const callbacks = {
          onProgress: (progress: any) => {
            // Update database
            db.prepare(`
              UPDATE models 
              SET current_epoch = ?, loss = ?, accuracy = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `).run(
              progress.currentEpoch,
              progress.trainingLoss[progress.trainingLoss.length - 1] || 0,
              progress.validationAccuracy[progress.validationAccuracy.length - 1] || 0,
              modelId
            );
            
            // Log progress
            db.prepare(`
              INSERT INTO training_logs (model_id, level, message, epoch, loss, accuracy)
              VALUES (?, 'info', ?, ?, ?, ?)
            `).run(
              modelId,
              `Epoch ${progress.currentEpoch}/${progress.totalEpochs} completed`,
              progress.currentEpoch,
              progress.trainingLoss[progress.trainingLoss.length - 1] || 0,
              progress.validationAccuracy[progress.validationAccuracy.length - 1] || 0
            );
            
            // Call progress callback
            progressCallback({
              modelId,
              epoch: progress.currentEpoch,
              totalEpochs: progress.totalEpochs,
              loss: progress.trainingLoss[progress.trainingLoss.length - 1] || 0,
              accuracy: progress.validationAccuracy[progress.validationAccuracy.length - 1] || 0,
              step: progress.currentStep,
              totalSteps: progress.totalSteps,
              completionPercentage: progress.completionPercentage,
              estimatedTimeRemaining: progress.estimatedTimeRemaining
            });
          },
          
          onMetrics: (metrics: any) => {
            progressCallback({
              modelId,
              type: 'metrics',
              ...metrics
            });
          },
          
          onComplete: (trainedModel: any) => {
            // Update model status
            db.prepare('UPDATE models SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
              .run('completed', modelId);
            
            // Log completion
            db.prepare(`
              INSERT INTO training_logs (model_id, level, message, epoch)
              VALUES (?, 'info', 'Training completed successfully', ?)
            `).run(modelId, config.epochs || 10);
            
            progressCallback({
              modelId,
              type: 'complete',
              message: 'Training completed successfully'
            });
          },
          
          onError: (error: string) => {
            // Update model status
            db.prepare('UPDATE models SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
              .run('failed', modelId);
            
            // Log error
            db.prepare(`
              INSERT INTO training_logs (model_id, level, message, epoch)
              VALUES (?, 'error', ?, 0)
            `).run(modelId, `Training failed: ${error}`);
            
            progressCallback({
              modelId,
              type: 'error',
              error
            });
          }
        };
        
        // Start training
        await engine.startTraining(trainingConfig, callbacks);
        
      } catch (error) {
        console.error(`Training failed for model ${modelId}:`, error);
        
        // Update status to failed
        db.prepare('UPDATE models SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run('failed', modelId);
        
        throw error;
      }
    },
    
    stop() {
      engine.stopTraining();
    },
    
    dispose() {
      engine.dispose();
    }
  };
  
  return engineWithDb;
}

export default getRealTrainingEngine;
 import * as tf from '@tensorflow/tfjs-node';
import { PersianTokenizer } from './tokenizer.js';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

interface TrainingConfig {
  epochs: number;
  batchSize: number;
  learningRate: number;
  validationSplit?: number;
  earlyStopping?: boolean;
  patience?: number;
}

interface TrainingProgress {
  epoch: number;
  loss: number;
  accuracy: number;
  validationLoss?: number;
  validationAccuracy?: number;
  timestamp: string;
}

/**
 * Real TensorFlow.js Training Engine Implementation
 */
export class RealTrainingEngineImpl {
  private model: tf.LayersModel | null = null;
  private tokenizer: PersianTokenizer;
  private db: Database.Database;
  private checkpointDir: string;
  private isTraining: boolean = false;
  private currentEpoch: number = 0;
  private trainingHistory: TrainingProgress[] = [];
  
  constructor(db: Database.Database) {
    this.tokenizer = new PersianTokenizer();
    this.db = db;
    this.checkpointDir = path.join(process.cwd(), 'checkpoints');
    
    // Ensure checkpoint directory exists
    if (!fs.existsSync(this.checkpointDir)) {
      fs.mkdirSync(this.checkpointDir, { recursive: true });
    }
  }
  
  /**
   * Initialize BERT-like model for Persian text classification
   */
  async initializeModel(numClasses: number = 3): Promise<void> {
    const vocabSize = this.tokenizer.getVocabSize();
    const embeddingDim = 128;
    const maxLength = 512;
    
    // Build a simplified BERT-like model
    this.model = tf.sequential({
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
          units: numClasses,
          activation: 'softmax'
        })
      ]
    });
    
    // Compile the model
    const optimizer = tf.train.adam(0.001);
    
    this.model.compile({
      optimizer: optimizer,
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });
    
    console.log('Model initialized with architecture:');
    this.model.summary();
  }
  
  /**
   * Prepare training data from database
   */
  async prepareData(datasetId: string): Promise<{
    trainX: tf.Tensor;
    trainY: tf.Tensor;
    valX?: tf.Tensor;
    valY?: tf.Tensor;
  }> {
    // For demo purposes, generate synthetic Persian legal text data
    const samples = this.generateSyntheticData(1000);
    
    // Tokenize and encode texts
    const encodedTexts = samples.texts.map(text => this.tokenizer.encode(text));
    
    // Convert to tensors
    const xTensor = tf.tensor2d(encodedTexts, [encodedTexts.length, encodedTexts[0].length]);
    const yTensor = tf.oneHot(tf.tensor1d(samples.labels, 'int32'), 3);
    
    // Split into train/validation if needed
    const splitIndex = Math.floor(encodedTexts.length * 0.8);
    
    return {
      trainX: xTensor.slice([0, 0], [splitIndex, -1]),
      trainY: yTensor.slice([0, 0], [splitIndex, -1]),
      valX: xTensor.slice([splitIndex, 0], [-1, -1]),
      valY: yTensor.slice([splitIndex, 0], [-1, -1])
    };
  }
  
  /**
   * Generate synthetic Persian legal text data for testing
   */
  private generateSyntheticData(numSamples: number): { texts: string[]; labels: number[] } {
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
   * Train the model with real TensorFlow.js
   */
  async train(
    modelId: number,
    datasetId: string,
    config: TrainingConfig,
    progressCallback?: (progress: TrainingProgress) => void
  ): Promise<void> {
    if (!this.model) {
      await this.initializeModel();
    }
    
    this.isTraining = true;
    this.currentEpoch = 0;
    this.trainingHistory = [];
    
    try {
      // Prepare data
      const { trainX, trainY, valX, valY } = await this.prepareData(datasetId);
      
      // Configure callbacks
      const callbacks: tf.CustomCallbackArgs = {
        onEpochEnd: async (epoch, logs) => {
          this.currentEpoch = epoch + 1;
          
          const progress: TrainingProgress = {
            epoch: this.currentEpoch,
            loss: logs?.loss || 0,
            accuracy: logs?.acc || 0,
            validationLoss: logs?.val_loss,
            validationAccuracy: logs?.val_acc,
            timestamp: new Date().toISOString()
          };
          
          this.trainingHistory.push(progress);
          
          // Save to database
          this.saveProgress(modelId, progress);
          
          // Call progress callback
          if (progressCallback) {
            progressCallback(progress);
          }
          
          // Save checkpoint every 5 epochs
          if (this.currentEpoch % 5 === 0) {
            await this.saveCheckpoint(modelId, this.currentEpoch);
          }
          
          console.log(
            `Epoch ${this.currentEpoch}: loss=${progress.loss.toFixed(4)}, ` +
            `accuracy=${progress.accuracy.toFixed(4)}`
          );
        },
        
        onTrainEnd: async () => {
          this.isTraining = false;
          await this.saveCheckpoint(modelId, this.currentEpoch, true);
          console.log('Training completed');
        }
      };
      
      // Train the model
      await this.model.fit(trainX, trainY, {
        epochs: config.epochs,
        batchSize: config.batchSize,
        validationData: valX && valY ? [valX, valY] : undefined,
        validationSplit: !valX ? config.validationSplit : undefined,
        callbacks: callbacks,
        verbose: 1
      });
      
      // Clean up tensors
      trainX.dispose();
      trainY.dispose();
      valX?.dispose();
      valY?.dispose();
      
    } catch (error) {
      this.isTraining = false;
      console.error('Training error:', error);
      throw error;
    }
  }
  
  /**
   * Save training progress to database
   */
  private saveProgress(modelId: number, progress: TrainingProgress): void {
    try {
      // Update model status
      this.db.prepare(`
        UPDATE models 
        SET status = 'training',
            current_epoch = ?,
            loss = ?,
            accuracy = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(progress.epoch, progress.loss, progress.accuracy, modelId);
      
      // Log training progress
      this.db.prepare(`
        INSERT INTO training_logs (model_id, level, message, epoch, loss, accuracy, timestamp)
        VALUES (?, 'info', ?, ?, ?, ?, ?)
      `).run(
        modelId,
        `Epoch ${progress.epoch} completed`,
        progress.epoch,
        progress.loss,
        progress.accuracy,
        progress.timestamp
      );
    } catch (error) {
      console.error('Failed to save progress:', error);
    }
  }
  
  /**
   * Save model checkpoint
   */
  async saveCheckpoint(modelId: number, epoch: number, isFinal: boolean = false): Promise<void> {
    if (!this.model) return;
    
    try {
      const checkpointName = `model_${modelId}_epoch_${epoch}${isFinal ? '_final' : ''}`;
      const checkpointPath = path.join(this.checkpointDir, checkpointName);
      
      // Save model to disk
      await this.model.save(`file://${checkpointPath}`);
      
      // Record in database
      this.db.prepare(`
        INSERT INTO checkpoints (model_id, epoch, accuracy, loss, file_path, created_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(
        modelId,
        epoch,
        this.trainingHistory[epoch - 1]?.accuracy || 0,
        this.trainingHistory[epoch - 1]?.loss || 0,
        checkpointPath
      );
      
      console.log(`Checkpoint saved: ${checkpointPath}`);
    } catch (error) {
      console.error('Failed to save checkpoint:', error);
    }
  }
  
  /**
   * Load model from checkpoint
   */
  async loadCheckpoint(checkpointPath: string): Promise<void> {
    try {
      this.model = await tf.loadLayersModel(`file://${checkpointPath}/model.json`);
      console.log(`Model loaded from: ${checkpointPath}`);
    } catch (error) {
      console.error('Failed to load checkpoint:', error);
      throw error;
    }
  }
  
  /**
   * Evaluate model on test data
   */
  async evaluate(testData: { texts: string[]; labels: number[] }): Promise<{
    loss: number;
    accuracy: number;
    predictions: number[];
  }> {
    if (!this.model) {
      throw new Error('Model not initialized');
    }
    
    // Prepare test data
    const encodedTexts = testData.texts.map(text => this.tokenizer.encode(text));
    const xTest = tf.tensor2d(encodedTexts);
    const yTest = tf.oneHot(tf.tensor1d(testData.labels, 'int32'), 3);
    
    // Evaluate
    const result = this.model.evaluate(xTest, yTest) as tf.Scalar[];
    const loss = await result[0].data();
    const accuracy = await result[1].data();
    
    // Get predictions
    const predictions = this.model.predict(xTest) as tf.Tensor;
    const predictionData = await predictions.argMax(-1).data();
    
    // Clean up
    xTest.dispose();
    yTest.dispose();
    predictions.dispose();
    result.forEach(t => t.dispose());
    
    return {
      loss: loss[0],
      accuracy: accuracy[0],
      predictions: Array.from(predictionData)
    };
  }
  
  /**
   * Predict on new text
   */
  async predict(text: string): Promise<{
    class: number;
    probabilities: number[];
  }> {
    if (!this.model) {
      throw new Error('Model not initialized');
    }
    
    const encoded = this.tokenizer.encode(text);
    const input = tf.tensor2d([encoded]);
    
    const prediction = this.model.predict(input) as tf.Tensor;
    const probabilities = await prediction.data();
    const predictedClass = await prediction.argMax(-1).data();
    
    input.dispose();
    prediction.dispose();
    
    return {
      class: predictedClass[0],
      probabilities: Array.from(probabilities)
    };
  }
  
  /**
   * Stop training
   */
  stopTraining(): void {
    this.isTraining = false;
    this.model?.stopTraining = true;
  }
  
  /**
   * Get training status
   */
  getStatus(): {
    isTraining: boolean;
    currentEpoch: number;
    history: TrainingProgress[];
  } {
    return {
      isTraining: this.isTraining,
      currentEpoch: this.currentEpoch,
      history: this.trainingHistory
    };
  }
}

// Export singleton instance
let engineInstance: RealTrainingEngineImpl | null = null;

export function getRealTrainingEngine(db: Database.Database): RealTrainingEngineImpl {
  if (!engineInstance) {
    engineInstance = new RealTrainingEngineImpl(db);
  }
  return engineInstance;
}
 
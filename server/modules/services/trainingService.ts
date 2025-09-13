import { Server } from 'socket.io';
import Database from 'better-sqlite3';
import { getRealTrainingEngine } from '../../training/RealTrainingEngineImpl.js';
import { config, isDemoMode } from '../security/config.js';
import { WorkerManager } from '../workers/trainingWorker.js';
import { 
  TrainingConfig, 
  TrainingProgress, 
  TrainingResult,
  WorkerMetrics,
  PerformanceMetrics
} from '../workers/types.js';

// TrainingConfig and TrainingProgress are now imported from types.js

export class TrainingService {
  private db: Database.Database;
  private io: Server;
  private trainingEngine: ReturnType<typeof getRealTrainingEngine>;
  private workerManager: WorkerManager;
  private activeTrainingSessions = new Map<number, boolean>();
  private useWorkers: boolean;

  constructor(db: Database.Database, io: Server) {
    this.db = db;
    this.io = io;
    this.trainingEngine = getRealTrainingEngine(db);
    this.useWorkers = process.env.USE_WORKERS === 'true';
    this.workerManager = new WorkerManager(io);
    
    // Set up worker progress forwarding to Socket.IO
    this.setupWorkerProgressForwarding();
  }

  /**
   * Set up progress forwarding from workers to Socket.IO
   */
  private setupWorkerProgressForwarding(): void {
    // This will be implemented to forward worker progress to Socket.IO clients
    // The WorkerManager will emit progress updates that we'll forward
  }

  /**
   * Start real training for a model with worker thread support
   */
  async startTraining(
    modelId: number,
    datasetId: string,
    config: TrainingConfig,
    userId: number
  ): Promise<{ success: boolean; sessionId?: number; error?: string }> {
    try {
      // Check if model exists
      const model = this.db.prepare('SELECT * FROM models WHERE id = ?').get(modelId) as any;
      if (!model) {
        return { success: false, error: 'Model not found' };
      }

      // Check if already training
      if (this.activeTrainingSessions.has(modelId)) {
        return { success: false, error: 'Model is already training' };
      }

      // In demo mode, simulate training
      if (isDemoMode()) {
        return this.simulateTraining(modelId, config, userId);
      }

      // Create training session
      const sessionResult = this.db.prepare(`
        INSERT INTO training_sessions (model_id, dataset_id, parameters, start_time, status, user_id)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP, 'running', ?)
      `).run(modelId, datasetId, JSON.stringify(config), userId);

      const sessionId = sessionResult.lastInsertRowid as number;

      // Update model status
      this.db.prepare(`
        UPDATE models 
        SET status = 'training', current_epoch = 0, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(modelId);

      // Mark as active
      this.activeTrainingSessions.set(modelId, true);

      // Start training with worker threads or main thread
      if (this.useWorkers) {
        this.runTrainingWithWorkers(modelId, datasetId, config, sessionId, userId).catch(error => {
          console.error('Worker training failed:', error);
          this.handleTrainingError(modelId, sessionId, error.message);
        });
      } else {
        this.runTraining(modelId, datasetId, config, sessionId).catch(error => {
          console.error('Training failed:', error);
          this.handleTrainingError(modelId, sessionId, error.message);
        });
      }

      return { success: true, sessionId };
    } catch (error) {
      console.error('Failed to start training:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Run training with worker threads
   */
  private async runTrainingWithWorkers(
    modelId: number,
    datasetId: string,
    config: TrainingConfig,
    sessionId: number,
    userId: number
  ): Promise<void> {
    try {
      console.log(`Starting worker-based training for model ${modelId}`);
      
      // Start training in worker thread
      const result: TrainingResult = await this.workerManager.startTraining(
        modelId,
        datasetId,
        config,
        sessionId,
        userId
      );
      
      // Handle successful completion
      this.handleWorkerTrainingComplete(modelId, sessionId, result);
      
    } catch (error) {
      console.error('Worker training failed:', error);
      this.handleTrainingError(modelId, sessionId, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Handle worker training completion
   */
  private handleWorkerTrainingComplete(modelId: number, sessionId: number, result: TrainingResult): void {
    // Update model with final results
    this.db.prepare(`
      UPDATE models 
      SET status = 'completed', 
          current_epoch = ?, 
          loss = ?, 
          accuracy = ?, 
          updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(result.totalEpochs, result.finalLoss, result.finalAccuracy, modelId);

    // Update session status
    this.db.prepare(`
      UPDATE training_sessions 
      SET status = 'completed', 
          end_time = CURRENT_TIMESTAMP,
          final_accuracy = ?,
          final_loss = ?,
          training_time = ?
      WHERE id = ?
    `).run(result.finalAccuracy, result.finalLoss, result.trainingTime, sessionId);

    // Log completion with metrics
    this.db.prepare(`
      INSERT INTO training_logs (model_id, level, message, epoch, loss, accuracy, timestamp)
      VALUES (?, 'info', ?, ?, ?, ?, ?)
    `).run(
      modelId,
      `Training completed successfully. Peak memory: ${result.metrics.peakMemoryUsage.toFixed(2)}MB, Avg epoch time: ${result.metrics.averageEpochTime.toFixed(2)}ms`,
      result.totalEpochs,
      result.finalLoss,
      result.finalAccuracy,
      new Date().toISOString()
    );

    // Emit completion event with detailed results
    this.io.emit('training_completed', {
      modelId,
      sessionId,
      message: 'Training completed successfully',
      result: {
        finalLoss: result.finalLoss,
        finalAccuracy: result.finalAccuracy,
        totalEpochs: result.totalEpochs,
        trainingTime: result.trainingTime,
        checkpointPath: result.checkpointPath,
        metrics: result.metrics
      }
    });

    // Remove from active sessions
    this.activeTrainingSessions.delete(modelId);

    console.log(`Worker training completed for model ${modelId} in ${result.trainingTime}ms`);
  }

  /**
   * Run the actual training process (main thread fallback)
   */
  private async runTraining(
    modelId: number,
    datasetId: string,
    config: TrainingConfig,
    sessionId: number
  ): Promise<void> {
    try {
      // Initialize model
      await this.trainingEngine.initializeModel(3); // 3 classes for legal text

      // Progress callback
      const progressCallback = (progress: TrainingProgress) => {
        // Update database
        this.db.prepare(`
          UPDATE models 
          SET current_epoch = ?, loss = ?, accuracy = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).run(progress.epoch, progress.loss, progress.accuracy, modelId);

        // Log progress
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

        // Emit progress via Socket.IO
        this.io.emit('training_progress', {
          modelId,
          sessionId,
          progress
        });

        console.log(`Model ${modelId} - Epoch ${progress.epoch}: loss=${progress.loss.toFixed(4)}, accuracy=${progress.accuracy.toFixed(4)}`);
      };

      // Start training
      await this.trainingEngine.train(modelId, datasetId, config, progressCallback);

      // Training completed successfully
      this.handleTrainingComplete(modelId, sessionId);

    } catch (error) {
      this.handleTrainingError(modelId, sessionId, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Handle training completion
   */
  private handleTrainingComplete(modelId: number, sessionId: number): void {
    // Update model status
    this.db.prepare(`
      UPDATE models 
      SET status = 'completed', updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(modelId);

    // Update session status
    this.db.prepare(`
      UPDATE training_sessions 
      SET status = 'completed', end_time = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(sessionId);

    // Log completion
    this.db.prepare(`
      INSERT INTO training_logs (model_id, level, message, timestamp)
      VALUES (?, 'info', 'Training completed successfully', CURRENT_TIMESTAMP)
    `).run(modelId);

    // Emit completion event
    this.io.emit('training_completed', {
      modelId,
      sessionId,
      message: 'Training completed successfully'
    });

    // Remove from active sessions
    this.activeTrainingSessions.delete(modelId);

    console.log(`Training completed for model ${modelId}`);
  }

  /**
   * Handle training error
   */
  private handleTrainingError(modelId: number, sessionId: number, error: string): void {
    // Update model status
    this.db.prepare(`
      UPDATE models 
      SET status = 'failed', updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(modelId);

    // Update session status
    this.db.prepare(`
      UPDATE training_sessions 
      SET status = 'failed', end_time = CURRENT_TIMESTAMP, error_message = ?
      WHERE id = ?
    `).run(error, sessionId);

    // Log error
    this.db.prepare(`
      INSERT INTO training_logs (model_id, level, message, timestamp)
      VALUES (?, 'error', ?, CURRENT_TIMESTAMP)
    `).run(modelId, `Training failed: ${error}`);

    // Emit error event
    this.io.emit('training_failed', {
      modelId,
      sessionId,
      error
    });

    // Remove from active sessions
    this.activeTrainingSessions.delete(modelId);

    console.error(`Training failed for model ${modelId}: ${error}`);
  }

  /**
   * Simulate training in demo mode
   */
  private simulateTraining(
    modelId: number,
    config: TrainingConfig,
    userId: number
  ): { success: boolean; sessionId?: number; error?: string } {
    const sessionId = Date.now();

    // Simulate training progress
    let epoch = 0;
    const interval = setInterval(() => {
      epoch++;
      const loss = Math.max(0.1, 2.0 - (epoch / config.epochs) * 1.8);
      const accuracy = Math.min(0.95, (epoch / config.epochs) * 0.9);

      const progress: TrainingProgress = {
        epoch,
        loss,
        accuracy,
        validationLoss: loss * 1.1,
        validationAccuracy: accuracy * 0.95,
        timestamp: new Date().toISOString()
      };

      // Update database
      this.db.prepare(`
        UPDATE models 
        SET current_epoch = ?, loss = ?, accuracy = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(progress.epoch, progress.loss, progress.accuracy, modelId);

      // Emit progress
      this.io.emit('training_progress', {
        modelId,
        sessionId,
        progress
      });

      if (epoch >= config.epochs) {
        clearInterval(interval);
        this.handleTrainingComplete(modelId, sessionId);
      }
    }, 2000); // 2 seconds per epoch

    return { success: true, sessionId };
  }

  /**
   * Stop training
   */
  async stopTraining(modelId: number): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.activeTrainingSessions.has(modelId)) {
        return { success: false, error: 'No active training session found' };
      }

      // Stop the training engine
      this.trainingEngine.stopTraining();

      // Update model status
      this.db.prepare(`
        UPDATE models 
        SET status = 'stopped', updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(modelId);

      // Log stop
      this.db.prepare(`
        INSERT INTO training_logs (model_id, level, message, timestamp)
        VALUES (?, 'info', 'Training stopped by user', CURRENT_TIMESTAMP)
      `).run(modelId);

      // Remove from active sessions
      this.activeTrainingSessions.delete(modelId);

      // Emit stop event
      this.io.emit('training_stopped', { modelId });

      return { success: true };
    } catch (error) {
      console.error('Failed to stop training:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get training status
   */
  getTrainingStatus(modelId: number): { isTraining: boolean; status?: string } {
    const isTraining = this.activeTrainingSessions.has(modelId);
    if (!isTraining) {
      const model = this.db.prepare('SELECT status FROM models WHERE id = ?').get(modelId) as any;
      return { isTraining: false, status: model?.status || 'idle' };
    }
    return { isTraining: true, status: 'training' };
  }

  /**
   * Get active training sessions
   */
  getActiveSessions(): number[] {
    return Array.from(this.activeTrainingSessions.keys());
  }

  /**
   * Get worker pool status and metrics
   */
  getWorkerStatus(): {
    useWorkers: boolean;
    status?: any;
    health?: any;
  } {
    if (!this.useWorkers) {
      return { useWorkers: false };
    }

    return {
      useWorkers: true,
      status: this.workerManager.getStatus(),
      health: this.workerManager.healthCheck()
    };
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics | null {
    if (!this.useWorkers) {
      return null;
    }

    const status = this.workerManager.getStatus();
    return status.performance;
  }

  /**
   * Health check for worker threads
   */
  async performHealthCheck(): Promise<{
    isHealthy: boolean;
    issues: string[];
    metrics: any;
  }> {
    if (!this.useWorkers) {
      return {
        isHealthy: true,
        issues: [],
        metrics: { message: 'Workers disabled' }
      };
    }

    try {
      const healthChecks = await this.workerManager.healthCheck();
      const unhealthyWorkers = healthChecks.filter(check => !check.isHealthy);
      const allIssues = unhealthyWorkers.flatMap(worker => worker.issues);

      return {
        isHealthy: unhealthyWorkers.length === 0,
        issues: allIssues,
        metrics: this.workerManager.getStatus()
      };
    } catch (error) {
      return {
        isHealthy: false,
        issues: [`Health check failed: ${(error as Error).message}`],
        metrics: null
      };
    }
  }

  /**
   * Gracefully shutdown worker threads
   */
  async shutdown(): Promise<void> {
    if (this.useWorkers) {
      console.log('Shutting down worker threads...');
      await this.workerManager.terminate();
      console.log('Worker threads shut down successfully');
    }
  }

  /**
   * Evaluate model using worker threads
   */
  async evaluateModel(
    modelId: number,
    testDatasetId: string,
    checkpointPath: string
  ): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
      if (!this.useWorkers) {
        return { success: false, error: 'Workers not enabled' };
      }

      const result = await this.workerManager.evaluateModel(modelId, testDatasetId, checkpointPath);
      return { success: true, result };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Predict using worker threads
   */
  async predict(
    modelId: number,
    texts: string[],
    checkpointPath: string
  ): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
      if (!this.useWorkers) {
        return { success: false, error: 'Workers not enabled' };
      }

      const result = await this.workerManager.predict(modelId, texts, checkpointPath);
      return { success: true, result };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}
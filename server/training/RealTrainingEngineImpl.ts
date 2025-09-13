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
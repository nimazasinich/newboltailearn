import Database from 'better-sqlite3';
import { config, useFakeData, isDemoMode } from '../security/config.js';

/**
 * Data Service with fake/real data toggle and demo mode support
 */
export class DataService {
  private db: Database.Database;
  private useFakeData: boolean;
  private isDemoMode: boolean;

  constructor(db: Database.Database) {
    this.db = db;
    this.useFakeData = useFakeData();
    this.isDemoMode = isDemoMode();
  }

  /**
   * Get datasets (fake or real based on configuration)
   */
  getDatasets(limit: number = 10, offset: number = 0) {
    if (this.useFakeData) {
      return this.getFakeDatasets(limit, offset);
    }
    
    return this.db.prepare(`
      SELECT * FROM datasets
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);
  }

  /**
   * Get fake datasets for testing/demo
   */
  private getFakeDatasets(limit: number, offset: number) {
    const fakeDatasets = [
      {
        id: 'fake-persian-laws-1',
        name: 'Persian Legal Corpus (Demo)',
        source: 'Demo Data',
        huggingface_id: 'demo/persian-laws',
        samples: 10000,
        size_mb: 125.5,
        status: 'available',
        created_at: new Date('2024-01-01').toISOString()
      },
      {
        id: 'fake-legal-qa-1',
        name: 'Legal Q&A Dataset (Demo)',
        source: 'Demo Data',
        huggingface_id: 'demo/legal-qa',
        samples: 5000,
        size_mb: 45.2,
        status: 'available',
        created_at: new Date('2024-01-02').toISOString()
      },
      {
        id: 'fake-contracts-1',
        name: 'Contract Analysis Dataset (Demo)',
        source: 'Demo Data',
        huggingface_id: 'demo/contracts',
        samples: 3000,
        size_mb: 78.9,
        status: 'downloading',
        created_at: new Date('2024-01-03').toISOString()
      },
      {
        id: 'fake-judgments-1',
        name: 'Court Judgments Dataset (Demo)',
        source: 'Demo Data',
        huggingface_id: 'demo/judgments',
        samples: 8000,
        size_mb: 234.1,
        status: 'available',
        created_at: new Date('2024-01-04').toISOString()
      },
      {
        id: 'fake-regulations-1',
        name: 'Regulatory Documents (Demo)',
        source: 'Demo Data',
        huggingface_id: 'demo/regulations',
        samples: 12000,
        size_mb: 156.7,
        status: 'processing',
        created_at: new Date('2024-01-05').toISOString()
      }
    ];

    return fakeDatasets.slice(offset, offset + limit);
  }

  /**
   * Create dataset (blocked in demo mode)
   */
  createDataset(data: any) {
    if (this.isDemoMode) {
      throw new Error('Dataset creation is disabled in demo mode');
    }

    if (this.useFakeData) {
      // Return fake created dataset
      return {
        id: `fake-${Date.now()}`,
        ...data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }

    const result = this.db.prepare(`
      INSERT INTO datasets (id, name, source, huggingface_id, samples, size_mb, status, type, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.id || `dataset-${Date.now()}`,
      data.name,
      data.source,
      data.huggingface_id,
      data.samples || 0,
      data.size_mb || 0,
      data.status || 'available',
      data.type || 'text',
      data.description || ''
    );

    return {
      id: result.lastInsertRowid,
      ...data
    };
  }

  /**
   * Update dataset (blocked in demo mode)
   */
  updateDataset(id: string, updates: any) {
    if (this.isDemoMode) {
      throw new Error('Dataset updates are disabled in demo mode');
    }

    if (this.useFakeData) {
      // Return fake updated dataset
      return {
        id,
        ...updates,
        updated_at: new Date().toISOString()
      };
    }

    const fields = Object.keys(updates).filter(key => 
      ['name', 'status', 'samples', 'size_mb'].includes(key)
    );

    if (fields.length === 0) {
      return null;
    }

    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const values = fields.map(field => updates[field]);

    this.db.prepare(`
      UPDATE datasets 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(...values, id);

    return this.getDataset(id);
  }

  /**
   * Delete dataset (blocked in demo mode)
   */
  deleteDataset(id: string) {
    if (this.isDemoMode) {
      throw new Error('Dataset deletion is disabled in demo mode');
    }

    if (this.useFakeData) {
      return { success: true, message: 'Fake dataset deleted' };
    }

    const result = this.db.prepare('DELETE FROM datasets WHERE id = ?').run(id);
    return {
      success: result.changes > 0,
      message: result.changes > 0 ? 'Dataset deleted' : 'Dataset not found'
    };
  }

  /**
   * Get single dataset
   */
  getDataset(id: string) {
    if (this.useFakeData) {
      const fakeDatasets = this.getFakeDatasets(10, 0);
      return fakeDatasets.find(d => d.id === id) || null;
    }

    return this.db.prepare('SELECT * FROM datasets WHERE id = ?').get(id);
  }

  /**
   * Get models (with fake data support)
   */
  getModels(limit: number = 10, offset: number = 0) {
    if (this.useFakeData) {
      return this.getFakeModels(limit, offset);
    }

    return this.db.prepare(`
      SELECT * FROM models
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);
  }

  /**
   * Get fake models for testing/demo
   */
  private getFakeModels(limit: number, offset: number) {
    const fakeModels = [
      {
        id: 1,
        name: 'Persian BERT Legal (Demo)',
        type: 'persian-bert',
        status: 'completed',
        accuracy: 0.92,
        loss: 0.23,
        epochs: 10,
        current_epoch: 10,
        dataset_id: 'fake-persian-laws-1',
        created_at: new Date('2024-01-10').toISOString()
      },
      {
        id: 2,
        name: 'DoRA Legal Classifier (Demo)',
        type: 'dora',
        status: 'training',
        accuracy: 0.85,
        loss: 0.41,
        epochs: 20,
        current_epoch: 12,
        dataset_id: 'fake-legal-qa-1',
        created_at: new Date('2024-01-11').toISOString()
      },
      {
        id: 3,
        name: 'QR-Adaptor Contract Analyzer (Demo)',
        type: 'qr-adaptor',
        status: 'completed',
        accuracy: 0.88,
        loss: 0.31,
        epochs: 15,
        current_epoch: 15,
        dataset_id: 'fake-contracts-1',
        created_at: new Date('2024-01-12').toISOString()
      },
      {
        id: 4,
        name: 'Persian BERT Judgments (Demo)',
        type: 'persian-bert',
        status: 'failed',
        accuracy: 0.45,
        loss: 1.23,
        epochs: 10,
        current_epoch: 3,
        dataset_id: 'fake-judgments-1',
        created_at: new Date('2024-01-13').toISOString()
      },
      {
        id: 5,
        name: 'DoRA Regulations (Demo)',
        type: 'dora',
        status: 'paused',
        accuracy: 0.76,
        loss: 0.52,
        epochs: 25,
        current_epoch: 8,
        dataset_id: 'fake-regulations-1',
        created_at: new Date('2024-01-14').toISOString()
      }
    ];

    return fakeModels.slice(offset, offset + limit);
  }

  /**
   * Start training (simulated in demo mode)
   */
  startTraining(modelId: number, config: any) {
    if (this.isDemoMode) {
      // Simulate training start in demo mode
      return {
        success: true,
        message: 'Training simulation started (demo mode)',
        sessionId: `demo-session-${Date.now()}`,
        modelId,
        config
      };
    }

    if (this.useFakeData) {
      // Return fake training session
      return {
        success: true,
        message: 'Fake training started',
        sessionId: `fake-session-${Date.now()}`,
        modelId,
        config
      };
    }

    // Real training logic would go here
    const sessionId = `session-${Date.now()}`;
    
    this.db.prepare(`
      INSERT INTO training_sessions (model_id, session_id, config, status, started_at)
      VALUES (?, ?, ?, 'running', CURRENT_TIMESTAMP)
    `).run(modelId, sessionId, JSON.stringify(config));

    return {
      success: true,
      message: 'Training started',
      sessionId,
      modelId,
      config
    };
  }

  /**
   * Get training logs (with fake data support)
   */
  getTrainingLogs(modelId: number, limit: number = 50) {
    if (this.useFakeData) {
      return this.getFakeTrainingLogs(modelId, limit);
    }

    return this.db.prepare(`
      SELECT * FROM training_logs
      WHERE model_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(modelId, limit);
  }

  /**
   * Get fake training logs
   */
  private getFakeTrainingLogs(modelId: number, limit: number) {
    const logs = [];
    const baseTime = Date.now() - 3600000; // 1 hour ago

    for (let i = 0; i < Math.min(limit, 20); i++) {
      logs.push({
        id: i + 1,
        model_id: modelId,
        level: ['info', 'warning', 'debug'][Math.floor(Math.random() * 3)],
        message: `Training epoch ${i + 1} - Loss: ${(Math.random() * 0.5 + 0.2).toFixed(3)}`,
        epoch: i + 1,
        loss: Math.random() * 0.5 + 0.2,
        accuracy: Math.random() * 0.3 + 0.6,
        timestamp: new Date(baseTime + i * 180000).toISOString() // 3 minutes apart
      });
    }

    return logs;
  }

  /**
   * Check if in demo mode
   */
  isInDemoMode(): boolean {
    return this.isDemoMode;
  }

  /**
   * Check if using fake data
   */
  isUsingFakeData(): boolean {
    return this.useFakeData;
  }
}
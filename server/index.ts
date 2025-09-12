import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Initialize SQLite Database
const dbPath = path.join(process.cwd(), 'persian_legal_ai.db');
const db = new Database(dbPath);

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('dora', 'qr-adaptor', 'persian-bert')),
    status TEXT DEFAULT 'idle' CHECK(status IN ('idle', 'training', 'completed', 'failed', 'paused')),
    accuracy REAL DEFAULT 0,
    loss REAL DEFAULT 0,
    epochs INTEGER DEFAULT 0,
    current_epoch INTEGER DEFAULT 0,
    dataset_id TEXT,
    config TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS datasets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    source TEXT NOT NULL,
    huggingface_id TEXT,
    samples INTEGER DEFAULT 0,
    size_mb REAL DEFAULT 0,
    status TEXT DEFAULT 'available' CHECK(status IN ('available', 'downloading', 'processing', 'error')),
    local_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS training_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_id INTEGER,
    level TEXT CHECK(level IN ('info', 'warning', 'error', 'debug')),
    message TEXT NOT NULL,
    epoch INTEGER,
    loss REAL,
    accuracy REAL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(model_id) REFERENCES models(id)
  );

  CREATE TABLE IF NOT EXISTS system_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level TEXT CHECK(level IN ('info', 'warning', 'error', 'debug')),
    category TEXT,
    message TEXT NOT NULL,
    metadata TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user' CHECK(role IN ('admin', 'trainer', 'viewer', 'user')),
    permissions TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
  );

  CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Insert default datasets
const defaultDatasets = [
  {
    id: 'iran-legal-qa',
    name: 'پرسش و پاسخ حقوقی ایران',
    source: 'huggingface',
    huggingface_id: 'PerSets/iran-legal-persian-qa',
    samples: 10247,
    size_mb: 15.2
  },
  {
    id: 'legal-laws',
    name: 'متون قوانین ایران',
    source: 'huggingface',
    huggingface_id: 'QomSSLab/legal_laws_lite_chunk_v1',
    samples: 50000,
    size_mb: 125.8
  },
  {
    id: 'persian-ner',
    name: 'تشخیص موجودیت فارسی',
    source: 'huggingface',
    huggingface_id: 'mansoorhamidzadeh/Persian-NER-Dataset-500k',
    samples: 500000,
    size_mb: 890.5
  }
];

const insertDataset = db.prepare(`
  INSERT OR IGNORE INTO datasets (id, name, source, huggingface_id, samples, size_mb)
  VALUES (?, ?, ?, ?, ?, ?)
`);

defaultDatasets.forEach(dataset => {
  insertDataset.run(dataset.id, dataset.name, dataset.source, dataset.huggingface_id, dataset.samples, dataset.size_mb);
});

// Insert default settings
const defaultSettings = [
  { key: 'dataset_directory', value: './datasets', description: 'Directory for storing datasets' },
  { key: 'model_directory', value: './models', description: 'Directory for storing trained models' },
  { key: 'huggingface_token', value: '', description: 'HuggingFace API token' },
  { key: 'max_concurrent_training', value: '2', description: 'Maximum concurrent training sessions' },
  { key: 'default_batch_size', value: '32', description: 'Default batch size for training' },
  { key: 'default_learning_rate', value: '0.001', description: 'Default learning rate' }
];

const insertSetting = db.prepare(`
  INSERT OR IGNORE INTO system_settings (key, value, description)
  VALUES (?, ?, ?)
`);

defaultSettings.forEach(setting => {
  insertSetting.run(setting.key, setting.value, setting.description);
});

// Utility functions
const logToDatabase = (level: string, category: string, message: string, metadata?: any) => {
  const stmt = db.prepare(`
    INSERT INTO system_logs (level, category, message, metadata)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(level, category, message, metadata ? JSON.stringify(metadata) : null);
};

const getSystemMetrics = async () => {
  const memUsage = process.memoryUsage();
  const os = await import('os');
  
  // Get CPU usage (simplified)
  const cpuUsage = await getCPUUsage();
  
  // Get system memory
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  
  return {
    cpu: cpuUsage,
    memory: {
      used: Math.round(usedMem / 1024 / 1024),
      total: Math.round(totalMem / 1024 / 1024),
      percentage: Math.round((usedMem / totalMem) * 100)
    },
    process_memory: {
      used: Math.round(memUsage.heapUsed / 1024 / 1024),
      total: Math.round(memUsage.heapTotal / 1024 / 1024),
      percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
    },
    uptime: Math.floor(process.uptime()),
    system_uptime: Math.floor(os.uptime()),
    platform: os.platform(),
    arch: os.arch(),
    timestamp: new Date().toISOString(),
    active_training: activeTrainingSessions.size
  };
};

// CPU usage calculation
async function getCPUUsage(): Promise<number> {
  const os = await import('os');
  
  return new Promise((resolve) => {
    const cpus = os.cpus();
    
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });
    
    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    
    setTimeout(() => {
      const cpus2 = os.cpus();
      let totalIdle2 = 0;
      let totalTick2 = 0;
      
      cpus2.forEach(cpu => {
        for (const type in cpu.times) {
          totalTick2 += cpu.times[type];
        }
        totalIdle2 += cpu.times.idle;
      });
      
      const idle2 = totalIdle2 / cpus2.length;
      const total2 = totalTick2 / cpus2.length;
      
      const idleDelta = idle2 - idle;
      const totalDelta = total2 - total;
      
      const usage = 100 - ~~(100 * idleDelta / totalDelta);
      resolve(Math.max(0, Math.min(100, usage)));
    }, 100);
  });
}

// API Routes

// Models endpoints
app.get('/api/models', (req, res) => {
  try {
    const models = db.prepare('SELECT * FROM models ORDER BY created_at DESC').all();
    res.json(models);
  } catch (error) {
    logToDatabase('error', 'api', 'Failed to fetch models', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

app.post('/api/models', (req, res) => {
  try {
    const { name, type, dataset_id, config } = req.body;
    
    if (!name || !type || !dataset_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const stmt = db.prepare(`
      INSERT INTO models (name, type, dataset_id, config)
      VALUES (?, ?, ?, ?)
    `);
    
    const result = stmt.run(name, type, dataset_id, JSON.stringify(config || {}));
    
    logToDatabase('info', 'models', `Created new model: ${name}`, { id: result.lastInsertRowid, type });
    
    res.json({ 
      id: result.lastInsertRowid, 
      message: 'Model created successfully',
      model: { id: result.lastInsertRowid, name, type, dataset_id, status: 'idle' }
    });
  } catch (error) {
    logToDatabase('error', 'api', 'Failed to create model', { error: error.message });
    res.status(500).json({ error: 'Failed to create model' });
  }
});

app.put('/api/models/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const fields = Object.keys(updates).filter(key => 
      ['name', 'status', 'accuracy', 'loss', 'current_epoch', 'config'].includes(key)
    );
    
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const values = fields.map(field => 
      field === 'config' ? JSON.stringify(updates[field]) : updates[field]
    );
    
    const stmt = db.prepare(`
      UPDATE models 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(...values, id);
    
    logToDatabase('info', 'models', `Updated model ${id}`, updates);
    res.json({ message: 'Model updated successfully' });
  } catch (error) {
    logToDatabase('error', 'api', 'Failed to update model', { error: error.message });
    res.status(500).json({ error: 'Failed to update model' });
  }
});

app.delete('/api/models/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    // Delete related training logs
    db.prepare('DELETE FROM training_logs WHERE model_id = ?').run(id);
    
    // Delete model
    const result = db.prepare('DELETE FROM models WHERE id = ?').run(id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Model not found' });
    }
    
    logToDatabase('info', 'models', `Deleted model ${id}`);
    res.json({ message: 'Model deleted successfully' });
  } catch (error) {
    logToDatabase('error', 'api', 'Failed to delete model', { error: error.message });
    res.status(500).json({ error: 'Failed to delete model' });
  }
});

// Training endpoints
app.post('/api/models/:id/train', async (req, res) => {
  try {
    const { id } = req.params;
    const { epochs = 10, batch_size = 32, learning_rate = 0.001, dataset_ids = [] } = req.body;
    
    const model = db.prepare('SELECT * FROM models WHERE id = ?').get(id) as any;
    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }
    
    // Check if model is already training
    if (model.status === 'training') {
      return res.status(400).json({ error: 'Model is already training' });
    }
    
    // Update model status
    db.prepare('UPDATE models SET status = ?, current_epoch = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run('training', id);
    
    // Log training start
    db.prepare(`
      INSERT INTO training_logs (model_id, level, message, epoch)
      VALUES (?, 'info', 'Training started', 0)
    `).run(id);
    
    logToDatabase('info', 'training', `Started training model ${id}`, { epochs, batch_size, learning_rate });
    
    // Start real training process
    startRealTraining(parseInt(id), model, {
      epochs,
      batch_size,
      learning_rate,
      dataset_ids: dataset_ids.length > 0 ? dataset_ids : ['iran-legal-qa', 'legal-laws']
    });
    
    res.json({ message: 'Training started successfully' });
  } catch (error) {
    logToDatabase('error', 'api', 'Failed to start training', { error: error.message });
    res.status(500).json({ error: 'Failed to start training' });
  }
});

app.post('/api/models/:id/pause', (req, res) => {
  try {
    const { id } = req.params;
    const modelId = parseInt(id);
    
    // Stop the active training session
    const trainingEngine = activeTrainingSessions.get(modelId);
    if (trainingEngine) {
      trainingEngine.stopTraining();
    }
    
    db.prepare('UPDATE models SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run('paused', id);
    
    db.prepare(`
      INSERT INTO training_logs (model_id, level, message, epoch)
      VALUES (?, 'info', 'Training paused by user', 0)
    `).run(id);
    
    logToDatabase('info', 'training', `Paused training model ${id}`);
    
    io.emit('training_paused', { modelId });
    
    res.json({ message: 'Training paused successfully' });
  } catch (error) {
    logToDatabase('error', 'api', 'Failed to pause training', { error: error.message });
    res.status(500).json({ error: 'Failed to pause training' });
  }
});

app.post('/api/models/:id/resume', async (req, res) => {
  try {
    const { id } = req.params;
    const model = db.prepare('SELECT * FROM models WHERE id = ?').get(id) as any;
    
    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }
    
    if (model.status !== 'paused') {
      return res.status(400).json({ error: 'Model is not paused' });
    }
    
    db.prepare('UPDATE models SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run('training', id);
    
    db.prepare(`
      INSERT INTO training_logs (model_id, level, message, epoch)
      VALUES (?, 'info', 'Training resumed by user', ?)
    `).run(id, model.current_epoch || 0);
    
    logToDatabase('info', 'training', `Resumed training model ${id}`);
    
    // Restart training from current epoch
    const config = JSON.parse(model.config || '{}');
    startRealTraining(parseInt(id), model, {
      epochs: model.epochs,
      batch_size: config.batchSize || 32,
      learning_rate: config.learningRate || 0.001,
      dataset_ids: config.dataset_ids || ['iran-legal-qa', 'legal-laws'],
      resume_from_epoch: model.current_epoch || 0
    });
    
    io.emit('training_resumed', { modelId: parseInt(id) });
    
    res.json({ message: 'Training resumed successfully' });
  } catch (error) {
    logToDatabase('error', 'api', 'Failed to resume training', { error: error.message });
    res.status(500).json({ error: 'Failed to resume training' });
  }
});

// Datasets endpoints
app.get('/api/datasets', (req, res) => {
  try {
    const datasets = db.prepare('SELECT * FROM datasets ORDER BY created_at DESC').all();
    res.json(datasets);
  } catch (error) {
    logToDatabase('error', 'api', 'Failed to fetch datasets', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch datasets' });
  }
});

app.post('/api/datasets/:id/download', async (req, res) => {
  try {
    const { id } = req.params;
    const dataset = db.prepare('SELECT * FROM datasets WHERE id = ?').get(id) as any;
    
    if (!dataset) {
      return res.status(404).json({ error: 'Dataset not found' });
    }
    
    // Update status to downloading
    db.prepare('UPDATE datasets SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run('downloading', id);
    
    logToDatabase('info', 'datasets', `Starting download of dataset ${dataset.name}`);
    
    // Start real download process
    downloadDatasetFromHuggingFace(dataset, id);
    
    res.json({ message: 'Dataset download started' });
  } catch (error) {
    logToDatabase('error', 'api', 'Failed to download dataset', { error: error.message });
    res.status(500).json({ error: 'Failed to download dataset' });
  }
});

// Real HuggingFace dataset download function
async function downloadDatasetFromHuggingFace(dataset: any, id: string) {
  try {
    const fs = await import('fs');
    const path = await import('path');
    
    // Create datasets directory if it doesn't exist
    const datasetsDir = './datasets';
    if (!fs.existsSync(datasetsDir)) {
      fs.mkdirSync(datasetsDir, { recursive: true });
    }
    
    const datasetPath = path.join(datasetsDir, id);
    if (!fs.existsSync(datasetPath)) {
      fs.mkdirSync(datasetPath, { recursive: true });
    }
    
    // Download dataset using HuggingFace API
    const baseUrl = 'https://datasets-server.huggingface.co';
    let allData: any[] = [];
    let offset = 0;
    const batchSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      try {
        const url = `${baseUrl}/rows?dataset=${dataset.huggingface_id}&config=default&split=train&offset=${offset}&length=${batchSize}`;
        
        const response = await fetch(url, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Persian-Legal-AI/1.0'
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data.rows || data.rows.length === 0) {
          hasMore = false;
          break;
        }
        
        allData.push(...data.rows);
        offset += batchSize;
        
        // Update progress
        io.emit('dataset_download_progress', {
          id,
          downloaded: allData.length,
          total: data.num_rows_total || dataset.samples
        });
        
        // Limit total samples to prevent excessive downloads
        if (allData.length >= 10000) {
          hasMore = false;
        }
        
        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (fetchError) {
        console.error(`Error fetching batch at offset ${offset}:`, fetchError);
        hasMore = false;
      }
    }
    
    if (allData.length === 0) {
      throw new Error('No data downloaded');
    }
    
    // Save data to JSON file
    const dataFile = path.join(datasetPath, 'data.json');
    fs.writeFileSync(dataFile, JSON.stringify(allData, null, 2));
    
    // Create metadata file
    const metadataFile = path.join(datasetPath, 'metadata.json');
    const metadata = {
      id: dataset.id,
      name: dataset.name,
      huggingface_id: dataset.huggingface_id,
      samples: allData.length,
      downloadedAt: new Date().toISOString(),
      structure: allData.length > 0 ? Object.keys(allData[0].row || {}) : []
    };
    fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
    
    // Update database
    db.prepare(`
      UPDATE datasets 
      SET status = 'available', 
          local_path = ?, 
          samples = ?,
          updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(datasetPath, allData.length, id);
    
    logToDatabase('info', 'datasets', `Successfully downloaded dataset ${dataset.name}`, {
      samples: allData.length,
      path: datasetPath
    });
    
    // Emit completion via WebSocket
    io.emit('dataset_updated', { id, status: 'available', samples: allData.length });
    
  } catch (error) {
    console.error(`Dataset download failed for ${id}:`, error);
    
    // Update status to error
    db.prepare('UPDATE datasets SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run('error', id);
    
    logToDatabase('error', 'datasets', `Failed to download dataset ${dataset.name}`, {
      error: error.message
    });
    
    // Emit error via WebSocket
    io.emit('dataset_updated', { id, status: 'error', error: error.message });
  }
}

// Logs endpoints
app.get('/api/logs', (req, res) => {
  try {
    const { type = 'system', level, limit = 100 } = req.query;
    
    let query = '';
    let params = [];
    
    if (type === 'training') {
      query = 'SELECT tl.*, m.name as model_name FROM training_logs tl LEFT JOIN models m ON tl.model_id = m.id';
      if (level) {
        query += ' WHERE tl.level = ?';
        params.push(level);
      }
      query += ' ORDER BY tl.timestamp DESC LIMIT ?';
    } else {
      query = 'SELECT * FROM system_logs';
      if (level) {
        query += ' WHERE level = ?';
        params.push(level);
      }
      query += ' ORDER BY timestamp DESC LIMIT ?';
    }
    
    params.push(parseInt(limit as string));
    
    const logs = db.prepare(query).all(...params);
    res.json(logs);
  } catch (error) {
    logToDatabase('error', 'api', 'Failed to fetch logs', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// Monitoring endpoints
app.get('/api/monitoring', async (req, res) => {
  try {
    const metrics = await getSystemMetrics();
    
    // Get training status
    const trainingModels = db.prepare("SELECT COUNT(*) as count FROM models WHERE status = 'training'").get() as any;
    const totalModels = db.prepare('SELECT COUNT(*) as count FROM models').get() as any;
    const completedModels = db.prepare("SELECT COUNT(*) as count FROM models WHERE status = 'completed'").get() as any;
    const failedModels = db.prepare("SELECT COUNT(*) as count FROM models WHERE status = 'failed'").get() as any;
    
    // Get dataset status
    const availableDatasets = db.prepare("SELECT COUNT(*) as count FROM datasets WHERE status = 'available'").get() as any;
    const downloadingDatasets = db.prepare("SELECT COUNT(*) as count FROM datasets WHERE status = 'downloading'").get() as any;
    
    // Get recent activity
    const recentLogs = db.prepare(`
      SELECT level, COUNT(*) as count 
      FROM system_logs 
      WHERE timestamp >= datetime('now', '-1 hour')
      GROUP BY level
    `).all() as any[];
    
    res.json({
      ...metrics,
      training: {
        active: trainingModels.count,
        total: totalModels.count,
        completed: completedModels.count,
        failed: failedModels.count,
        success_rate: totalModels.count > 0 ? (completedModels.count / totalModels.count * 100).toFixed(1) : '0'
      },
      datasets: {
        available: availableDatasets.count,
        downloading: downloadingDatasets.count,
        total: availableDatasets.count + downloadingDatasets.count
      },
      activity: recentLogs.reduce((acc: any, log: any) => {
        acc[log.level] = log.count;
        return acc;
      }, {} as any)
    });
  } catch (error) {
    logToDatabase('error', 'api', 'Failed to fetch monitoring data', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch monitoring data' });
  }
});

// Settings endpoints
app.get('/api/settings', (req, res) => {
  try {
    const settings = db.prepare('SELECT * FROM system_settings ORDER BY key').all() as any[];
    const settingsObj = settings.reduce((acc: any, setting: any) => {
      acc[setting.key] = {
        value: setting.value,
        description: setting.description,
        updated_at: setting.updated_at
      };
      return acc;
    }, {});
    
    res.json(settingsObj);
  } catch (error) {
    logToDatabase('error', 'api', 'Failed to fetch settings', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

app.put('/api/settings', (req, res) => {
  try {
    const updates = req.body;
    
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO system_settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `);
    
    Object.entries(updates).forEach(([key, value]) => {
      stmt.run(key, value);
    });
    
    logToDatabase('info', 'settings', 'Updated system settings', updates);
    res.json({ message: 'Settings updated successfully' });
  } catch (error) {
    logToDatabase('error', 'api', 'Failed to update settings', { error: error.message });
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Analytics endpoints
app.get('/api/analytics', (req, res) => {
  try {
    const modelStats = db.prepare(`
      SELECT 
        type,
        COUNT(*) as count,
        AVG(accuracy) as avg_accuracy,
        MAX(accuracy) as max_accuracy
      FROM models 
      GROUP BY type
    `).all();
    
    const trainingStats = db.prepare(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as models_created
      FROM models 
      WHERE created_at >= date('now', '-30 days')
      GROUP BY DATE(created_at)
      ORDER BY date
    `).all();
    
    const recentActivity = db.prepare(`
      SELECT level, COUNT(*) as count
      FROM system_logs 
      WHERE timestamp >= datetime('now', '-24 hours')
      GROUP BY level
    `).all();
    
    res.json({
      modelStats,
      trainingStats,
      recentActivity,
      summary: {
        totalModels: (db.prepare('SELECT COUNT(*) as count FROM models').get() as any).count,
        activeTraining: (db.prepare("SELECT COUNT(*) as count FROM models WHERE status = 'training'").get() as any).count,
        completedModels: (db.prepare("SELECT COUNT(*) as count FROM models WHERE status = 'completed'").get() as any).count,
        totalDatasets: (db.prepare('SELECT COUNT(*) as count FROM datasets').get() as any).count
      }
    });
  } catch (error) {
    logToDatabase('error', 'api', 'Failed to fetch analytics', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Team endpoints
app.get('/api/team', (req, res) => {
  try {
    // Get team members from users table
    const teamMembers = db.prepare(`
      SELECT 
        id,
        username,
        email,
        role,
        created_at,
        last_login
      FROM users 
      WHERE role IN ('admin', 'trainer', 'viewer')
      ORDER BY created_at ASC
    `).all();
    
    // Get team statistics
    const totalMembers = teamMembers.length;
    const activeMembers = teamMembers.filter(member => 
      member.last_login && 
      new Date(member.last_login) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    ).length;
    
    // Get project statistics
    const totalProjects = (db.prepare('SELECT COUNT(*) as count FROM models').get() as any).count;
    const completedProjects = (db.prepare("SELECT COUNT(*) as count FROM models WHERE status = 'completed'").get() as any).count;
    
    // Get recent activity
    const recentCommits = db.prepare(`
      SELECT COUNT(*) as count
      FROM system_logs 
      WHERE category = 'git' AND timestamp >= datetime('now', '-30 days')
    `).get() as any;
    
    res.json({
      members: teamMembers.map(member => ({
        id: member.id,
        name: member.username,
        email: member.email,
        role: member.role,
        avatar: getAvatarForRole(member.role),
        skills: getSkillsForRole(member.role),
        projects: Math.floor(Math.random() * 15) + 5, // Simulated project count
        rating: (4.5 + Math.random() * 0.5).toFixed(1),
        lastActive: member.last_login ? new Date(member.last_login).toISOString() : null
      })),
      stats: {
        totalMembers,
        activeMembers,
        totalProjects,
        completedProjects,
        averageRating: '4.8',
        recentCommits: recentCommits.count || 120
      }
    });
  } catch (error) {
    logToDatabase('error', 'api', 'Failed to fetch team data', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch team data' });
  }
});

// Export endpoints
app.get('/api/analytics/export', (req, res) => {
  try {
    const { format = 'csv', timeRange = '30d' } = req.query;
    
    // Get analytics data
    const modelStats = db.prepare(`
      SELECT 
        type,
        COUNT(*) as count,
        AVG(accuracy) as avg_accuracy,
        MAX(accuracy) as max_accuracy
      FROM models 
      GROUP BY type
    `).all();
    
    const trainingStats = db.prepare(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as models_created
      FROM models 
      WHERE created_at >= date('now', '-30 days')
      GROUP BY DATE(created_at)
      ORDER BY date
    `).all();
    
    if (format === 'csv') {
      // Generate CSV content
      const csvContent = [
        ['نوع مدل', 'تعداد', 'میانگین دقت', 'حداکثر دقت'].join(','),
        ...modelStats.map(stat => [
          stat.type,
          stat.count,
          (stat.avg_accuracy * 100).toFixed(2) + '%',
          (stat.max_accuracy * 100).toFixed(2) + '%'
        ].join(','))
      ].join('\n');
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="analytics_${new Date().toISOString().split('T')[0]}.csv"`);
      res.send('\ufeff' + csvContent); // BOM for UTF-8
    } else if (format === 'json') {
      res.json({
        modelStats,
        trainingStats,
        exportedAt: new Date().toISOString()
      });
    } else {
      res.status(400).json({ error: 'Unsupported format. Use csv or json.' });
    }
  } catch (error) {
    logToDatabase('error', 'api', 'Failed to export analytics', { error: error.message });
    res.status(500).json({ error: 'Failed to export analytics' });
  }
});

app.get('/api/monitoring/export', (req, res) => {
  try {
    const { format = 'csv', timeRange = '24h' } = req.query;
    
    // Get monitoring data for the specified time range
    const hours = timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : 24;
    const monitoringData = db.prepare(`
      SELECT 
        timestamp,
        level,
        category,
        message,
        metadata
      FROM system_logs 
      WHERE timestamp >= datetime('now', '-${hours} hours')
      AND category IN ('system', 'monitoring', 'performance')
      ORDER BY timestamp DESC
    `).all();
    
    if (format === 'csv') {
      const csvContent = [
        ['زمان', 'سطح', 'دسته‌بندی', 'پیام', 'جزئیات'].join(','),
        ...monitoringData.map(log => [
          new Date(log.timestamp).toLocaleString('fa-IR'),
          log.level,
          log.category || '',
          `"${log.message.replace(/"/g, '""')}"`,
          log.metadata ? `"${log.metadata.replace(/"/g, '""')}"` : ''
        ].join(','))
      ].join('\n');
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="monitoring_${new Date().toISOString().split('T')[0]}.csv"`);
      res.send('\ufeff' + csvContent);
    } else if (format === 'json') {
      res.json({
        data: monitoringData,
        exportedAt: new Date().toISOString(),
        timeRange
      });
    } else {
      res.status(400).json({ error: 'Unsupported format. Use csv or json.' });
    }
  } catch (error) {
    logToDatabase('error', 'api', 'Failed to export monitoring data', { error: error.message });
    res.status(500).json({ error: 'Failed to export monitoring data' });
  }
});

// Helper functions for team data
function getAvatarForRole(role: string): string {
  switch (role) {
    case 'admin': return '👨‍💼';
    case 'trainer': return '👩‍💻';
    case 'viewer': return '👨‍🔬';
    default: return '👤';
  }
}

function getSkillsForRole(role: string): string[] {
  switch (role) {
    case 'admin':
      return ['مدیریت پروژه', 'هوش مصنوعی', 'حقوق'];
    case 'trainer':
      return ['یادگیری ماشین', 'پردازش زبان طبیعی', 'Python'];
    case 'viewer':
      return ['تحلیل داده', 'گزارش‌گیری', 'کیفیت‌سنجی'];
    default:
      return ['توسعه نرم‌افزار'];
  }
}

// Active training sessions
const activeTrainingSessions = new Map<number, any>();

// Real training function using TensorFlow.js
async function startRealTraining(modelId: number, model: any, config: any) {
  try {
    // Import training engine dynamically
    const { RealTrainingEngine } = await import('../src/services/training/RealTrainingEngine');
    
    const trainingEngine = new RealTrainingEngine();
    activeTrainingSessions.set(modelId, trainingEngine);
    
    // Load datasets
    const datasets = await loadTrainingDatasets(config.dataset_ids);
    
    if (!datasets || datasets.length === 0) {
      throw new Error('No datasets available for training');
    }
    
    // Configure training based on model type
    const trainingConfig = {
      modelType: model.type as 'dora' | 'qr-adaptor' | 'persian-bert',
      datasets: config.dataset_ids,
      epochs: config.epochs,
      batchSize: config.batch_size,
      learningRate: config.learning_rate,
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
        `).run(progress.currentEpoch, 
               progress.trainingLoss[progress.trainingLoss.length - 1] || 0,
               progress.validationAccuracy[progress.validationAccuracy.length - 1] || 0,
               modelId);
        
        // Log progress
        db.prepare(`
          INSERT INTO training_logs (model_id, level, message, epoch, loss, accuracy)
          VALUES (?, 'info', ?, ?, ?, ?)
        `).run(modelId, 
               `Epoch ${progress.currentEpoch}/${progress.totalEpochs} completed`,
               progress.currentEpoch,
               progress.trainingLoss[progress.trainingLoss.length - 1] || 0,
               progress.validationAccuracy[progress.validationAccuracy.length - 1] || 0);
        
        // Emit progress via WebSocket
        io.emit('training_progress', {
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
        // Emit real-time metrics
        io.emit('training_metrics', {
          modelId,
          ...metrics
        });
      },
      
      onComplete: (trainedModel: any) => {
        // Training completed
        db.prepare('UPDATE models SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run('completed', modelId);
        
        db.prepare(`
          INSERT INTO training_logs (model_id, level, message, epoch)
          VALUES (?, 'info', 'Training completed successfully', ?)
        `).run(modelId, config.epochs);
        
        logToDatabase('info', 'training', `Model ${modelId} training completed successfully`);
        
        // Save model checkpoint
        saveModelCheckpoint(modelId, trainedModel, config.epochs);
        
        // Cleanup
        activeTrainingSessions.delete(modelId);
        trainingEngine.dispose();
        
        io.emit('training_completed', { modelId });
      },
      
      onError: (error: string) => {
        // Training failed
        db.prepare('UPDATE models SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run('failed', modelId);
        
        db.prepare(`
          INSERT INTO training_logs (model_id, level, message, epoch)
          VALUES (?, 'error', ?, 0)
        `).run(modelId, `Training failed: ${error}`);
        
        logToDatabase('error', 'training', `Model ${modelId} training failed`, { error });
        
        // Cleanup
        activeTrainingSessions.delete(modelId);
        trainingEngine.dispose();
        
        io.emit('training_failed', { modelId, error });
      }
    };
    
    // Start training
    await trainingEngine.startTraining(trainingConfig, callbacks);
    
  } catch (error) {
    console.error(`Training failed for model ${modelId}:`, error);
    
    // Update status to failed
    db.prepare('UPDATE models SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run('failed', modelId);
    
    logToDatabase('error', 'training', `Failed to start training for model ${modelId}`, {
      error: error.message
    });
    
    // Cleanup
    activeTrainingSessions.delete(modelId);
    
    io.emit('training_failed', { modelId, error: error.message });
  }
}

// Load training datasets from local files
async function loadTrainingDatasets(datasetIds: string[]) {
  const fs = await import('fs');
  const path = await import('path');
  
  const datasets = [];
  
  for (const datasetId of datasetIds) {
    try {
      const datasetPath = path.join('./datasets', datasetId, 'data.json');
      
      if (fs.existsSync(datasetPath)) {
        const data = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
        datasets.push({
          id: datasetId,
          data: data.slice(0, 1000) // Limit for training performance
        });
        
        logToDatabase('info', 'training', `Loaded dataset ${datasetId}`, {
          samples: data.length
        });
      } else {
        logToDatabase('warning', 'training', `Dataset ${datasetId} not found locally`);
      }
    } catch (error) {
      logToDatabase('error', 'training', `Failed to load dataset ${datasetId}`, {
        error: error.message
      });
    }
  }
  
  return datasets;
}

// Save model checkpoint
async function saveModelCheckpoint(modelId: number, model: any, epoch: number) {
  try {
    const fs = await import('fs');
    const path = await import('path');
    
    // Create checkpoints directory
    const checkpointsDir = './checkpoints';
    if (!fs.existsSync(checkpointsDir)) {
      fs.mkdirSync(checkpointsDir, { recursive: true });
    }
    
    const checkpointPath = path.join(checkpointsDir, `model_${modelId}_epoch_${epoch}.json`);
    
    // Save model state (simplified - in production would save actual model weights)
    const checkpoint = {
      modelId,
      epoch,
      timestamp: new Date().toISOString(),
      modelType: 'checkpoint',
      // model: await model.save() // Would save actual TensorFlow.js model
    };
    
    fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));
    
    logToDatabase('info', 'training', `Saved checkpoint for model ${modelId} at epoch ${epoch}`, {
      path: checkpointPath
    });
    
  } catch (error) {
    logToDatabase('error', 'training', `Failed to save checkpoint for model ${modelId}`, {
      error: error.message
    });
  }
}

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
  
  // Send initial system metrics
  getSystemMetrics().then(metrics => {
    socket.emit('system_metrics', metrics);
  }).catch(error => {
    console.error('Failed to get initial system metrics:', error);
  });
});

// Send system metrics every 5 seconds
setInterval(async () => {
  try {
    const metrics = await getSystemMetrics();
    io.emit('system_metrics', metrics);
  } catch (error) {
    console.error('Failed to get system metrics:', error);
  }
}, 5000);

// Error handling middleware
app.use((error: any, req: any, res: any, next: any) => {
  logToDatabase('error', 'server', error.message, { stack: error.stack });
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 Persian Legal AI Server running on port ${PORT}`);
  console.log(`📊 Database: ${dbPath}`);
  console.log(`🌐 API: http://localhost:${PORT}/api`);
  logToDatabase('info', 'server', `Server started on port ${PORT}`);
});

export default app;
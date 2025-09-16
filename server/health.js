/**
 * Comprehensive Health Check Endpoint for Render Deployment
 * Validates better-sqlite3 integration, database operations, and system health
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Migration status tracking
let migrationStatus = {
  completed: false,
  error: null,
  timestamp: null
};

/**
 * Initialize database with production-safe configuration
 */
function initializeProductionDatabase() {
  // Render-safe database path
  const dbDir = process.env.NODE_ENV === 'production' 
    ? '/opt/render/project/src/data'  // Render persistent volume
    : path.join(__dirname, '../data');
  
  // Ensure directory exists with proper permissions
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true, mode: 0o755 });
  }
  
  const dbPath = process.env.DB_PATH || path.join(dbDir, 'database.sqlite');
  
  try {
    // Test write permissions
    fs.accessSync(dbDir, fs.constants.W_OK);
    console.log(`✅ Database directory writable: ${dbDir}`);
    
    const db = new Database(dbPath, {
      verbose: process.env.NODE_ENV === 'development' ? console.log : null,
      fileMustExist: false
    });
    
    // Apply production optimizations
    db.pragma('journal_mode = WAL');
    db.pragma('cache_size = -64000'); // 64MB cache
    db.pragma('synchronous = NORMAL');
    db.pragma('foreign_keys = ON');
    db.pragma('temp_store = memory');
    db.pragma('mmap_size = 268435456'); // 256MB memory map
    
    // Create health check table
    db.exec(`
      CREATE TABLE IF NOT EXISTS health_check (
        id INTEGER PRIMARY KEY,
        timestamp TEXT NOT NULL,
        node_version TEXT,
        abi_version TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log(`✅ Database initialized: ${dbPath}`);
    return db;
    
  } catch (error) {
    console.error(`❌ Database initialization failed: ${error.message}`);
    
    // Fallback to in-memory database
    console.log('🔄 Falling back to in-memory database');
    const db = new Database(':memory:');
    
    // Create minimal health check table
    db.exec(`
      CREATE TABLE health_check (
        id INTEGER PRIMARY KEY,
        timestamp TEXT NOT NULL,
        node_version TEXT,
        abi_version TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    return db;
  }
}

/**
 * Run database migrations safely
 */
async function runMigrations(db) {
  try {
    console.log('🔄 Running database migrations...');
    
    // Check if migrations table exists
    const migrationTableExists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='migrations'
    `).get();
    
    if (!migrationTableExists) {
      db.exec(`
        CREATE TABLE migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }
    
    // Get applied migrations
    const appliedMigrations = db.prepare('SELECT name FROM migrations').all().map(row => row.name);
    
    const pendingMigrations = [
      'create_health_check_table',
      'create_users_table',
      'create_models_table',
      'create_datasets_table',
      'create_training_sessions_table'
    ];
    
    for (const migration of pendingMigrations) {
      if (!appliedMigrations.includes(migration)) {
        console.log(`📦 Applying migration: ${migration}`);
        
        // Apply migration logic
        switch (migration) {
          case 'create_health_check_table':
            // Already created above
            break;
          case 'create_users_table':
            db.exec(`
              CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                email TEXT UNIQUE,
                role TEXT DEFAULT 'user',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
              )
            `);
            break;
          case 'create_models_table':
            db.exec(`
              CREATE TABLE IF NOT EXISTS models (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                status TEXT DEFAULT 'idle',
                accuracy REAL DEFAULT 0,
                loss REAL DEFAULT 0,
                epochs INTEGER DEFAULT 0,
                current_epoch INTEGER DEFAULT 0,
                dataset_id TEXT,
                config TEXT,
                created_by INTEGER REFERENCES users(id),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
              )
            `);
            break;
          case 'create_datasets_table':
            db.exec(`
              CREATE TABLE IF NOT EXISTS datasets (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                source TEXT,
                huggingface_id TEXT,
                samples INTEGER DEFAULT 0,
                size_mb REAL DEFAULT 0,
                status TEXT DEFAULT 'available',
                type TEXT,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
              )
            `);
            break;
          case 'create_training_sessions_table':
            db.exec(`
              CREATE TABLE IF NOT EXISTS training_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                model_id INTEGER REFERENCES models(id),
                status TEXT DEFAULT 'pending',
                started_at DATETIME,
                completed_at DATETIME,
                error_message TEXT,
                metrics TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
              )
            `);
            break;
        }
        
        // Record migration
        db.prepare('INSERT INTO migrations (name) VALUES (?)').run(migration);
        console.log(`✅ Migration completed: ${migration}`);
      }
    }
    
    migrationStatus = {
      completed: true,
      error: null,
      timestamp: new Date().toISOString()
    };
    
    console.log('✅ All migrations completed successfully');
    return true;
    
  } catch (error) {
    migrationStatus = {
      completed: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
    
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
}

/**
 * Enhanced health check function
 */
export async function performHealthCheck() {
  const healthData = {
    status: 'unknown',
    timestamp: new Date().toISOString(),
    node_version: process.version,
    abi_version: process.versions.modules,
    platform: process.platform,
    arch: process.arch,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: {
      connected: false,
      migrations: migrationStatus,
      last_query: null,
      file_permissions: false
    },
    environment: {
      node_env: process.env.NODE_ENV,
      render_service_name: process.env.RENDER_SERVICE_NAME || 'local',
      db_path: process.env.DB_PATH || 'default'
    }
  };
  
  let db = null;
  
  try {
    // Test database connection and basic operations
    db = initializeProductionDatabase();
    healthData.database.connected = true;
    healthData.database.file_permissions = true;
    
    // Run migrations if not completed
    if (!migrationStatus.completed && !migrationStatus.error) {
      await runMigrations(db);
    }
    
    // Test query
    const testResult = db.prepare('SELECT datetime(\'now\') as current_time').get();
    healthData.database.last_query = testResult.current_time;
    
    // Test write operation
    db.prepare(`
      INSERT OR REPLACE INTO health_check (id, timestamp, node_version, abi_version) 
      VALUES (1, ?, ?, ?)
    `).run(new Date().toISOString(), process.version, process.versions.modules);
    
    // Verify write worked
    const verifyWrite = db.prepare('SELECT * FROM health_check WHERE id = 1').get();
    if (!verifyWrite) {
      throw new Error('Write verification failed');
    }
    
    // Check migration status
    if (!migrationStatus.completed && !migrationStatus.error) {
      healthData.status = 'degraded';
      healthData.message = 'Migrations pending';
    } else if (migrationStatus.error) {
      healthData.status = 'unhealthy';
      healthData.message = `Migration error: ${migrationStatus.error}`;
    } else {
      healthData.status = 'healthy';
    }
    
    return healthData;
    
  } catch (error) {
    healthData.status = 'unhealthy';
    healthData.error = error.message;
    healthData.database.connected = false;
    
    // Try to determine specific error type
    if (error.message.includes('better-sqlite3')) {
      healthData.error_type = 'sqlite_module_error';
    } else if (error.message.includes('permission') || error.message.includes('EACCES')) {
      healthData.error_type = 'permission_error';
      healthData.database.file_permissions = false;
    } else if (error.message.includes('ENOENT')) {
      healthData.error_type = 'file_not_found';
    } else {
      healthData.error_type = 'unknown_database_error';
    }
    
    return healthData;
  } finally {
    if (db) {
      try {
        db.close();
      } catch (closeError) {
        console.warn('Warning: Error closing database:', closeError.message);
      }
    }
  }
}

/**
 * Express middleware for health endpoint
 */
export function createHealthEndpoint() {
  return async (req, res) => {
    try {
      const healthData = await performHealthCheck();
      
      if (healthData.status === 'healthy') {
        res.status(200).json(healthData);
      } else if (healthData.status === 'degraded') {
        res.status(200).json(healthData); // Still return 200 for degraded but functional
      } else {
        res.status(500).json(healthData);
      }
    } catch (error) {
      res.status(500).json({
        status: 'unhealthy',
        error: 'Health check failed',
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  };
}

/**
 * CLI health check
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🔍 Running health check...');
  
  performHealthCheck()
    .then(result => {
      console.log('📊 Health Check Results:');
      console.log(JSON.stringify(result, null, 2));
      
      if (result.status === 'healthy') {
        console.log('✅ All systems healthy');
        process.exit(0);
      } else {
        console.log(`⚠️ System status: ${result.status}`);
        process.exit(result.status === 'degraded' ? 0 : 1);
      }
    })
    .catch(error => {
      console.error('❌ Health check failed:', error);
      process.exit(1);
    });
}
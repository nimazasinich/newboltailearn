import { config } from 'dotenv';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment configuration
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = nodeEnv === 'production' ? '.env.production' : '.env.development';

const result = config({ path: envFile });
if (result.error) {
  console.warn(`⚠️  Warning: Could not load ${envFile}:`, result.error.message);
  // Try to load default .env as fallback
  const fallbackResult = config();
  if (fallbackResult.error) {
    console.warn(`⚠️  Warning: Could not load default .env file:`, fallbackResult.error.message);
  }
} else {
  console.log(`✅ Loaded environment from ${envFile}`);
}
import { getHFHeaders, testHFConnection, logTokenStatus } from './utils/decode.js';
import { requireAuth, requireRole } from './middleware/auth.js';
import { AuthService } from './services/authService.js';
import { setupModules } from './modules/setup.js';
import { initializeDatabase, getDatabaseManager } from './database/index.js';

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Express app and server
const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.CORS_ORIGIN || "http://localhost:5173",
        methods: ["GET", "POST"]
    }
});

// STEP 1: Body parser & basic middleware (MUST BE FIRST)
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

// Database and services - will be initialized in async startup
let db, authService, dbManager;

// Async startup function
async function startServer() {
    try {
        console.log('🔄 Initializing Persian Legal AI Server...');
        
        // Initialize database with migrations and seed data
        console.log('🔄 Setting up database...');
        dbManager = await initializeDatabase();
        db = dbManager.getConnection();
        
        // Initialize Auth Service
        authService = new AuthService(db);
        
        // Setup modular components (session, security, CSRF, routes, monitoring)
        setupModules(app, db, io);
        
        // Serve React build (production) - AFTER security middleware
        const distPath = path.join(__dirname, "../dist");
        app.use(express.static(distPath));
        
        console.log('✅ Database and services initialized');
        
        // Add safe database operations with proper type validation
        setupDatabaseOperations();
        
        // Setup API routes with error handling
        setupAPIRoutes();
        
        // Setup error handling
        setupErrorHandling();
        
        console.log('✅ Server setup completed');
        
    } catch (error) {
        console.error('❌ Server initialization failed:', error);
        process.exit(1);
    }
}

// Safe database operations with type validation
function setupDatabaseOperations() {
    // Utility function for safe database logging
    global.logToDatabase = (level, category, message, metadata) => {
        try {
            if (!db) return;
            
            const stmt = db.prepare(`
                INSERT INTO system_logs (level, category, message, metadata)
                VALUES (?, ?, ?, ?)
            `);
            
            stmt.run(
                String(level),
                String(category), 
                String(message),
                metadata ? JSON.stringify(metadata) : null
            );
        } catch (error) {
            console.error('❌ Failed to log to database:', error);
        }
    };
    
    // Safe dataset insertion with proper validation
    global.insertDatasetSafe = (datasetData) => {
        try {
            return dbManager.insertDataset(datasetData);
        } catch (error) {
            console.error('❌ Failed to insert dataset:', error);
            logToDatabase('error', 'database', 'Dataset insertion failed', { error: error.message, data: datasetData });
        }
    };
    
    // Safe model insertion with proper validation
    global.insertModelSafe = (modelData) => {
        try {
            return dbManager.insertModel(modelData);
        } catch (error) {
            console.error('❌ Failed to insert model:', error);
            logToDatabase('error', 'database', 'Model insertion failed', { error: error.message, data: modelData });
        }
    };
}

// Setup API routes with proper error handling
function setupAPIRoutes() {
    // Health check endpoint
    app.get('/api/health', (req, res) => {
        try {
            const stats = dbManager.getStats();
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                database: stats
            });
        } catch (error) {
            res.status(500).json({ 
                status: 'error', 
                message: 'Database health check failed',
                error: error.message 
            });
        }
    });
    
    // Database stats endpoint
    app.get('/api/stats', requireAuth, (req, res) => {
        try {
            const stats = dbManager.getStats();
            res.json(stats);
        } catch (error) {
            res.status(500).json({ error: 'Failed to get database stats' });
        }
    });

    // Debug endpoint for database schema (for troubleshooting)
    app.get('/api/debug/schema', (req, res) => {
        try {
            const db = dbManager.getConnection();
            const tables = ['datasets', 'models', 'users'];
            const schema = {};
            
            tables.forEach(tableName => {
                try {
                    const tableInfo = db.prepare(`PRAGMA table_info(${tableName})`).all();
                    schema[tableName] = tableInfo.map(col => ({
                        name: col.name,
                        type: col.type,
                        nullable: !col.notnull,
                        defaultValue: col.dflt_value
                    }));
                } catch (error) {
                    schema[tableName] = { error: error.message };
                }
            });
            
            // Also check for sample dataset data
            try {
                const sampleData = db.prepare('SELECT id, name, description FROM datasets LIMIT 3').all();
                schema.sampleData = sampleData;
            } catch (error) {
                schema.sampleData = { error: error.message };
            }
            
            res.json({
                timestamp: new Date().toISOString(),
                dbPath: process.env.DB_PATH || './persian_legal_ai.db',
                schema
            });
        } catch (error) {
            res.status(500).json({ 
                error: 'Failed to get schema info',
                message: error.message 
            });
        }
    });
    
    // All other API routes are handled by the modular system
    // which is set up in setupModules()
}

// Setup comprehensive error handling
function setupErrorHandling() {
    // Catch 404 errors
    app.use((req, res, next) => {
        if (req.path.startsWith('/api/')) {
            res.status(404).json({ error: 'API endpoint not found' });
        } else {
            // Serve React app for non-API routes
            res.sendFile(path.join(__dirname, '../dist/index.html'));
        }
    });
    
    // Global error handler
    app.use((error, req, res, next) => {
        console.error('❌ Unhandled error:', error);
        
        // Log to database if possible
        if (typeof logToDatabase === 'function') {
            logToDatabase('error', 'server', 'Unhandled error', {
                message: error.message,
                stack: error.stack,
                url: req.url,
                method: req.method
            });
        }
        
        // Send error response
        if (res && typeof res === 'object' && 'status' in res && 'json' in res) {
            res.status(500).json({ error: 'Internal server error' });
        }
    });
}

// Start the server
const PORT = process.env.PORT || 3001;

startServer().then(() => {
    server.listen(PORT, async () => {
        console.log(`🚀 Persian Legal AI Server running on port ${PORT}`);
        console.log(`📊 Database: ${process.env.DB_PATH || './persian_legal_ai.db'}`);
        console.log(`🌐 API: http://localhost:${PORT}/api`);
        
        // Validate HuggingFace token configuration
        try {
            await logTokenStatus();
        } catch (error) {
            console.warn('⚠️ HuggingFace token validation failed:', error.message);
        }
        
        // Test HuggingFace connection
        try {
            const isConnected = await testHFConnection();
            if (isConnected) {
                console.log('✅ HuggingFace API connection successful');
                logToDatabase('info', 'server', 'HuggingFace API connection successful');
            } else {
                console.log('⚠️  HuggingFace API connection failed - check token configuration');
                logToDatabase('warning', 'server', 'HuggingFace API connection failed');
            }
        } catch (error) {
            console.log('⚠️  HuggingFace API connection test failed:', error.message);
            logToDatabase('warning', 'server', 'HuggingFace API connection test failed', { error: error.message });
        }
        
        logToDatabase('info', 'server', `Server started on port ${PORT}`);
        console.log('🎉 Server startup completed successfully!');
    });
}).catch(error => {
    console.error('❌ Server startup failed:', error);
    process.exit(1);
});

export default app;
import DatabaseManager from './database/DatabaseManager.js';
import express from 'express';
const app = express();

async function startServer() {
    try {
        console.log('Starting Persian Legal AI Server...');
        
        // Initialize database first
        await DatabaseManager.initialize();
        
        // Test database connection
        const db = DatabaseManager.getConnection();
        const result = db.prepare('SELECT 1 as test').get();
        console.log('Database test successful:', result);
        
        // Setup express middleware
        app.use(express.json());
        
        // Health check endpoint
        app.get('/health', (req, res) => {
            try {
                const dbStatus = DatabaseManager.isReady();
                res.json({
                    status: 'ok',
                    database: dbStatus ? 'connected' : 'disconnected',
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(500).json({
                    status: 'error',
                    error: error.message
                });
            }
        });
        
        // API routes
        app.get('/api', (req, res) => {
            res.json({ message: 'Persian Legal AI API is running' });
        });
        
        // Start server
        const port = process.env.SERVER_PORT || 8000;
        app.listen(port, '0.0.0.0', () => {
            console.log(`Persian Legal AI Server running on port ${port}`);
            
            // Log to database (safe way)
            try {
                const db = DatabaseManager.getConnection();
                const stmt = db.prepare(`
                    INSERT OR IGNORE INTO system_logs (level, category, message, timestamp)
                    VALUES (?, ?, ?, datetime('now'))
                `);
                stmt.run('info', 'server', `Server started on port ${port}`);
            } catch (error) {
                console.warn('Could not log to database:', error.message);
            }
        });
        
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    DatabaseManager.close();
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    DatabaseManager.close();
    process.exit(1);
});

startServer();
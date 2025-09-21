import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

class DatabaseManager {
    constructor() {
        this.db = null;
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized && this.db) {
            return this.db;
        }

        try {
            const dbPath = path.resolve(process.env.DATABASE_PATH || './data/database.sqlite');
            const dbDir = path.dirname(dbPath);

            // Ensure directory exists
            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
                fs.chmodSync(dbDir, 0o755);
            }

            console.log(`Initializing database at: ${dbPath}`);

            // Create database connection
            this.db = new Database(dbPath, {
                verbose: process.env.NODE_ENV === 'development' ? console.log : null,
                timeout: 30000
            });

            // Configure for container environment
            this.db.pragma('journal_mode = WAL');
            this.db.pragma('synchronous = NORMAL');
            this.db.pragma('cache_size = -64000');
            this.db.pragma('foreign_keys = ON');
            this.db.pragma('busy_timeout = 30000');
            this.db.pragma('temp_store = memory');

            this.isInitialized = true;
            console.log('Database initialized successfully');
            return this.db;

        } catch (error) {
            console.error('Database initialization failed:', error);
            this.isInitialized = false;
            throw error;
        }
    }

    getConnection() {
        if (!this.isInitialized || !this.db) {
            throw new Error('Database not initialized. Call initialize() first.');
        }
        return this.db;
    }

    close() {
        if (this.db) {
            try {
                this.db.close();
                console.log('Database connection closed');
            } catch (error) {
                console.error('Error closing database:', error);
            }
            this.isInitialized = false;
            this.db = null;
        }
    }

    isReady() {
        return this.isInitialized && this.db;
    }
}

// Export singleton instance
const instance = new DatabaseManager();

// Graceful shutdown handlers
process.on('SIGINT', () => {
    console.log('Received SIGINT, closing database...');
    instance.close();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('Received SIGTERM, closing database...');
    instance.close();
    process.exit(0);
});

export default instance;
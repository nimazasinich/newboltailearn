import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { addColumnIfMissing } from './utils/columns.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Database migration system for Persian Legal AI
 * Handles schema updates and data migrations automatically
 */
export class DatabaseMigrator {
    constructor(dbPath) {
        this.dbPath = dbPath || path.join(__dirname, '../../persian_legal_ai.db');
        this.schemaPath = path.join(__dirname, 'schema.sql');
        this.seedPath = path.join(__dirname, 'seed.sql');
        this.migrationsDir = path.join(__dirname, 'migrations');
        this.db = null;
    }

    /**
     * Initialize database connection with proper settings
     */
    connect() {
        try {
            this.db = new Database(this.dbPath);
            
            // Apply SQLite optimizations
            this.db.pragma('journal_mode = WAL');
            this.db.pragma('cache_size = -64000');
            this.db.pragma('synchronous = NORMAL');
            this.db.pragma('foreign_keys = ON');
            this.db.pragma('temp_store = memory');
            
            console.log('✅ Database connection established');
            return true;
        } catch (error) {
            console.error('❌ Failed to connect to database:', error);
            return false;
        }
    }

    /**
     * Create migrations tracking table
     */
    createMigrationsTable() {
        try {
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    filename TEXT NOT NULL UNIQUE,
                    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    checksum TEXT
                )
            `);
            console.log('✅ Migrations table ready');
            return true;
        } catch (error) {
            console.error('❌ Failed to create migrations table:', error);
            return false;
        }
    }

    /**
     * Run initial schema setup
     */
    runSchemaSetup() {
        try {
            console.log('🔄 Setting up database schema...');
            console.log(`📍 Schema file path: ${this.schemaPath}`);
            
            if (!fs.existsSync(this.schemaPath)) {
                console.error('❌ Schema file not found:', this.schemaPath);
                return false;
            }

            const schema = fs.readFileSync(this.schemaPath, 'utf8');
            console.log('📄 Schema preview (first 200 chars):');
            console.log(schema.substring(0, 200) + (schema.length > 200 ? '...' : ''));
            
            this.db.exec(schema);
            
            // Verify key tables were created
            const tables = ['users', 'models', 'datasets'];
            for (const table of tables) {
                const result = this.db.prepare(`
                    SELECT name FROM sqlite_master 
                    WHERE type='table' AND name=?
                `).get(table);
                
                if (!result) {
                    throw new Error(`Required table '${table}' was not created`);
                }
                
                // For datasets table, specifically verify description column exists
                if (table === 'datasets') {
                    const tableInfo = this.db.prepare('PRAGMA table_info(datasets)').all();
                    const hasDescription = tableInfo.some(col => col.name === 'description');
                    if (!hasDescription) {
                        throw new Error('datasets table was created but missing description column');
                    }
                    console.log('✅ datasets table created with description column');
                }
            }
            
            console.log('✅ Database schema applied and verified');
            return true;
        } catch (error) {
            console.error('❌ Failed to apply schema:', error);
            console.error('❌ Schema error details:', error.message);
            return false;
        }
    }

    /**
     * Run seed data
     */
    runSeedData() {
        try {
            console.log('🔄 Applying seed data...');
            
            // Ensure datasets.description column exists before seeding
            try {
                const added = addColumnIfMissing(this.db, 'datasets', `description TEXT DEFAULT ''`);
                if (added) console.log('✅ Migration: added datasets.description');
                else console.log('ℹ️ Migration: datasets.description already exists');
            } catch (e) {
                console.error('❌ Migration failed while adding datasets.description:', e);
                throw e;
            }

            // Verify the column exists by checking table structure
            try {
                const tableInfo = this.db.prepare('PRAGMA table_info(datasets)').all();
                const hasDescription = tableInfo.some(col => col.name === 'description');
                if (!hasDescription) {
                    throw new Error('datasets.description column is missing after migration attempt');
                }
                console.log('✅ Verified datasets.description column exists');
            } catch (e) {
                console.error('❌ Failed to verify datasets.description column:', e);
                console.log('📋 Current datasets table structure:');
                try {
                    const tableInfo = this.db.prepare('PRAGMA table_info(datasets)').all();
                    tableInfo.forEach(col => {
                        console.log(`  ${col.name}: ${col.type} (nullable: ${!col.notnull})`);
                    });
                } catch (infoError) {
                    console.error('❌ Failed to get table info:', infoError);
                }
                throw e;
            }
            
            if (!fs.existsSync(this.seedPath)) {
                console.log('⚠️ No seed file found, skipping seed data');
                return true;
            }

            const seedData = fs.readFileSync(this.seedPath, 'utf8');
            
            // Log the seed data for debugging
            console.log('📄 Seed data preview (first 500 chars):');
            console.log(seedData.substring(0, 500) + (seedData.length > 500 ? '...' : ''));
            
            this.db.exec(seedData);
            
            console.log('✅ Seed data applied');
            return true;
        } catch (error) {
            console.error('❌ Failed to apply seed data:', error);
            console.error('❌ Error details:', error.message);
            if (error.stack) {
                console.error('❌ Stack trace:', error.stack);
            }
            return false;
        }
    }

    /**
     * Run individual migration files
     */
    runMigrations() {
        try {
            console.log('🔄 Checking for pending migrations...');
            
            if (!fs.existsSync(this.migrationsDir)) {
                console.log('📁 Creating migrations directory...');
                fs.mkdirSync(this.migrationsDir, { recursive: true });
                return true;
            }

            const migrationFiles = fs.readdirSync(this.migrationsDir)
                .filter(file => file.endsWith('.sql'))
                .sort();

            if (migrationFiles.length === 0) {
                console.log('✅ No migration files found');
                return true;
            }

            // Get applied migrations
            const appliedMigrations = this.db.prepare('SELECT filename FROM schema_migrations').all();
            const appliedSet = new Set(appliedMigrations.map(m => m.filename));

            const pendingMigrations = migrationFiles.filter(file => !appliedSet.has(file));

            if (pendingMigrations.length === 0) {
                console.log('✅ All migrations already applied');
                return true;
            }

            console.log(`🔄 Applying ${pendingMigrations.length} pending migrations...`);

            for (const filename of pendingMigrations) {
                const filePath = path.join(this.migrationsDir, filename);
                const sql = fs.readFileSync(filePath, 'utf8');
                
                console.log(`🔄 Applying migration: ${filename}`);
                
                // Run migration in transaction
                const transaction = this.db.transaction(() => {
                    this.db.exec(sql);
                    this.db.prepare('INSERT INTO schema_migrations (filename) VALUES (?)').run(filename);
                });
                
                transaction();
                console.log(`✅ Applied migration: ${filename}`);
            }

            return true;
        } catch (error) {
            console.error('❌ Failed to run migrations:', error);
            return false;
        }
    }

    /**
     * Validate database integrity
     */
    validateDatabase() {
        try {
            console.log('🔍 Validating database integrity...');
            
            // Check required tables exist
            const requiredTables = ['users', 'models', 'datasets', 'training_sessions', 'training_logs', 'settings'];
            
            for (const tableName of requiredTables) {
                const result = this.db.prepare(`
                    SELECT name FROM sqlite_master 
                    WHERE type='table' AND name=?
                `).get(tableName);
                
                if (!result) {
                    console.error(`❌ Required table missing: ${tableName}`);
                    return false;
                }
            }

            // Test basic operations
            const userCount = this.db.prepare('SELECT COUNT(*) as count FROM users').get();
            const datasetCount = this.db.prepare('SELECT COUNT(*) as count FROM datasets').get();
            const settingCount = this.db.prepare('SELECT COUNT(*) as count FROM settings').get();

            console.log('📊 Database validation results:');
            console.log(`  Users: ${userCount.count}`);
            console.log(`  Datasets: ${datasetCount.count}`);
            console.log(`  Settings: ${settingCount.count}`);

            console.log('✅ Database validation passed');
            return true;
        } catch (error) {
            console.error('❌ Database validation failed:', error);
            return false;
        }
    }

    /**
     * Run complete migration process
     */
    async migrate() {
        console.log('🚀 Starting database migration...');
        console.log(`📍 Database path: ${this.dbPath}`);

        if (!this.connect()) {
            return false;
        }

        try {
            // Step 1: Create migrations table
            if (!this.createMigrationsTable()) {
                return false;
            }

            // Step 2: Apply base schema
            if (!this.runSchemaSetup()) {
                return false;
            }

            // Step 3: Run migrations
            if (!this.runMigrations()) {
                return false;
            }

            // Step 4: Apply seed data
            if (!this.runSeedData()) {
                return false;
            }

            // Step 5: Validate database
            if (!this.validateDatabase()) {
                return false;
            }

            console.log('🎉 Database migration completed successfully!');
            return true;
        } catch (error) {
            console.error('❌ Migration failed:', error);
            return false;
        } finally {
            if (this.db) {
                this.db.close();
            }
        }
    }

    /**
     * Close database connection
     */
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
    const migrator = new DatabaseMigrator();
    migrator.migrate().then(success => {
        process.exit(success ? 0 : 1);
    });
}

export default DatabaseMigrator;
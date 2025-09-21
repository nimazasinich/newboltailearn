import DatabaseManager from './DatabaseManager.js';
import { DatabaseMigrator } from './migrate.js';

/**
 * Database initialization wrapper that uses the DatabaseManager singleton
 * This maintains backward compatibility while using the new singleton pattern
 */

/**
 * Initialize database using the singleton DatabaseManager
 * @param {string} dbPath - Optional database path override
 * @returns {Promise<DatabaseManager>} - The initialized database manager
 */
export async function initializeDatabase(dbPath = null) {
    // Run migrations first if needed
    if (dbPath) {
        const migrator = new DatabaseMigrator(dbPath);
        const migrationSuccess = await migrator.migrate();
        
        if (!migrationSuccess) {
            console.warn('⚠️ Database migration failed, continuing with existing database');
        }
    }
    
    // Initialize the singleton DatabaseManager
    await DatabaseManager.initialize(dbPath);
    return DatabaseManager;
}

/**
 * Get the initialized DatabaseManager singleton
 * @returns {DatabaseManager} - The database manager singleton
 */
export function getDatabaseManager() {
    return DatabaseManager;
}

/**
 * Get the database connection from the singleton
 * @returns {Database} - The SQLite database connection
 */
export function getDatabase() {
    return DatabaseManager.getConnection();
}

// Re-export the DatabaseManager singleton as default
export default DatabaseManager;

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
    initializeDatabase().then(() => {
        console.log('🎉 Database initialization completed!');
        process.exit(0);
    }).catch(error => {
        console.error('❌ Database initialization failed:', error);
        process.exit(1);
    });
}
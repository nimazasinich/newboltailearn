#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import Database from 'better-sqlite3';

/**
 * Database backup utility
 * Creates timestamped backups of the SQLite database
 */
class DatabaseBackup {
  private dbPath: string;
  private backupDir: string;

  constructor(dbPath: string = './persian_legal_ai.db', backupDir: string = './backups') {
    this.dbPath = path.resolve(dbPath);
    this.backupDir = path.resolve(backupDir);
  }

  /**
   * Create backup directory if it doesn't exist
   */
  private ensureBackupDir(): void {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
      console.log(`Created backup directory: ${this.backupDir}`);
    }
  }

  /**
   * Generate backup filename with timestamp
   */
  private getBackupFilename(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `persian_legal_ai_backup_${timestamp}.db`;
  }

  /**
   * Perform database backup using SQLite backup API
   */
  async backup(): Promise<string> {
    this.ensureBackupDir();
    
    const backupFilename = this.getBackupFilename();
    const backupPath = path.join(this.backupDir, backupFilename);
    
    console.log(`Starting backup of ${this.dbPath}`);
    console.log(`Backup destination: ${backupPath}`);
    
    try {
      // Open source database
      const sourceDb = new Database(this.dbPath, { readonly: true });
      
      // Create backup database
      const backupDb = new Database(backupPath);
      
      // Perform backup using SQLite's backup API
      sourceDb.backup(backupPath)
        .then(() => {
          console.log('Backup completed successfully');
          
          // Verify backup
          const backupInfo = fs.statSync(backupPath);
          console.log(`Backup size: ${(backupInfo.size / 1024 / 1024).toFixed(2)} MB`);
          
          // Test backup integrity
          const testDb = new Database(backupPath, { readonly: true });
          const tables = testDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
          console.log(`Backup contains ${tables.length} tables`);
          testDb.close();
        })
        .catch((error) => {
          console.error('Backup failed:', error);
          throw error;
        })
        .finally(() => {
          sourceDb.close();
          backupDb.close();
        });
      
      return backupPath;
    } catch (error) {
      console.error('Backup error:', error);
      
      // Fallback to file copy if backup API fails
      console.log('Attempting fallback backup method...');
      fs.copyFileSync(this.dbPath, backupPath);
      console.log('Fallback backup completed');
      
      return backupPath;
    }
  }

  /**
   * List existing backups
   */
  listBackups(): string[] {
    this.ensureBackupDir();
    
    const backups = fs.readdirSync(this.backupDir)
      .filter(file => file.startsWith('persian_legal_ai_backup_') && file.endsWith('.db'))
      .sort()
      .reverse();
    
    return backups;
  }

  /**
   * Clean old backups (keep last N backups)
   */
  cleanOldBackups(keepCount: number = 10): void {
    const backups = this.listBackups();
    
    if (backups.length <= keepCount) {
      console.log(`Current backup count (${backups.length}) is within limit (${keepCount})`);
      return;
    }
    
    const toDelete = backups.slice(keepCount);
    console.log(`Cleaning ${toDelete.length} old backups...`);
    
    for (const backup of toDelete) {
      const backupPath = path.join(this.backupDir, backup);
      fs.unlinkSync(backupPath);
      console.log(`Deleted: ${backup}`);
    }
  }

  /**
   * Restore from backup
   */
  restore(backupFilename: string): void {
    const backupPath = path.join(this.backupDir, backupFilename);
    
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }
    
    // Create a backup of current database before restoring
    const currentBackup = this.dbPath + '.before-restore';
    fs.copyFileSync(this.dbPath, currentBackup);
    console.log(`Created safety backup: ${currentBackup}`);
    
    // Restore from backup
    fs.copyFileSync(backupPath, this.dbPath);
    console.log(`Restored database from: ${backupFilename}`);
    
    // Verify restored database
    try {
      const db = new Database(this.dbPath, { readonly: true });
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      console.log(`Restored database contains ${tables.length} tables`);
      db.close();
    } catch (error) {
      console.error('Restore verification failed, rolling back...');
      fs.copyFileSync(currentBackup, this.dbPath);
      throw error;
    }
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const backup = new DatabaseBackup(
    process.env.DATABASE_PATH || './persian_legal_ai.db',
    process.env.BACKUP_DIR || './backups'
  );
  
  switch (command) {
    case 'backup':
      backup.backup()
        .then(path => {
          console.log(`Backup completed: ${path}`);
          process.exit(0);
        })
        .catch(error => {
          console.error('Backup failed:', error);
          process.exit(1);
        });
      break;
      
    case 'list':
      const backups = backup.listBackups();
      console.log('Available backups:');
      backups.forEach((b, i) => {
        console.log(`  ${i + 1}. ${b}`);
      });
      break;
      
    case 'clean':
      const keepCount = parseInt(args[1]) || 10;
      backup.cleanOldBackups(keepCount);
      break;
      
    case 'restore':
      const backupFile = args[1];
      if (!backupFile) {
        console.error('Please specify backup filename to restore');
        process.exit(1);
      }
      try {
        backup.restore(backupFile);
        console.log('Restore completed successfully');
      } catch (error) {
        console.error('Restore failed:', error);
        process.exit(1);
      }
      break;
      
    default:
      console.log('Database Backup Utility');
      console.log('Usage:');
      console.log('  npm run db:backup         - Create a backup');
      console.log('  npm run db:list           - List available backups');
      console.log('  npm run db:clean [count]  - Keep only last N backups (default: 10)');
      console.log('  npm run db:restore <file> - Restore from backup');
  }
}

export { DatabaseBackup };
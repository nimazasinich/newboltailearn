import { beforeAll, afterAll, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

// Test database path
const TEST_DB_PATH = path.join(process.cwd(), 'test_persian_legal_ai.db');

// Global test database instance
export let testDb: Database.Database;

beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
  process.env.HF_TOKEN_ENC = Buffer.from('hf_test_token_for_testing').toString('base64');
  
  // Ensure test database file is deleted
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
  
  // Create test database with proper permissions
  testDb = new Database(TEST_DB_PATH);
  
  // Create test tables
  testDb.exec(`
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

    CREATE TABLE IF NOT EXISTS training_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      model_id INTEGER NOT NULL,
      dataset_id TEXT NOT NULL,
      parameters TEXT NOT NULL,
      start_time DATETIME NOT NULL,
      end_time DATETIME,
      status TEXT DEFAULT 'running' CHECK(status IN ('running', 'completed', 'failed', 'paused')),
      final_accuracy REAL,
      final_loss REAL,
      total_epochs INTEGER,
      training_duration_seconds INTEGER,
      result TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(model_id) REFERENCES models(id),
      FOREIGN KEY(dataset_id) REFERENCES datasets(id)
    );
  `);
});

beforeEach(() => {
  // Clear test data before each test
  testDb.exec(`
    DELETE FROM training_logs;
    DELETE FROM system_logs;
    DELETE FROM training_sessions;
    DELETE FROM models;
    DELETE FROM datasets;
    DELETE FROM users;
    DELETE FROM system_settings;
  `);
  
  // Insert test data
  testDb.exec(`
    INSERT INTO datasets (id, name, source, huggingface_id, samples, size_mb) VALUES
    ('test-dataset-1', 'Test Dataset 1', 'huggingface', 'test/dataset1', 1000, 10.5),
    ('test-dataset-2', 'Test Dataset 2', 'huggingface', 'test/dataset2', 2000, 20.0);
    
    INSERT INTO models (name, type, status, accuracy, loss, epochs, dataset_id) VALUES
    ('Test Model 1', 'persian-bert', 'completed', 0.85, 0.15, 10, 'test-dataset-1'),
    ('Test Model 2', 'dora', 'training', 0.0, 0.0, 0, 'test-dataset-2');
    
    INSERT INTO system_settings (key, value, description) VALUES
    ('test_setting', 'test_value', 'Test setting for unit tests');
  `);
});

afterAll(async () => {
  // Close test database
  if (testDb) {
    testDb.close();
  }
  
  // Remove test database file
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
});

// Helper function to create test user
export async function createTestUser(role: string = 'viewer') {
  const bcrypt = await import('bcryptjs');
  const passwordHash = await bcrypt.hash('testpassword', 12);
  
  // Use unique username and email for each test
  const timestamp = Date.now();
  const username = `testuser_${timestamp}`;
  const email = `test_${timestamp}@example.com`;
  
  const result = testDb.prepare(`
    INSERT INTO users (username, email, password_hash, role)
    VALUES (?, ?, ?, ?)
  `).run(username, email, passwordHash, role);
  
  return {
    id: result.lastInsertRowid as number,
    username,
    email,
    role,
    password: 'testpassword'
  };
}

// Helper function to generate test JWT token
export function generateTestToken(user: { id: number; username: string; role: string; email: string }) {
  const jwt = require('jsonwebtoken');
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}
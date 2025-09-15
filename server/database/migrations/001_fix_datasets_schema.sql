-- Migration to fix datasets table schema mismatch
-- This migration ensures the datasets table matches the expected schema

-- First, create a backup table with the new schema
CREATE TABLE IF NOT EXISTS datasets_new (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    source TEXT NOT NULL,
    huggingface_id TEXT,
    samples INTEGER DEFAULT 0,
    size_mb REAL DEFAULT 0,
    status TEXT DEFAULT 'available' CHECK(status IN ('available', 'downloading', 'processing', 'error')),
    local_path TEXT,
    type TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used DATETIME
);

-- Copy existing data to new table with proper mapping
INSERT OR IGNORE INTO datasets_new (
    id, name, source, huggingface_id, samples, size_mb, status, type, description, created_at, last_used
)
SELECT 
    CAST(id AS TEXT) as id,
    name,
    COALESCE(source, '') as source,
    huggingface_id,
    samples,
    size_mb,
    status,
    type,
    COALESCE(description, '') as description,
    created_at,
    last_used
FROM datasets;

-- Drop the old table and rename the new one
DROP TABLE datasets;
ALTER TABLE datasets_new RENAME TO datasets;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_datasets_status ON datasets(status);
CREATE INDEX IF NOT EXISTS idx_datasets_type ON datasets(type);
// server/database/utils/columns.js
import Database from 'better-sqlite3';

export function hasColumn(db, tableName, columnName) {
  const rows = db.prepare(`PRAGMA table_info(${tableName})`).all();
  return rows.some(r => r.name === columnName);
}

export function addColumnIfMissing(db, tableName, columnSql) {
  const [columnName] = columnSql.trim().split(/\s+/); // first token = column name
  if (!hasColumn(db, tableName, columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnSql};`);
    return true;
  }
  return false;
}
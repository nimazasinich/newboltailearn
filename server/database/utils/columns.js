// server/database/utils/columns.js
import Database from 'better-sqlite3';

export function hasColumn(db, tableName, columnName) {
  try {
    const rows = db.prepare(`PRAGMA table_info(${tableName})`).all();
    return rows.some(r => r.name === columnName);
  } catch (error) {
    console.error(`❌ Failed to check if column ${columnName} exists in table ${tableName}:`, error);
    throw error;
  }
}

export function addColumnIfMissing(db, tableName, columnSql) {
  try {
    const [columnName] = columnSql.trim().split(/\s+/); // first token = column name
    
    console.log(`🔍 Checking if column ${columnName} exists in table ${tableName}...`);
    
    if (!hasColumn(db, tableName, columnName)) {
      console.log(`➕ Adding column ${columnName} to table ${tableName}...`);
      const sql = `ALTER TABLE ${tableName} ADD COLUMN ${columnSql};`;
      console.log(`📝 Executing SQL: ${sql}`);
      db.exec(sql);
      
      // Verify the column was added
      if (hasColumn(db, tableName, columnName)) {
        console.log(`✅ Successfully added column ${columnName} to table ${tableName}`);
        return true;
      } else {
        throw new Error(`Column ${columnName} was not added to table ${tableName}`);
      }
    } else {
      console.log(`ℹ️ Column ${columnName} already exists in table ${tableName}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Failed to add column ${columnSql} to table ${tableName}:`, error);
    throw error;
  }
}
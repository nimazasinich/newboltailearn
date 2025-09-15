import Dexie, { Table } from 'dexie';
import { TrainingSession, ModelCheckpoint, SystemMetrics } from '../../types/training';
import { LegalDocument, DocumentAnalysis, SearchResult } from '../../types/documents';
import { User } from '../../types/user';

// Database Schema
export class PersianLegalAIDB extends Dexie {
  trainingSessions!: Table<TrainingSession>;
  modelCheckpoints!: Table<ModelCheckpoint>;
  legalDocuments!: Table<LegalDocument>;
  documentAnalyses!: Table<DocumentAnalysis>;
  users!: Table<User>;
  systemMetrics!: Table<SystemMetrics & { id: number }>;
  systemLogs!: Table<{
    id?: number;
    timestamp: Date;
    level: 'info' | 'warn' | 'error';
    category: string;
    message: string;
    metadata?: any;
  }>;

  constructor() {
    super('PersianLegalAIDB');
    
    this.version(1).stores({
      trainingSessions: 'id, modelType, status, userId, createdAt, updatedAt',
      modelCheckpoints: 'id, sessionId, epoch, step, timestamp',
      legalDocuments: 'id, category, userId, createdAt, *searchTokens',
      documentAnalyses: 'documentId',
      users: 'id, email, role, isActive',
      systemMetrics: '++id, lastUpdate',
      systemLogs: '++id, timestamp, level, category'
    });

    // Add hooks for Persian text processing
    this.legalDocuments.hook('creating', (primKey, obj, trans) => {
      obj.searchTokens = this.tokenizePersianText(obj.content + ' ' + obj.title);
      obj.createdAt = new Date();
      obj.updatedAt = new Date();
    });

    this.legalDocuments.hook('updating', (modifications, primKey, obj, trans) => {
      if (modifications.content || modifications.title) {
        modifications.searchTokens = this.tokenizePersianText(
          (modifications.content || obj.content) + ' ' + (modifications.title || obj.title)
        );
      }
      modifications.updatedAt = new Date();
    });
  }

  private tokenizePersianText(text: string): string[] {
    // Persian text tokenization with legal terms
    const persianText = this.normalizePersianText(text);
    const tokens = persianText.split(/[\s\u200C-\u200F\u061C]+/)
      .filter(token => token.length > 1)
      .map(token => token.toLowerCase());
    
    return [...new Set(tokens)]; // Remove duplicates
  }

  private normalizePersianText(text: string): string {
    // Normalize Persian/Arabic characters
    return text
      .replace(/ي/g, 'ی')
      .replace(/ك/g, 'ک')
      .replace(/٠/g, '۰')
      .replace(/١/g, '۱')
      .replace(/٢/g, '۲')
      .replace(/٣/g, '۳')
      .replace(/٤/g, '۴')
      .replace(/٥/g, '۵')
      .replace(/٦/g, '۶')
      .replace(/٧/g, '۷')
      .replace(/٨/g, '۸')
      .replace(/٩/g, '۹');
  }

  // Advanced search functionality
  async searchDocuments(query: string, filters?: any): Promise<SearchResult[]> {
    const normalizedQuery = this.normalizePersianText(query.toLowerCase());
    const queryTokens = normalizedQuery.split(/\s+/).filter(token => token.length > 1);

    let collection = this.legalDocuments.toCollection();

    // Apply filters
    if (filters?.categories?.length) {
      collection = collection.filter(doc => filters.categories.includes(doc.category));
    }

    if (filters?.dateRange) {
      collection = collection.filter(doc => 
        doc.createdAt >= filters.dateRange.start && 
        doc.createdAt <= filters.dateRange.end
      );
    }

    const documents = await collection.toArray();

    // Score and rank results
    const results: SearchResult[] = documents
      .map(doc => {
        let relevanceScore = 0;
        const matchedTerms: string[] = [];
        const highlights: any[] = [];

        queryTokens.forEach(token => {
          const tokenMatches = doc.searchTokens.filter(searchToken => 
            searchToken.includes(token)
          ).length;
          
          if (tokenMatches > 0) {
            relevanceScore += tokenMatches;
            matchedTerms.push(token);

            // Find highlights in content
            const regex = new RegExp(`\\b${token}\\w*`, 'gi');
            let match;
            while ((match = regex.exec(doc.content)) !== null) {
              highlights.push({
                text: match[0],
                startIndex: match.index,
                endIndex: match.index + match[0].length
              });
            }
          }
        });

        return {
          document: doc,
          relevanceScore,
          matchedTerms: [...new Set(matchedTerms)],
          highlights: highlights.slice(0, 10) // Limit highlights
        };
      })
      .filter(result => result.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 100); // Limit results

    return results;
  }

  // System metrics management
  async updateSystemMetrics(metrics: Partial<SystemMetrics>): Promise<void> {
    const existingMetrics = await this.systemMetrics.orderBy('id').last();
    
    if (existingMetrics) {
      await this.systemMetrics.update(existingMetrics.id, {
        ...metrics,
        lastUpdate: new Date()
      });
    } else {
      await this.systemMetrics.add({
        id: 1,
        cpuUsage: 0,
        memoryUsage: 0,
        storageUsage: 0,
        networkUsage: 0,
        activeTrainingSessions: 0,
        totalDocuments: 0,
        systemHealth: 'good',
        uptime: 0,
        ...metrics,
        lastUpdate: new Date()
      });
    }
  }

  async getSystemMetrics(): Promise<SystemMetrics | undefined> {
    const metrics = await this.systemMetrics.orderBy('id').last();
    if (metrics) {
      const { id, ...systemMetrics } = metrics;
      return systemMetrics;
    }
    return undefined;
  }

  // Logging functionality
  async log(level: 'info' | 'warn' | 'error', category: string, message: string, metadata?: any): Promise<void> {
    await this.systemLogs.add({
      timestamp: new Date(),
      level,
      category,
      message,
      metadata
    });

    // Keep only last 10000 logs
    const logCount = await this.systemLogs.count();
    if (logCount > 10000) {
      const oldestLogs = await this.systemLogs.orderBy('timestamp').limit(1000).toArray();
      await this.systemLogs.bulkDelete(oldestLogs.map(log => log.id!));
    }
  }

  // Backup and restore functionality
  async exportData(): Promise<any> {
    const data = {
      trainingSessions: await this.trainingSessions.toArray(),
      modelCheckpoints: await this.modelCheckpoints.toArray(),
      legalDocuments: await this.legalDocuments.toArray(),
      documentAnalyses: await this.documentAnalyses.toArray(),
      users: await this.users.toArray(),
      systemLogs: await this.systemLogs.orderBy('timestamp').reverse().limit(5000).toArray(),
      exportedAt: new Date()
    };

    return data;
  }

  async importData(data: any): Promise<void> {
    await this.transaction('rw', this.tables, async () => {
      // Clear existing data (optional)
      // await Promise.all(this.tables.map(table => table.clear()));

      // Import new data
      if (data.trainingSessions) await this.trainingSessions.bulkPut(data.trainingSessions);
      if (data.modelCheckpoints) await this.modelCheckpoints.bulkPut(data.modelCheckpoints);
      if (data.legalDocuments) await this.legalDocuments.bulkPut(data.legalDocuments);
      if (data.documentAnalyses) await this.documentAnalyses.bulkPut(data.documentAnalyses);
      if (data.users) await this.users.bulkPut(data.users);
      if (data.systemLogs) await this.systemLogs.bulkPut(data.systemLogs);
    });
  }
}

// Create database instance
export const db = new PersianLegalAIDB();

// Database initialization
export const initializeDatabase = async (): Promise<void> => {
  try {
    await db.open();
    
    // Create default admin user if none exists
    const userCount = await db.users.count();
    if (userCount === 0) {
      await db.users.add({
        id: 'admin-001',
        email: 'admin@legal-ai.ir',
        name: 'مدیر سیستم',
        role: 'admin',
        permissions: ['train_models', 'manage_documents', 'view_analytics', 'manage_users', 'system_config', 'export_data'],
        preferences: {
          language: 'fa',
          theme: 'dark',
          notifications: {
            trainingComplete: true,
            systemAlerts: true,
            weeklyReports: true
          },
          dashboard: {
            defaultView: 'overview',
            chartsPerPage: 6,
            autoRefresh: true,
            refreshInterval: 30
          }
        },
        statistics: {
          totalTrainingSessions: 0,
          completedSessions: 0,
          totalDocumentsProcessed: 0,
          averageSessionDuration: 0,
          bestModelAccuracy: 0,
          totalTrainingTime: 0,
          lastActivityDate: new Date()
        },
        createdAt: new Date(),
        lastLoginAt: new Date(),
        isActive: true
      });
    }

    // Initialize system metrics
    await db.updateSystemMetrics({
      cpuUsage: 0,
      memoryUsage: 0,
      storageUsage: 0,
      networkUsage: 0,
      activeTrainingSessions: 0,
      totalDocuments: await db.legalDocuments.count(),
      systemHealth: 'good',
      uptime: 0
    });

    await db.log('info', 'database', 'Database initialized successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
};
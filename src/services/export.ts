import { API_BASE, joinApiPath, apiRequest } from '@/lib/api-config';

export interface ExportRequest {
  format: 'zip' | 'tar' | 'json';
  includeModels?: boolean;
  includeData?: boolean;
  includeLogs?: boolean;
  includeConfig?: boolean;
}

export interface ExportResponse {
  success: boolean;
  exportId: string;
  downloadUrl?: string;
  status: 'processing' | 'completed' | 'failed';
  progress?: number;
  message?: string;
}

export interface ProjectStructure {
  name: string;
  version: string;
  description: string;
  files: {
    [path: string]: string;
  };
  dependencies: {
    [name: string]: string;
  };
  scripts: {
    [name: string]: string;
  };
}

export const exportService = {
  /**
   * Export complete project
   */
  async exportProject(options: ExportRequest = { format: 'zip' }): Promise<ExportResponse> {
    try {
      const response = await apiRequest<ExportResponse>(
        joinApiPath(API_BASE, '/export/project'),
        {
          method: 'POST',
          body: JSON.stringify(options),
        }
      );
      return response;
    } catch (error) {
      console.error('Export project failed:', error);
      throw new Error('خطا در صادرات پروژه');
    }
  },

  /**
   * Export specific model
   */
  async exportModel(modelId: number, format: 'tensorflow' | 'onnx' | 'json' = 'tensorflow'): Promise<ExportResponse> {
    try {
      const response = await apiRequest<ExportResponse>(
        joinApiPath(API_BASE, `/models/${modelId}/export`),
        {
          method: 'POST',
          body: JSON.stringify({ format }),
        }
      );
      return response;
    } catch (error) {
      console.error('Export model failed:', error);
      throw new Error('خطا در صادرات مدل');
    }
  },

  /**
   * Get export status
   */
  async getExportStatus(exportId: string): Promise<ExportResponse> {
    try {
      const response = await apiRequest<ExportResponse>(
        joinApiPath(API_BASE, `/export/${exportId}/status`)
      );
      return response;
    } catch (error) {
      console.error('Get export status failed:', error);
      throw new Error('خطا در دریافت وضعیت صادرات');
    }
  },

  /**
   * Download export file
   */
  async downloadExport(exportId: string): Promise<Blob> {
    try {
      const response = await fetch(joinApiPath(API_BASE, `/export/${exportId}/download`));
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.blob();
    } catch (error) {
      console.error('Download export failed:', error);
      throw new Error('خطا در دانلود فایل صادرات');
    }
  },

  /**
   * Get project structure for download
   */
  async getProjectStructure(): Promise<ProjectStructure> {
    try {
      const response = await apiRequest<ProjectStructure>(
        joinApiPath(API_BASE, '/export/structure')
      );
      return response;
    } catch (error) {
      console.error('Get project structure failed:', error);
      // Return fallback structure
      return {
        name: 'persian-legal-ai',
        version: '1.0.0',
        description: 'Persian Legal AI Training System',
        files: {},
        dependencies: {
          'react': '^18.3.1',
          'typescript': '^5.5.3',
          'express': '^4.19.2',
          'better-sqlite3': '^12.2.0'
        },
        scripts: {
          'dev': 'concurrently "npm run server" "npm run client"',
          'build': 'vite build',
          'start': 'node server.js'
        }
      };
    }
  },

  /**
   * Generate complete project ZIP
   */
  async generateProjectZip(): Promise<Blob> {
    try {
      // First get project structure
      const structure = await this.getProjectStructure();
      
      // Then generate ZIP
      const response = await fetch(joinApiPath(API_BASE, '/export/generate-zip'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(structure),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.blob();
    } catch (error) {
      console.error('Generate project ZIP failed:', error);
      throw new Error('خطا در تولید فایل ZIP پروژه');
    }
  },

  /**
   * Export training logs
   */
  async exportLogs(modelId?: number, format: 'csv' | 'json' = 'json'): Promise<Blob> {
    try {
      const params = new URLSearchParams({ format });
      if (modelId) {
        params.append('modelId', modelId.toString());
      }

      const response = await fetch(
        joinApiPath(API_BASE, `/export/logs?${params.toString()}`)
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.blob();
    } catch (error) {
      console.error('Export logs failed:', error);
      throw new Error('خطا در صادرات لاگ‌ها');
    }
  },

  /**
   * Export dataset
   */
  async exportDataset(datasetId: string, format: 'json' | 'csv' = 'json'): Promise<Blob> {
    try {
      const response = await fetch(
        joinApiPath(API_BASE, `/datasets/${datasetId}/export?format=${format}`)
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.blob();
    } catch (error) {
      console.error('Export dataset failed:', error);
      throw new Error('خطا در صادرات مجموعه داده');
    }
  }
};
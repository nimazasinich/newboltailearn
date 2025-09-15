import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import DOMPurify from 'isomorphic-dompurify';

/**
 * Validation schemas for different endpoints
 */
export const schemas = {
  // Auth schemas
  login: z.object({
    username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/),
    password: z.string().min(8).max(128)
  }),
  
  register: z.object({
    username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/),
    email: z.string().email().max(255),
    password: z.string().min(8).max(128)
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
        'Password must contain uppercase, lowercase, number and special character'),
    role: z.enum(['viewer', 'trainer', 'admin']).optional()
  }),

  updateProfile: z.object({
    username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/).optional(),
    email: z.string().email().max(255).optional()
  }),

  changePassword: z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8).max(128)
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
        'Password must contain uppercase, lowercase, number and special character')
  }),

  // Model schemas
  createModel: z.object({
    name: z.string().min(1).max(255),
    type: z.enum(['dora', 'qr-adaptor', 'persian-bert']),
    dataset_id: z.string().optional(),
    config: z.object({
      learning_rate: z.number().min(0).max(1).optional(),
      batch_size: z.number().int().min(1).max(1024).optional(),
      epochs: z.number().int().min(1).max(1000).optional(),
      optimizer: z.enum(['adam', 'sgd', 'rmsprop']).optional()
    }).optional()
  }),

  updateModel: z.object({
    name: z.string().min(1).max(255).optional(),
    status: z.enum(['idle', 'training', 'completed', 'failed', 'paused']).optional(),
    accuracy: z.number().min(0).max(1).optional(),
    loss: z.number().min(0).optional(),
    current_epoch: z.number().int().min(0).optional()
  }),

  // Dataset schemas
  createDataset: z.object({
    name: z.string().min(1).max(255),
    type: z.string().min(1).max(100),
    description: z.string().max(1000).optional(),
    source: z.string().min(1).max(500),
    huggingface_id: z.string().optional(),
    samples: z.number().int().min(0).optional(),
    size_mb: z.number().min(0).optional()
  }),

  updateDataset: z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(1000).optional(),
    status: z.enum(['idle', 'downloading', 'processing', 'ready', 'error']).optional()
  }),

  // Training schemas
  startTraining: z.object({
    model_id: z.number().int().positive(),
    dataset_id: z.string(),
    config: z.object({
      epochs: z.number().int().min(1).max(1000),
      batch_size: z.number().int().min(1).max(1024),
      learning_rate: z.number().min(0).max(1),
      validation_split: z.number().min(0).max(1).optional(),
      early_stopping: z.boolean().optional(),
      patience: z.number().int().min(1).max(100).optional()
    })
  }),

  // Query params schemas
  pagination: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).optional()
  }),

  search: z.object({
    q: z.string().min(1).max(255),
    type: z.string().optional(),
    status: z.string().optional()
  })
};

/**
 * Generic validation middleware factory
 */
export function validate(schema: z.ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request body
      const validated = await schema.parseAsync(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation failed',
          details: error.issues.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      } else {
        res.status(500).json({
          error: 'Internal validation error'
        });
      }
    }
  };
}

/**
 * Validate query parameters
 */
export function validateQuery(schema: z.ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = await schema.parseAsync(req.query);
      req.query = validated as any;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Invalid query parameters',
          details: error.issues.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      } else {
        res.status(500).json({
          error: 'Internal validation error'
        });
      }
    }
  };
}

/**
 * Validate URL parameters
 */
export function validateParams(schema: z.ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = await schema.parseAsync(req.params);
      req.params = validated as any;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Invalid URL parameters',
          details: error.issues.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      } else {
        res.status(500).json({
          error: 'Internal validation error'
        });
      }
    }
  };
}

/**
 * Sanitize output to prevent XSS
 */
export function sanitizeOutput(data: any): any {
  if (typeof data === 'string') {
    return DOMPurify.sanitize(data);
  }
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeOutput(item));
  }
  
  if (data && typeof data === 'object') {
    const sanitized: any = {};
    for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
        sanitized[key] = sanitizeOutput(data[key]);
      }
    }
    return sanitized;
  }
  
  return data;
}

/**
 * Middleware to sanitize response data
 */
export function sanitizeResponse(req: Request, res: Response, next: NextFunction): void {
  const originalJson = res.json;
  
  res.json = function(data: any) {
    const sanitized = sanitizeOutput(data);
    return originalJson.call(this, sanitized);
  };
  
  next();
}
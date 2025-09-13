import { Request, Response, NextFunction } from 'express';

// Try to import express-mongo-sanitize, fallback to no-op if not available
let mongoSanitize: any = null;
try {
  mongoSanitize = require('express-mongo-sanitize');
} catch (error) {
  console.warn('express-mongo-sanitize not available, using no-op middleware');
}

/**
 * MongoDB injection sanitization middleware
 * Returns the real middleware if express-mongo-sanitize is installed,
 * otherwise returns a no-op middleware
 */
export const mongoSanitizeMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (mongoSanitize) {
    return mongoSanitize()(req, res, next);
  }
  // No-op fallback
  next();
};

export default mongoSanitizeMiddleware;
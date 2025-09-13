import csrf from 'csrf';
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      csrfToken?: string;
      session?: {
        csrfSecret?: string;
      };
    }
  }
}

const tokens = new csrf();

/**
 * Generate CSRF token for a request
 */
export function generateCSRFToken(req: Request): string {
  // Generate or retrieve secret
  if (!req.session) {
    req.session = {};
  }
  
  if (!req.session.csrfSecret) {
    req.session.csrfSecret = tokens.secretSync();
  }
  
  // Generate token
  const token = tokens.create(req.session.csrfSecret);
  req.csrfToken = token;
  
  return token;
}

/**
 * CSRF Protection Middleware
 * Uses double-submit cookie pattern
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Skip CSRF for GET, HEAD, OPTIONS requests
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip CSRF for auth endpoints (login/register don't have session yet)
  if (req.path.includes('/auth/login') || 
      req.path.includes('/auth/register') ||
      req.path.includes('/health') ||
      req.path.includes('/metrics')) {
    return next();
  }

  // Skip CSRF in development mode if configured
  if (process.env.NODE_ENV === 'development' && process.env.SKIP_CSRF === 'true') {
    return next();
  }

  // Get token from request
  const token = req.body._csrf || 
                req.query._csrf || 
                req.headers['x-csrf-token'] || 
                req.headers['x-xsrf-token'];

  if (!token) {
    res.status(403).json({ 
      error: 'CSRF token missing',
      message: 'A valid CSRF token is required for this request'
    });
    return;
  }

  // Verify token
  if (!req.session?.csrfSecret) {
    res.status(403).json({ 
      error: 'CSRF validation failed',
      message: 'No CSRF secret found in session'
    });
    return;
  }

  const valid = tokens.verify(req.session.csrfSecret, token as string);
  
  if (!valid) {
    res.status(403).json({ 
      error: 'Invalid CSRF token',
      message: 'The provided CSRF token is invalid or expired'
    });
    return;
  }

  next();
}

/**
 * Middleware to inject CSRF token into response
 */
export function injectCSRFToken(req: Request, res: Response, next: NextFunction): void {
  // Generate token for all requests
  const token = generateCSRFToken(req);
  
  // Set token in response header
  res.setHeader('X-CSRF-Token', token);
  
  // Also set in cookie for SPA
  res.cookie('XSRF-TOKEN', token, {
    httpOnly: false, // Allow JavaScript to read it
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 3600000 // 1 hour
  });
  
  next();
}

/**
 * Get CSRF token endpoint
 */
export function getCSRFToken(req: Request, res: Response): void {
  const token = generateCSRFToken(req);
  res.json({ csrfToken: token });
}
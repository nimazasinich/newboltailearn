import session from 'express-session';
import { configureHelmet } from './helmet.js';
import { globalRateLimiter } from './rateLimiter.js';
import { injectCSRFToken, getCSRFToken } from './csrf.js';
import { sanitizeResponse } from './validators.js';
import { config } from './config.js';
import compression from 'compression';
import { mongoSanitizeMiddleware } from './mongoSanitize.js';
/**
 * Apply all security middleware to the application
 */
export function applySecurity(app) {
    // Compression
    app.use(compression());
    // Session configuration (required for CSRF)
    app.use(session({
        secret: config.SESSION_SECRET || config.JWT_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: config.NODE_ENV === 'production',
            httpOnly: true,
            maxAge: 3600000, // 1 hour
            sameSite: 'strict'
        }
    }));
    // Helmet security headers
    configureHelmet(app);
    // Global rate limiting
    app.use(globalRateLimiter);
    // Input sanitization
    app.use(mongoSanitizeMiddleware);
    // Output sanitization
    app.use(sanitizeResponse);
    // CSRF token injection (for all requests)
    app.use(injectCSRFToken);
    // CSRF token endpoint
    app.get('/api/csrf-token', getCSRFToken);
}
/**
 * Export all security middleware for selective use
 */
export { configureHelmet } from './helmet.js';
export { globalRateLimiter, authRateLimiter, apiRateLimiter, trainingRateLimiter, downloadRateLimiter } from './rateLimiter.js';
export { csrfProtection, injectCSRFToken, getCSRFToken } from './csrf.js';
export * from './validators.js';
export * from './config.js';
/**
 * Dev identification endpoint (non-production only)
 */
export function setupDevIdentification(app) {
    if (config.NODE_ENV === 'production') {
        return;
    }
    app.post('/api/dev/identify', (req, res) => {
        const { username, password } = req.body;
        if (!config.DEV_ADMIN_USER || !config.DEV_ADMIN_PASS) {
            res.status(404).json({ error: 'Dev identification not configured' });
            return;
        }
        if (username === config.DEV_ADMIN_USER && password === config.DEV_ADMIN_PASS) {
            res.json({
                success: true,
                message: 'Dev identification successful',
                environment: config.NODE_ENV
            });
        }
        else {
            res.status(401).json({ error: 'Invalid dev credentials' });
        }
    });
}

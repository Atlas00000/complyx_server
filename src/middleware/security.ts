import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';
import { body, validationResult, ValidationChain } from 'express-validator';

/**
 * Rate Limiting Middleware
 */

// General API rate limiter
// Increased for development - adjust for production
const isDevelopment = process.env.NODE_ENV === 'development';
const generalMax = isDevelopment ? 1000 : 100;
const authMax = isDevelopment ? 100 : 5;
const adminMax = isDevelopment ? 500 : 50;
const chatMax = isDevelopment ? 100 : 20;

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: generalMax, // Limit each IP (1000 in dev, 100 in prod)
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiter for authentication endpoints
// More lenient in development to prevent dev timeout issues
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: authMax, // Limit each IP (100 in dev, 5 in prod)
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

// Admin endpoint rate limiter
export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: adminMax, // Limit each IP (500 in dev, 50 in prod)
  message: 'Too many admin requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Chat/AI endpoint rate limiter (more lenient for AI interactions)
export const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: chatMax, // Limit each IP (100 in dev, 20 in prod)
  message: 'Too many chat requests, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Security Headers Middleware (Helmet)
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // May need to adjust based on frontend needs
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
});

/**
 * Input Validation Middleware
 */
export const validate = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Run all validations
    await Promise.all(validations.map((validation) => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    res.status(400).json({
      error: 'Validation failed',
      details: errors.array(),
    });
  };
};

/**
 * Common validation rules
 */
export const validationRules = {
  email: body('email')
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail(),

  password: body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number')
    .matches(/[!@#$%^&*(),.?":{}|<>]/)
    .withMessage('Password must contain at least one special character'),

  name: body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters')
    .escape(),

  string: (field: string, min: number = 1, max: number = 1000) =>
    body(field)
      .trim()
      .isLength({ min, max })
      .withMessage(`${field} must be between ${min} and ${max} characters`)
      .escape(),

  uuid: (field: string) =>
    body(field)
      .isUUID()
      .withMessage(`${field} must be a valid UUID`),
};

/**
 * Sanitization Middleware
 */
export const sanitizeInput = (req: Request, _res: Response, next: NextFunction): void => {
  // Recursively sanitize request body
  const sanitize = (obj: any): any => {
    if (typeof obj === 'string') {
      // Remove potentially dangerous characters
      return obj
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '');
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const key in obj) {
        sanitized[key] = sanitize(obj[key]);
      }
      return sanitized;
    }
    return obj;
  };

  if (req.body) {
    req.body = sanitize(req.body);
  }
  if (req.query) {
    req.query = sanitize(req.query);
  }
  if (req.params) {
    req.params = sanitize(req.params);
  }

  next();
};

/**
 * XSS Protection Middleware
 */
export const xssProtection = (req: Request, _res: Response, next: NextFunction): void => {
  // Additional XSS protection beyond Helmet
  // This is a basic implementation - Helmet handles most of it
  
  const xssClean = (str: string): string => {
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  };

  // Clean request body strings
  if (req.body && typeof req.body === 'object') {
    const cleanBody = (obj: any): any => {
      for (const key in obj) {
        if (typeof obj[key] === 'string') {
          obj[key] = xssClean(obj[key]);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          cleanBody(obj[key]);
        }
      }
    };
    cleanBody(req.body);
  }

  next();
};

/**
 * CORS Configuration (if not already configured)
 */
export const corsConfig = {
  origin: process.env.CLIENT_URL || process.env.APP_URL || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200,
};

/**
 * Error Handler for Security-related errors
 */
export const securityErrorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (err.name === 'ValidationError' || err.name === 'CastError') {
    res.status(400).json({
      error: 'Invalid input',
      message: isDevelopment ? err.message : 'Invalid request data',
    });
    return;
  }

  if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError') {
    res.status(401).json({
      error: 'Authentication failed',
      message: isDevelopment ? err.message : 'Invalid or expired token',
    });
    return;
  }

  // Log error but don't expose details
  console.error('Security error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: isDevelopment ? err.message : 'An error occurred',
  });
};

/**
 * Request logging middleware (for security monitoring)
 */
export const securityLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      timestamp: new Date().toISOString(),
    };

    // Log suspicious requests
    if (res.statusCode >= 400 || duration > 5000) {
      console.warn('Security log:', logData);
    }
  });

  next();
};

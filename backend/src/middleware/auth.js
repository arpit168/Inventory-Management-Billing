import { verifyToken } from '../utils/tokenUtils.js';
import User from '../models/User.js';

// ==================== HELPER FUNCTIONS ====================

/**
 * Extract token from request headers or cookies
 * @param {Object} req - Express request object
 * @returns {string|null} - Extracted token or null
 */
const extractToken = (req) => {
  // Check Authorization header (Bearer token)
  if (req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      return parts[1];
    }
  }
  
  // Check cookie (for web apps)
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }
  
  // Check query parameter (for downloads/file access)
  if (req.query && req.query.token) {
    return req.query.token;
  }
  
  return null;
};

/**
 * Get client IP address
 * @param {Object} req - Express request object
 * @returns {string} - Client IP
 */
const getClientIP = (req) => {
  return req.ip || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress || 
         req.headers['x-forwarded-for']?.split(',')[0] || 
         'unknown';
};

/**
 * Log authentication attempts (optional)
 */
const logAuthAttempt = async (userId, success, ip, userAgent) => {
  if (process.env.NODE_ENV === 'production') {
    // You can implement logging to database or external service here
    console.log(`[AUTH] User: ${userId || 'unknown'}, Success: ${success}, IP: ${ip}, UA: ${userAgent}`);
  }
};

// ==================== AUTHENTICATE MIDDLEWARE ====================

export const authenticate = (req, res, next) => {
  try {
    // ✅ FIX 1: Extract token from multiple sources
    const token = extractToken(req);

    if (!token) {
      logAuthAttempt(null, false, getClientIP(req), req.headers['user-agent']);
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in to access this resource.',
        code: 'AUTH_REQUIRED'
      });
    }

    // ✅ FIX 2: Validate token format (basic check)
    if (typeof token !== 'string' || token.length < 10) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token format',
        code: 'INVALID_TOKEN_FORMAT'
      });
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (tokenError) {
      // ✅ FIX 3: Differentiate between expired and invalid tokens
      const isExpired = tokenError.name === 'TokenExpiredError' || 
                        tokenError.message?.includes('expired');
      
      logAuthAttempt(null, false, getClientIP(req), req.headers['user-agent']);
      
      return res.status(401).json({
        success: false,
        message: isExpired ? 'Session expired. Please log in again.' : 'Invalid or malformed token',
        code: isExpired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
        ...(process.env.NODE_ENV === 'development' && { error: tokenError.message })
      });
    }

    // ✅ FIX 4: Validate decoded payload
    if (!decoded || typeof decoded !== 'object') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token payload',
        code: 'INVALID_PAYLOAD'
      });
    }

    // ✅ FIX 5: Validate userId exists and is valid format
    const userId = decoded.userId || decoded.id || decoded._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token: missing user identifier',
        code: 'MISSING_USER_ID'
      });
    }

    // ✅ FIX 6: Check if userId is valid ObjectId format (MongoDB)
    const isValidObjectId = (id) => /^[0-9a-fA-F]{24}$/.test(id);
    if (!isValidObjectId(userId)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token: malformed user identifier',
        code: 'MALFORMED_USER_ID'
      });
    }

    // ✅ FIX 7: Add token expiration info to request (for frontend)
    if (decoded.exp) {
      req.tokenExpiresAt = new Date(decoded.exp * 1000);
    }

    // ✅ FIX 8: Store additional token metadata
    req.userId = userId;
    req.tokenIssuedAt = decoded.iat ? new Date(decoded.iat * 1000) : null;
    
    // ✅ FIX 9: Add client info for logging (optional)
    req.clientInfo = {
      ip: getClientIP(req),
      userAgent: req.headers['user-agent'],
      timestamp: new Date()
    };

    next();
  } catch (error) {
    console.error('AUTHENTICATION MIDDLEWARE ERROR:', error);
    
    logAuthAttempt(null, false, getClientIP(req), req.headers['user-agent']);
    
    return res.status(500).json({
      success: false,
      message: 'Authentication service error',
      code: 'AUTH_SERVICE_ERROR',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// ==================== OPTIONAL AUTHENTICATE (FOR PUBLIC ROUTES) ====================

/**
 * Optional authentication - doesn't fail if no token
 * Sets req.userId if token is valid, otherwise proceeds
 */
export const optionalAuthenticate = (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return next();
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch {
      return next(); // Token invalid but route is optional
    }

    if (decoded && (decoded.userId || decoded.id)) {
      req.userId = decoded.userId || decoded.id;
    }

    next();
  } catch (error) {
    // Don't fail on error for optional auth
    next();
  }
};

// ==================== AUTHORIZE MIDDLEWARE ====================

export const authorize = (allowedRoles = []) => {
  return async (req, res, next) => {
    try {
      // ✅ FIX 10: Ensure user is authenticated first
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required before authorization',
          code: 'AUTH_REQUIRED'
        });
      }

      // ✅ FIX 11: Fetch user with caching in request (avoid multiple DB calls)
      if (!req.user) {
        const user = await User.findById(req.userId)
          .select('role status email fullName')
          .lean();

        if (!user) {
          logAuthAttempt(req.userId, false, req.clientInfo?.ip, req.clientInfo?.userAgent);
          return res.status(404).json({
            success: false,
            message: 'User account not found',
            code: 'USER_NOT_FOUND'
          });
        }

        // ✅ FIX 12: Check if user account is active
        if (user.status !== 'active') {
          return res.status(403).json({
            success: false,
            message: user.status === 'suspended' 
              ? 'Your account has been suspended. Please contact support.' 
              : 'Your account is not active',
            code: 'ACCOUNT_INACTIVE'
          });
        }

        req.user = user;
      }

      // ✅ FIX 13: Allow empty allowedRoles array (just means user is authenticated)
      if (allowedRoles.length === 0) {
        return next();
      }

      // ✅ FIX 14: Check if user has required role
      if (!allowedRoles.includes(req.user.role)) {
        logAuthAttempt(req.userId, false, req.clientInfo?.ip, req.clientInfo?.userAgent);
        
        return res.status(403).json({
          success: false,
          message: `Access denied. Required roles: ${allowedRoles.join(', ')}. Your role: ${req.user.role}`,
          code: 'INSUFFICIENT_PERMISSIONS',
          requiredRoles: allowedRoles,
          userRole: req.user.role
        });
      }

      // ✅ FIX 15: Log successful authorization (optional)
      if (process.env.NODE_ENV === 'development') {
        console.log(`[AUTH] User ${req.user.email} (${req.user.role}) accessed ${req.method} ${req.path}`);
      }

      next();
    } catch (error) {
      console.error('AUTHORIZATION MIDDLEWARE ERROR:', error);
      return res.status(500).json({
        success: false,
        message: 'Authorization service error',
        code: 'AUTHZ_SERVICE_ERROR',
        ...(process.env.NODE_ENV === 'development' && { error: error.message })
      });
    }
  };
};

// ==================== ROLE-BASED AUTHORIZATION HELPERS ====================

/**
 * Authorize for admin only
 */
export const authorizeAdmin = authorize(['admin']);

/**
 * Authorize for admin and manager
 */
export const authorizeAdminManager = authorize(['admin', 'manager']);

/**
 * Authorize for admin, manager, and staff
 */
export const authorizeStaff = authorize(['admin', 'manager', 'staff']);

// ==================== PERMISSION-BASED AUTHORIZATION ====================

/**
 * Permission-based authorization (for granular access control)
 * @param {Object} permissions - Object with action and resource
 * @returns {Function} - Express middleware
 */
export const hasPermission = (permissions) => {
  return async (req, res, next) => {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      // Fetch user with permissions (assuming you have a permissions field)
      const user = await User.findById(req.userId)
        .select('role permissions status')
        .lean();

      if (!user || user.status !== 'active') {
        return res.status(403).json({
          success: false,
          message: 'Access denied',
          code: 'ACCESS_DENIED'
        });
      }

      // Admin has all permissions
      if (user.role === 'admin') {
        return next();
      }

      // Check specific permissions
      const { action, resource } = permissions;
      const hasRequiredPermission = user.permissions?.some(
        p => p.action === action && p.resource === resource
      );

      if (!hasRequiredPermission) {
        return res.status(403).json({
          success: false,
          message: `You don't have permission to ${action} ${resource}`,
          code: 'MISSING_PERMISSION',
          required: { action, resource }
        });
      }

      next();
    } catch (error) {
      console.error('PERMISSION CHECK ERROR:', error);
      return res.status(500).json({
        success: false,
        message: 'Permission check failed',
        code: 'PERMISSION_ERROR'
      });
    }
  };
};

// ==================== RATE LIMITING PER USER (OPTIONAL) ====================

/**
 * Simple rate limiting based on authenticated user
 * @param {number} maxRequests - Maximum requests allowed
 * @param {number} windowMs - Time window in milliseconds
 * @returns {Function} - Express middleware
 */
export const userRateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const requests = new Map();

  return (req, res, next) => {
    if (!req.userId) {
      return next(); // Don't rate limit unauthenticated (global rate limit should handle)
    }

    const now = Date.now();
    const userRequests = requests.get(req.userId) || [];

    // Clean old requests
    const validRequests = userRequests.filter(timestamp => now - timestamp < windowMs);

    if (validRequests.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: `Too many requests. Please try again later.`,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((validRequests[0] + windowMs - now) / 1000)
      });
    }

    validRequests.push(now);
    requests.set(req.userId, validRequests);

    next();
  };
};

// ==================== REFRESH TOKEN VALIDATION (OPTIONAL) ====================

/**
 * Validate refresh token (for token refresh endpoints)
 */
export const validateRefreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required',
        code: 'REFRESH_TOKEN_REQUIRED'
      });
    }

    let decoded;
    try {
      decoded = verifyToken(refreshToken);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }

    if (!decoded || !decoded.userId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token payload',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }

    // Check if refresh token exists in database (if you store them)
    const user = await User.findById(decoded.userId).select('refreshToken');
    
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token has been revoked',
        code: 'REFRESH_TOKEN_REVOKED'
      });
    }

    req.userId = decoded.userId;
    req.refreshToken = refreshToken;
    next();
  } catch (error) {
    console.error('REFRESH TOKEN VALIDATION ERROR:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to validate refresh token',
      code: 'VALIDATION_ERROR'
    });
  }
};

// ==================== WEBHOOK AUTHENTICATION (FOR EXTERNAL SERVICES) ====================

/**
 * Webhook authentication using API key
 * @param {string} apiKeyHeader - Header name for API key
 * @returns {Function} - Express middleware
 */
export const webhookAuth = (apiKeyHeader = 'x-webhook-secret') => {
  return (req, res, next) => {
    const apiKey = req.headers[apiKeyHeader.toLowerCase()];
    
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        message: 'API key required',
        code: 'API_KEY_REQUIRED'
      });
    }

    if (apiKey !== process.env.WEBHOOK_SECRET) {
      return res.status(403).json({
        success: false,
        message: 'Invalid API key',
        code: 'INVALID_API_KEY'
      });
    }

    next();
  };
};
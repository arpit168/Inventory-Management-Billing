import mongoose from 'mongoose';

// ==================== CUSTOM ERROR CLASSES ====================

export class AppError extends Error {
  constructor(message, statusCode, errorCode = null, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = true; // Marks this as an expected error

    Error.captureStackTrace(this, this.constructor);
  }
}

// ==================== SPECIFIC ERROR CLASSES ====================

export class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409, 'CONFLICT_ERROR');
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429, 'RATE_LIMIT_ERROR');
  }
}

// ==================== HELPER FUNCTIONS ====================

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Handle Mongoose CastError (Invalid ObjectId)
 */
const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400, 'INVALID_ID_FORMAT');
};

/**
 * Handle Mongoose Duplicate Key Error
 */
const handleDuplicateFieldsDB = (err) => {
  const field = Object.keys(err.keyValue)[0];
  const value = err.keyValue[field];
  const message = `${field.charAt(0).toUpperCase() + field.slice(1)} '${value}' already exists`;
  return new AppError(message, 400, 'DUPLICATE_FIELD');
};

/**
 * Handle Mongoose Validation Error
 */
const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map(el => ({
    field: el.path,
    message: el.message,
    value: el.value
  }));
  
  const message = 'Validation failed';
  return new AppError(message, 400, 'VALIDATION_FAILED', errors);
};

/**
 * Handle JWT Errors
 */
const handleJWTError = () => {
  return new AppError('Invalid token. Please log in again.', 401, 'INVALID_TOKEN');
};

const handleJWTExpiredError = () => {
  return new AppError('Your session has expired. Please log in again.', 401, 'TOKEN_EXPIRED');
};

/**
 * Send error response for development (detailed)
 */
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    success: false,
    message: err.message,
    errorCode: err.errorCode,
    statusCode: err.statusCode,
    stack: err.stack,
    error: err,
    ...(err.details && { details: err.details })
  });
};

/**
 * Send error response for production (clean)
 */
const sendErrorProd = (err, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    const response = {
      success: false,
      message: err.message,
      errorCode: err.errorCode,
      statusCode: err.statusCode
    };
    
    if (err.details) {
      response.details = err.details;
    }
    
    return res.status(err.statusCode).json(response);
  }
  
  // Programming or other unknown error: don't leak error details
  console.error('ERROR 💥:', err);
  
  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    errorCode: 'INTERNAL_SERVER_ERROR',
    statusCode: 500
  });
};

// ==================== MAIN ERROR HANDLER ====================

export const errorHandler = (err, req, res, next) => {
  // Set default values
  err.statusCode = err.statusCode || 500;
  
  // Log error with additional context
  console.error({
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    ip: req.ip,
    userId: req.userId,
    errorMessage: err.message,
    errorStack: err.stack,
    errorName: err.name,
    statusCode: err.statusCode
  });

  let error = { ...err };
  error.message = err.message;
  error.name = err.name;
  error.code = err.code;

  // ✅ FIX 1: Handle Mongoose Bad ObjectId
  if (error.name === 'CastError') {
    error = handleCastErrorDB(error);
  }

  // ✅ FIX 2: Handle Mongoose Duplicate Key
  if (error.code === 11000) {
    error = handleDuplicateFieldsDB(error);
  }

  // ✅ FIX 3: Handle Mongoose Validation Error
  if (error.name === 'ValidationError') {
    error = handleValidationErrorDB(error);
  }

  // ✅ FIX 4: Handle JWT Errors
  if (error.name === 'JsonWebTokenError') {
    error = handleJWTError();
  }

  // ✅ FIX 5: Handle JWT Expired Error
  if (error.name === 'TokenExpiredError') {
    error = handleJWTExpiredError();
  }

  // ✅ FIX 6: Handle Mongoose Server Selection Error (Database connection issues)
  if (error.name === 'MongoServerSelectionError') {
    error = new AppError('Database connection issue. Please try again later.', 503, 'DB_CONNECTION_ERROR');
  }

  // ✅ FIX 7: Handle Rate Limiting Error (if using express-rate-limit)
  if (error.name === 'RateLimitError') {
    error = new AppError('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED');
  }

  // ✅ FIX 8: Handle Payload Too Large
  if (error.type === 'entity.too.large') {
    error = new AppError('Request payload too large', 413, 'PAYLOAD_TOO_LARGE');
  }

  // ✅ FIX 9: Handle Unsupported Media Type
  if (error.status === 415) {
    error = new AppError('Unsupported media type', 415, 'UNSUPPORTED_MEDIA_TYPE');
  }

  // Send appropriate response based on environment
  if (isDevelopment) {
    sendErrorDev(error, res);
  } else {
    sendErrorProd(error, res);
  }
};

// ==================== ASYNC ERROR WRAPPER ====================

/**
 * Wraps async functions to avoid try-catch blocks in controllers
 * @param {Function} fn - Async function to wrap
 * @returns {Function} - Express middleware with error handling
 */
export const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

// ==================== NOT FOUND HANDLER ====================

/**
 * Handle 404 - Route not found
 */
export const notFound = (req, res, next) => {
  const error = new AppError(
    `Cannot find ${req.originalUrl} on this server`,
    404,
    'ROUTE_NOT_FOUND'
  );
  next(error);
};

// ==================== VALIDATION ERROR HANDLER (for express-validator) ====================

/**
 * Handle express-validator validation errors
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 * @returns {Object} - Validation error response
 */
export const handleValidationErrors = (req, res, next) => {
  const validationResult = req.validationResult || (() => null);
  const errors = validationResult(req);
  
  if (!errors.isEmpty || (errors && !errors.isEmpty())) {
    const formattedErrors = (errors.errors || errors).map(err => ({
      field: err.param || err.path,
      message: err.msg,
      value: err.value
    }));
    
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errorCode: 'VALIDATION_FAILED',
      errors: formattedErrors
    });
  }
  
  next();
};

// ==================== DATABASE ERROR HANDLER ====================

/**
 * Handle database connection errors gracefully
 */
export const handleDBError = (error) => {
  if (error.name === 'MongoNetworkError') {
    console.error('Database network error:', error.message);
    return new AppError('Database connection lost. Please try again.', 503, 'DB_NETWORK_ERROR');
  }
  
  if (error.name === 'MongoTimeoutError') {
    return new AppError('Database operation timeout. Please try again.', 504, 'DB_TIMEOUT_ERROR');
  }
  
  return error;
};

// ==================== MULTER ERROR HANDLER ====================

/**
 * Handle file upload errors (Multer)
 */
export const handleMulterError = (err, req, res, next) => {
  if (err.name === 'MulterError') {
    let message = 'File upload error';
    let statusCode = 400;
    
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File too large. Maximum size is 5MB.';
        statusCode = 413;
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files uploaded';
        statusCode = 400;
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected file field';
        statusCode = 400;
        break;
      default:
        message = err.message;
    }
    
    return res.status(statusCode).json({
      success: false,
      message,
      errorCode: 'FILE_UPLOAD_ERROR',
      details: err.code
    });
  }
  
  next(err);
};

// ==================== RATE LIMIT ERROR HANDLER ====================

/**
 * Custom rate limit error handler
 */
export const rateLimitErrorHandler = (req, res) => {
  res.status(429).json({
    success: false,
    message: 'Too many requests from this IP. Please try again later.',
    errorCode: 'RATE_LIMIT_EXCEEDED',
    retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
  });
};

// ==================== UNHANDLED REJECTION HANDLER ====================

/**
 * Handle unhandled promise rejections
 */
export const handleUnhandledRejection = (err) => {
  console.error('UNHANDLED REJECTION 💥:', err);
  console.error('Error name:', err.name);
  console.error('Error message:', err.message);
  console.error('Stack trace:', err.stack);
  
  // Graceful shutdown
  process.exit(1);
};

/**
 * Handle uncaught exceptions
 */
export const handleUncaughtException = (err) => {
  console.error('UNCAUGHT EXCEPTION 💥:', err);
  console.error('Error name:', err.name);
  console.error('Error message:', err.message);
  console.error('Stack trace:', err.stack);
  
  // Graceful shutdown
  process.exit(1);
};

// ==================== EXPRESS VALIDATION ERROR FORMATTER ====================

/**
 * Format express-validator errors
 */
export const formatValidationErrors = (errors) => {
  return errors.array().map(err => ({
    field: err.param,
    message: err.msg,
    value: err.value,
    location: err.location
  }));
};

// ==================== MONGOOSE ERROR HANDLER ====================

/**
 * Handle specific Mongoose errors with custom messages
 */
export const handleMongooseError = (err) => {
  if (err instanceof mongoose.Error.CastError) {
    return new AppError(`Invalid ${err.path}: ${err.value}`, 400, 'INVALID_ID');
  }
  
  if (err instanceof mongoose.Error.ValidationError) {
    const messages = Object.values(err.errors).map(e => e.message);
    return new AppError(messages.join(', '), 400, 'VALIDATION_ERROR');
  }
  
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return new AppError(`${field} already exists`, 409, 'DUPLICATE_ERROR');
  }
  
  return err;
};

// ==================== BUSINESS LOGIC ERRORS ====================

/**
 * Error for insufficient stock
 */
export class InsufficientStockError extends AppError {
  constructor(productName, available, requested) {
    super(
      `Insufficient stock for ${productName}. Available: ${available}, Requested: ${requested}`,
      400,
      'INSUFFICIENT_STOCK',
      { productName, available, requested }
    );
  }
}

/**
 * Error for invalid invoice status transition
 */
export class InvalidInvoiceStatusError extends AppError {
  constructor(currentStatus, requestedStatus) {
    super(
      `Cannot change invoice status from ${currentStatus} to ${requestedStatus}`,
      400,
      'INVALID_STATUS_TRANSITION',
      { currentStatus, requestedStatus }
    );
  }
}

/**
 * Error for expired operation (e.g., password reset)
 */
export class ExpiredOperationError extends AppError {
  constructor(operation = 'Operation') {
    super(`${operation} has expired. Please try again.`, 400, 'OPERATION_EXPIRED');
  }
}

// ==================== HELPER TO CREATE CUSTOM ERRORS ====================

export const createError = (message, statusCode, errorCode = null, details = null) => {
  return new AppError(message, statusCode, errorCode, details);
};
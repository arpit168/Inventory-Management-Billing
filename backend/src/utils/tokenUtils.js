import jwt from 'jsonwebtoken';
import crypto from 'crypto';

/**
 * Generate JWT token for user authentication
 * @param {string} userId - User ID to encode in token
 * @returns {string} JWT token
 */
export const generateToken = (userId) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
};

/**
 * Verify and decode JWT token
 * @param {string} token - JWT token to verify
 * @returns {object} Decoded token payload with userId
 * @throws {Error} If token is invalid or expired
 */
export const verifyToken = (token) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token has expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    }
    throw error;
  }
};

/**
 * Decode token without verification
 * @param {string} token - JWT token to decode
 * @returns {object} Decoded token payload
 */
export const decodeToken = (token) => {
  try {
    return jwt.decode(token);
  } catch (error) {
    return null;
  }
};

/**
 * Generate cryptographically secure verification token using crypto.randomBytes
 * @returns {string} 32-character hex string for email verification
 */
export const generateVerificationToken = () => {
  return crypto.randomBytes(16).toString('hex');
};

/**
 * Generate cryptographically secure password reset token using crypto.randomBytes
 * @returns {string} 32-character hex string for password reset
 */
export const generateResetToken = () => {
  return crypto.randomBytes(16).toString('hex');
};

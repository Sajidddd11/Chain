import jwt from 'jsonwebtoken';
import { authenticateApiKey } from './apiKeyAuth.js';

/**
 * Middleware that accepts either JWT (Bearer token) or API key (X-API-Key header)
 * Sets req.user for JWT or req.device for API key
 */
export const flexibleAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers['x-api-key'] || req.query.api_key;

  // Try JWT first
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      return next();
    } catch (error) {
      // JWT failed, try API key if available
      if (apiKey) {
        return authenticateApiKey(req, res, next);
      }
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
  }

  // Try API key
  if (apiKey) {
    return authenticateApiKey(req, res, next);
  }

  return res.status(401).json({ message: 'Authentication required (JWT token or API key)' });
};

/**
 * Helper to get userId from either req.user or req.device
 */
export const getUserId = (req) => {
  if (req.user?.userId) {
    return req.user.userId;
  }
  if (req.user?.id) {
    return req.user.id;
  }
  if (req.device?.userId) {
    return req.device.userId;
  }
  return null;
};


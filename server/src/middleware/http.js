// Shared HTTP middleware for private responses, rate limits, and JSON writes.
import { rateLimit } from 'express-rate-limit';
import { HttpError } from '../utils/http-error.js';

const rateLimitWindowMs = 15 * 60 * 1000;
const readMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
const jsonWriteMethods = new Set(['POST', 'PUT', 'PATCH']);

export function noStore(_req, res, next) {
  res.set('Cache-Control', 'no-store');
  next();
}

export function requestLimit({ limit, message, identifier, keyGenerator }) {
  return rateLimit({
    ...(identifier && { identifier }),
    ...(keyGenerator && { keyGenerator }),
    windowMs: rateLimitWindowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => next(new HttpError(429, message)),
  });
}

export function protectWrites(origins) {
  return (req, _res, next) => {
    if (!readMethods.has(req.method)) {
      const origin = req.get('origin');
      if (origin && !origins.includes(origin)) {
        throw new HttpError(403, 'This request origin is not allowed.');
      }
      // JSON writes require a CORS preflight when issued by another origin.
      if (jsonWriteMethods.has(req.method) && !req.is('application/json')) {
        throw new HttpError(415, 'Send an application/json request body.');
      }
    }
    next();
  };
}

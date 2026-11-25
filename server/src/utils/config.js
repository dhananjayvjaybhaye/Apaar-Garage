// Validates environment settings at the boundary that uses them.
import { z } from 'zod';
import { readAdminSecurity } from '../config/admin-security.js';
import { readProductMedia } from '../config/product-media.js';
import { readPaymentOptions } from './payment-options.js';

const defaultPort = 3000;
const minimumSecretBytes = 32;
export const bindAddress = '127.0.0.1';

export function readPort(env = process.env) {
  const port = Number(env.PORT || defaultPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Set PORT to an integer from 1 to 65535.');
  }
  return port;
}

function readOrigins(value) {
  const origins = (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  for (const origin of origins) {
    const url = new URL(origin);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) {
      throw new Error(
        'CORS_ORIGINS must contain exact HTTP or HTTPS origins without trailing slashes.',
      );
    }
  }
  return origins;
}

export function readAppOptions(env = process.env) {
  const origins = readOrigins(env.CORS_ORIGINS);
  const secret = env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret) < minimumSecretBytes) {
    throw new Error('Set JWT_SECRET in server/.env to a random secret at least 32 bytes long.');
  }
  const businessSecret = env.BUSINESS_KEY_SECRET || secret;
  if (Buffer.byteLength(businessSecret) < minimumSecretBytes)
    throw new Error('Set BUSINESS_KEY_SECRET to at least 32 bytes.');
  const production = env.NODE_ENV === 'production';
  return {
    adminSecurity: readAdminSecurity(env, secret, production),
    businessSecret,
    origins,
    secret,
    production,
    productMedia: readProductMedia(env),
    payment: readPaymentOptions(env),
  };
}

export function readDatabaseUri(env = process.env) {
  if (!env.MONGODB_URI) throw new Error('Set MONGODB_URI in server/.env.');
  return env.MONGODB_URI;
}

export function readOrderEmailOptions(env = process.env) {
  const enabled = z.enum(['true', 'false']).parse(env.ORDER_EMAIL_ENABLED?.trim() || 'false');
  if (enabled === 'false') return null;
  const port = z.enum(['465', '587', '2525']).parse(env.ORDER_SMTP_PORT?.trim() || '587');
  const from = z.email().parse(env.ORDER_EMAIL_FROM?.trim());
  const user = z.string().min(1).parse(env.ORDER_SMTP_USER?.trim());
  const pass = z.string().min(1).parse(env.ORDER_SMTP_PASSWORD);
  const site = env.ORDER_EMAIL_SITE_URL?.trim();
  if (site && (new URL(site).origin !== site || !site.startsWith('https://'))) {
    throw new Error('Set ORDER_EMAIL_SITE_URL to the HTTPS storefront origin without a trailing slash.');
  }
  return {
    from,
    logoUrl: site ? new URL('/logo/header.png', site).href : undefined,
    smtp: {
      host: env.ORDER_SMTP_HOST?.trim() || 'smtp-relay.brevo.com',
      port: Number(port),
      secure: port === '465',
      requireTLS: port !== '465',
      auth: { user, pass },
    },
  };
}

import type { CallableOptions, HttpsOptions } from 'firebase-functions/v2/https';
import { config } from '../config';

/**
 * Shared deployment options. Origin restrictions come from ALLOWED_ORIGINS;
 * when unset we fall back to allowing any origin, because every callable still
 * demands a valid Firebase ID token.
 */
const base: CallableOptions = {
  region: config.region,
  cors: config.allowedOrigins.length > 0 ? config.allowedOrigins : true,
  maxInstances: 20,
  enforceAppCheck: false
};

export function callableOptions(extra: CallableOptions = {}): CallableOptions {
  return { ...base, ...extra };
}

export const httpOptions: HttpsOptions = {
  region: config.region,
  cors: config.allowedOrigins.length > 0 ? config.allowedOrigins : true
};

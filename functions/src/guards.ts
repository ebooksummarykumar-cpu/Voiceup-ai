import { CallableRequest, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { db, FieldValueRef, collections } from './admin';
import { config, isAdminEmail } from './config';
import { AppError, isAppError } from './errors';
import { ValidationError } from './lib/validation';

export interface Actor {
  uid: string;
  email?: string;
  name?: string;
  isAdmin: boolean;
}

/** Timezone the daily budget resets in - the app's primary market. */
const QUOTA_TIMEZONE = 'Asia/Kolkata';

export function dayKey(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: QUOTA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

/**
 * Resolves the caller and makes sure a profile document exists.
 * Callables are never reachable without a Firebase ID token.
 */
export async function requireUser(req: CallableRequest): Promise<Actor> {
  const auth = req.auth;
  if (!auth?.uid) {
    throw new HttpsError('unauthenticated', 'Please sign in to continue.');
  }

  const email = typeof auth.token.email === 'string' ? auth.token.email : undefined;
  const name = typeof auth.token.name === 'string' ? auth.token.name : undefined;
  const isAdmin = auth.token.admin === true || isAdminEmail(email);

  const ref = db.collection(collections.users).doc(auth.uid);
  const snap = await ref.get();

  if (!snap.exists) {
    await ref.set(
      {
        uid: auth.uid,
        email: email ?? null,
        displayName: name ?? (email ? email.split('@')[0] : 'Speaker'),
        photoURL: auth.token.picture ?? null,
        createdAt: FieldValueRef.serverTimestamp(),
        lastActiveAt: FieldValueRef.serverTimestamp(),
        targetLanguage: 'en-IN',
        voice: 'anushka',
        level: 'beginner',
        streakDays: 0
      },
      { merge: true }
    );
  }

  return { uid: auth.uid, email, name, isAdmin };
}

export async function requireAdmin(req: CallableRequest): Promise<Actor> {
  const actor = await requireUser(req);
  if (!actor.isAdmin) {
    throw new HttpsError('permission-denied', 'Only an administrator can manage AI providers.');
  }
  return actor;
}

export type QuotaKind = 'chat' | 'transcribe' | 'tts';

const LIMIT_FOR: Record<QuotaKind, number> = {
  chat: config.limits.chat,
  transcribe: config.limits.transcribe,
  tts: config.limits.tts
};

/**
 * Atomic per-user daily budget. Runs a transaction so two concurrent calls
 * cannot both slip under the limit.
 */
export async function consumeQuota(
  uid: string,
  kind: QuotaKind,
  meta: { providerId?: string; latencyMs?: number } = {}
): Promise<void> {
  const limit = LIMIT_FOR[kind];
  const day = dayKey();
  const ref = db.collection(collections.users).doc(uid).collection(collections.usage).doc(day);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = Number(snap.get(`${kind}Count`) ?? 0);

    if (limit > 0 && current >= limit) {
      throw new AppError(
        'resource-exhausted',
        `Daily ${kind} limit reached (${limit}). It resets at midnight IST.`
      );
    }

    tx.set(
      ref,
      {
        day,
        [`${kind}Count`]: current + 1,
        lastProvider: meta.providerId ?? null,
        lastLatencyMs: meta.latencyMs ?? null,
        updatedAt: FieldValueRef.serverTimestamp()
      },
      { merge: true }
    );
  });
}

/** Maps any thrown value onto a clean HttpsError without leaking internals. */
export function mapError(err: unknown): HttpsError {
  if (err instanceof HttpsError) return err;

  if (err instanceof ValidationError) {
    return new HttpsError('invalid-argument', err.message);
  }

  if (isAppError(err)) {
    return new HttpsError(err.code, err.message, err.details);
  }

  logger.error('[unhandled]', err);
  return new HttpsError('internal', 'Something went wrong on our side. Please try again.');
}

/** Wraps a callable body with uniform error handling. */
export function guarded<T>(
  fn: (req: CallableRequest<T>) => Promise<unknown>
): (req: CallableRequest<T>) => Promise<unknown> {
  return async (req: CallableRequest<T>) => {
    try {
      return await fn(req);
    } catch (err) {
      throw mapError(err);
    }
  };
}

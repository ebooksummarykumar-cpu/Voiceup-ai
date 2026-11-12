import { onCall } from 'firebase-functions/v2/https';
import { db, collections, FieldValueRef } from '../admin';
import { config } from '../config';
import { chat } from '../ai/chat';
import { getDefaultProviderId, listProviderStatus, resolveProvider } from '../ai/registry';
import { AppError } from '../errors';
import { consumeQuota, guarded, requireAdmin, requireUser } from '../guards';
import { asRecord, requireString, validateProviderInput } from '../lib/validation';
import { callableOptions } from './options';

/**
 * Returns provider METADATA only - id, name, format, model, capabilities and
 * whether a key is present. The key itself never crosses this boundary.
 */
export const listProviders = onCall(
  callableOptions({ timeoutSeconds: 30, memory: '256MiB' }),
  guarded(async (req) => {
    const actor = await requireUser(req);
    const [providers, defaultProvider] = await Promise.all([listProviderStatus(), getDefaultProviderId()]);

    return {
      providers,
      defaultProvider,
      isAdmin: actor.isAdmin,
      limits: config.limits
    };
  })
);

/** Admin-only: create or replace a provider, including its API key. */
export const saveProvider = onCall(
  callableOptions({ timeoutSeconds: 30, memory: '256MiB' }),
  guarded(async (req) => {
    await requireAdmin(req);
    const data = asRecord(req.data ?? {});

    // Editing an existing provider without re-typing the key keeps the old one.
    const requestedId = requireString(data.id, 'id', 40).toLowerCase();
    const ref = db.collection(collections.aiProviders).doc(requestedId);
    const existing = await ref.get();

    const input = validateProviderInput({
      ...data,
      apiKey: data.apiKey || (existing.exists ? existing.get('apiKey') : '')
    });

    await ref.set(
      {
        ...input,
        updatedAt: FieldValueRef.serverTimestamp(),
        ...(existing.exists ? {} : { createdAt: FieldValueRef.serverTimestamp() })
      },
      { merge: true }
    );

    if (data.makeDefault === true) {
      await db.collection('aiSettings').doc('default').set(
        { defaultProvider: input.id, updatedAt: FieldValueRef.serverTimestamp() },
        { merge: true }
      );
    }

    // Deliberately returns no key material.
    return { saved: true, id: input.id, name: input.name };
  })
);

export const deleteProvider = onCall(
  callableOptions({ timeoutSeconds: 30, memory: '256MiB' }),
  guarded(async (req) => {
    await requireAdmin(req);
    const data = asRecord(req.data ?? {});
    const id = requireString(data.id, 'id', 40).toLowerCase();

    if (['gemini', 'sarvam', 'openai', 'openrouter', 'groq'].includes(id)) {
      const stillInEnv = Boolean((config.keys as Record<string, string>)[id]);
      if (stillInEnv) {
        throw new AppError(
          'failed-precondition',
          `"${id}" is still configured through functions/.env. Remove the key there to disable it.`
        );
      }
    }

    await db.collection(collections.aiProviders).doc(id).delete();
    return { deleted: true, id };
  })
);

/**
 * Admin-only connectivity check. Makes the smallest possible real call so a
 * wrong key or model name surfaces here rather than mid-practice.
 */
export const testProvider = onCall(
  callableOptions({ timeoutSeconds: 60, memory: '256MiB' }),
  guarded(async (req) => {
    const actor = await requireAdmin(req);
    const data = asRecord(req.data ?? {});
    const providerId = requireString(data.providerId, 'providerId', 40);

    const cfg = await resolveProvider(providerId, 'chat');
    const started = Date.now();

    const result = await chat(cfg, {
      messages: [
        { role: 'system', content: 'You are a connectivity probe. Answer with exactly one word.' },
        { role: 'user', content: 'Reply with the single word: ready' }
      ],
      temperature: 0,
      maxTokens: 8
    });

    await consumeQuota(actor.uid, 'chat', { providerId: cfg.id, latencyMs: result.latencyMs });

    return {
      ok: true,
      providerId: cfg.id,
      model: cfg.model,
      sample: result.text.slice(0, 80),
      latencyMs: Date.now() - started
    };
  })
);

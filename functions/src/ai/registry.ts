/**
 * The provider registry.
 *
 * Two sources of truth, merged:
 *   - environment variables (operator-managed, simplest to bootstrap)
 *   - the `aiProviders` Firestore collection (admin-managed from the UI)
 *
 * The Firestore collection is locked down by rules - no client can read it -
 * and its API keys are never returned to the browser. Only metadata leaves
 * this module through `listProviderStatus`.
 */
import { db, collections } from '../admin';
import { config } from '../config';
import { AppError } from '../errors';
import { selectProvider } from './select';
import type { ApiFormat, ProviderConfig, ProviderStatus } from './types';

function envProviders(): ProviderConfig[] {
  const out: ProviderConfig[] = [];

  if (config.keys.gemini) {
    out.push({
      id: 'gemini',
      name: 'Google Gemini',
      format: 'gemini',
      endpoint: 'https://generativelanguage.googleapis.com/v1beta',
      apiKey: config.keys.gemini,
      model: config.models.geminiChat,
      sttModel: config.models.geminiAudio,
      supportsChat: true,
      supportsStt: true,
      supportsTts: false,
      source: 'env'
    });
  }

  if (config.keys.sarvam) {
    out.push({
      id: 'sarvam',
      name: 'Sarvam AI',
      format: 'openai',
      endpoint: 'https://api.sarvam.ai/v1',
      apiKey: config.keys.sarvam,
      model: config.models.sarvamChat,
      sttModel: config.models.sarvamStt,
      ttsModel: config.models.sarvamTts,
      voice: config.models.sarvamSpeaker,
      supportsChat: true,
      supportsStt: true,
      supportsTts: true,
      source: 'env'
    });
  }

  if (config.keys.openai) {
    out.push({
      id: 'openai',
      name: 'OpenAI',
      format: 'openai',
      endpoint: 'https://api.openai.com/v1',
      apiKey: config.keys.openai,
      model: config.models.openaiChat,
      sttModel: config.models.openaiStt,
      ttsModel: config.models.openaiTts,
      voice: 'alloy',
      supportsChat: true,
      supportsStt: true,
      supportsTts: true,
      source: 'env'
    });
  }

  if (config.keys.openrouter) {
    out.push({
      id: 'openrouter',
      name: 'OpenRouter',
      format: 'openai',
      endpoint: 'https://openrouter.ai/api/v1',
      apiKey: config.keys.openrouter,
      model: config.models.openrouterChat,
      supportsChat: true,
      supportsStt: false,
      supportsTts: false,
      source: 'env'
    });
  }

  if (config.keys.groq) {
    out.push({
      id: 'groq',
      name: 'Groq',
      format: 'openai',
      endpoint: 'https://api.groq.com/openai/v1',
      apiKey: config.keys.groq,
      model: config.models.groqChat,
      sttModel: config.models.groqStt,
      supportsChat: true,
      supportsStt: true,
      supportsTts: false,
      source: 'env'
    });
  }

  if (config.keys.custom && config.custom.endpoint) {
    out.push({
      id: 'custom',
      name: config.custom.name,
      format: 'openai',
      endpoint: config.custom.endpoint,
      apiKey: config.keys.custom,
      model: config.custom.model,
      supportsChat: true,
      supportsStt: true,
      supportsTts: true,
      source: 'env'
    });
  }

  return out;
}

const VALID_FORMATS: ApiFormat[] = ['openai', 'gemini', 'anthropic'];

function coerceFormat(value: unknown): ApiFormat {
  return VALID_FORMATS.includes(value as ApiFormat) ? (value as ApiFormat) : 'openai';
}

async function firestoreProviders(): Promise<ProviderConfig[]> {
  try {
    const snap = await db.collection(collections.aiProviders).get();
    const out: ProviderConfig[] = [];

    snap.forEach((doc) => {
      const d = doc.data();
      if (d.enabled === false) return;
      if (!d.apiKey || !d.endpoint || !d.model) return;

      out.push({
        id: doc.id,
        name: typeof d.name === 'string' ? d.name : doc.id,
        format: coerceFormat(d.format),
        endpoint: String(d.endpoint),
        apiKey: String(d.apiKey),
        model: String(d.model),
        sttModel: d.sttModel ? String(d.sttModel) : undefined,
        ttsModel: d.ttsModel ? String(d.ttsModel) : undefined,
        voice: d.voice ? String(d.voice) : undefined,
        extraHeaders:
          d.extraHeaders && typeof d.extraHeaders === 'object' ? (d.extraHeaders as Record<string, string>) : undefined,
        supportsChat: d.supportsChat !== false,
        supportsStt: d.supportsStt === true,
        supportsTts: d.supportsTts === true,
        source: 'firestore'
      });
    });

    return out;
  } catch (err) {
    // A missing collection or an IAM hiccup must not take the whole API down.
    console.warn('[registry] could not read aiProviders:', err instanceof Error ? err.message : err);
    return [];
  }
}

/** Firestore entries win over env entries with the same id. */
export async function allProviders(): Promise<ProviderConfig[]> {
  const [env, stored] = await Promise.all([Promise.resolve(envProviders()), firestoreProviders()]);
  const merged = new Map<string, ProviderConfig>();
  for (const p of env) merged.set(p.id, p);
  for (const p of stored) merged.set(p.id, p);
  return [...merged.values()];
}

/** The default can be overridden from the admin UI (aiSettings/default). */
export async function getDefaultProviderId(): Promise<string> {
  try {
    const snap = await db.collection('aiSettings').doc('default').get();
    const stored = snap.exists ? snap.get('defaultProvider') : undefined;
    if (typeof stored === 'string' && stored.trim()) return stored.trim();
  } catch (err) {
    console.warn('[registry] could not read aiSettings/default:', err instanceof Error ? err.message : err);
  }
  return config.defaultProvider;
}

export async function resolveProvider(
  requestedId: string | undefined,
  capability: 'chat' | 'stt' | 'tts' = 'chat'
): Promise<ProviderConfig> {
  const [providers, defaultId] = await Promise.all([allProviders(), getDefaultProviderId()]);
  try {
    return selectProvider(providers, requestedId, defaultId, capability);
  } catch (err) {
    throw new AppError('failed-precondition', err instanceof Error ? err.message : 'No provider available');
  }
}

export async function listProviderStatus(): Promise<ProviderStatus[]> {
  const providers = await allProviders();
  return providers
    .map((p) => ({
      id: p.id,
      name: p.name,
      format: p.format,
      model: p.model,
      source: p.source,
      configured: Boolean(p.apiKey && p.endpoint),
      capabilities: { chat: p.supportsChat, stt: p.supportsStt, tts: p.supportsTts }
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

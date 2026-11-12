import { onCall } from 'firebase-functions/v2/https';
import { chat } from '../ai/chat';
import { COACH_SYSTEM_PROMPT } from '../ai/prompts';
import { resolveProvider } from '../ai/registry';
import { speak } from '../ai/tts';
import type { ChatMessage } from '../ai/types';
import { consumeQuota, guarded, requireUser } from '../guards';
import {
  asRecord,
  clampNumber,
  normaliseMessages,
  optionalString,
  requireString
} from '../lib/validation';
import { callableOptions } from './options';

/**
 * Free-form coaching conversation. The client sends history; the server owns
 * the system prompt, the provider choice and the credentials.
 */
export const aiChat = onCall(
  callableOptions({ timeoutSeconds: 120, memory: '512MiB' }),
  guarded(async (req) => {
    const actor = await requireUser(req);
    const data = asRecord(req.data ?? {});

    const messages = normaliseMessages(data.messages);
    const providerId = optionalString(data.providerId, 'providerId', 40);

    const fullMessages: ChatMessage[] = [
      { role: 'system', content: COACH_SYSTEM_PROMPT },
      ...messages.filter((m) => m.role !== 'system')
    ];

    const cfg = await resolveProvider(providerId, 'chat');
    const result = await chat(cfg, {
      messages: fullMessages,
      temperature: clampNumber(data.temperature, 0, 1.2, 0.7),
      maxTokens: clampNumber(data.maxTokens, 64, 2048, 700)
    });

    await consumeQuota(actor.uid, 'chat', { providerId: result.providerId, latencyMs: result.latencyMs });

    return {
      text: result.text,
      provider: { id: result.providerId, name: result.providerName, model: result.model },
      latencyMs: result.latencyMs
    };
  })
);

/**
 * Text-to-speech for coach replies and roleplay turns. Returns ordered audio
 * segments because some vendors cap a single call at ~500 characters.
 */
export const speakText = onCall(
  callableOptions({ timeoutSeconds: 120, memory: '512MiB' }),
  guarded(async (req) => {
    const actor = await requireUser(req);
    const data = asRecord(req.data ?? {});

    const text = requireString(data.text, 'text', 3000);
    const language = optionalString(data.language, 'language', 16) ?? 'en-IN';
    const providerId = optionalString(data.providerId, 'providerId', 40);
    const voice = optionalString(data.voice, 'voice', 60);

    const cfg = await resolveProvider(providerId, 'tts');
    const result = await speak({ ...cfg, voice: voice ?? cfg.voice }, text, language);

    await consumeQuota(actor.uid, 'tts', { providerId: result.providerId, latencyMs: result.latencyMs });

    return {
      segments: result.segments,
      provider: { id: result.providerId, name: result.providerName },
      latencyMs: result.latencyMs
    };
  })
);

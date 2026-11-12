import { onCall } from 'firebase-functions/v2/https';
import { db, collections, FieldValueRef, storage } from '../admin';
import { config } from '../config';
import { findScenario } from '../content/catalogue';
import { chat } from '../ai/chat';
import { roleplayDebriefPrompt, roleplaySystemPrompt } from '../ai/prompts';
import { resolveProvider } from '../ai/registry';
import { transcribe } from '../ai/stt';
import { speak } from '../ai/tts';
import type { ChatMessage } from '../ai/types';
import { AppError } from '../errors';
import { consumeQuota, guarded, requireUser } from '../guards';
import { extractJsonObject, normaliseScore } from '../lib/score';
import { asRecord, isOwnedStoragePath, optionalString, requireString } from '../lib/validation';
import { callableOptions } from './options';

interface ThreadMessage {
  role: 'assistant' | 'user';
  content: string;
  at?: unknown;
  provider?: string;
}

interface ThreadDoc {
  uid: string;
  scenarioId: string;
  title: string;
  language: string;
  messages: ThreadMessage[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

function threadRef(uid: string, threadId: string) {
  return db.collection(collections.users).doc(uid).collection('roleplay').doc(threadId);
}

async function loadThread(uid: string, threadId: string): Promise<ThreadDoc> {
  const snap = await threadRef(uid, threadId).get();
  if (!snap.exists) throw new AppError('not-found', 'That roleplay conversation no longer exists.');
  const data = snap.data() as ThreadDoc;
  if (data.uid !== uid) throw new AppError('permission-denied', 'That conversation belongs to another user.');
  return data;
}

/** Opens a new roleplay thread and lets the persona speak first. */
export const startRoleplay = onCall(
  callableOptions({ timeoutSeconds: 120, memory: '512MiB' }),
  guarded(async (req) => {
    const actor = await requireUser(req);
    const data = asRecord(req.data ?? {});

    const scenarioId = requireString(data.scenarioId, 'scenarioId', 80);
    const language = optionalString(data.language, 'language', 16) ?? 'en-IN';

    const scenario = findScenario(scenarioId);
    if (!scenario) throw new AppError('not-found', 'Unknown scenario.');

    const cfg = await resolveProvider(optionalString(data.providerId, 'providerId', 40), 'chat');

    const result = await chat(cfg, {
      messages: [
        {
          role: 'system',
          content: roleplaySystemPrompt({
            personaName: scenario.personaName,
            personaRole: scenario.personaRole,
            personality: scenario.personality,
            setting: scenario.setting,
            goal: scenario.goal,
            language
          })
        },
        { role: 'user', content: `[The exercise begins. Say your opening line as ${scenario.personaName}.]` }
      ],
      temperature: 0.85,
      maxTokens: 220
    });

    const ref = db.collection(collections.users).doc(actor.uid).collection('roleplay').doc();

    await ref.set({
      uid: actor.uid,
      scenarioId,
      title: scenario.title,
      language,
      messages: [{ role: 'assistant', content: result.text, at: FieldValueRef.serverTimestamp() }],
      createdAt: FieldValueRef.serverTimestamp(),
      updatedAt: FieldValueRef.serverTimestamp()
    });

    await consumeQuota(actor.uid, 'chat', { providerId: result.providerId, latencyMs: result.latencyMs });

    return {
      threadId: ref.id,
      opening: result.text,
      scenario: { id: scenario.id, title: scenario.title, personaName: scenario.personaName },
      provider: { id: result.providerId, name: result.providerName }
    };
  })
);

/**
 * One roleplay exchange. Accepts either typed text or a Storage path to a
 * recording, transcribes it if needed, and optionally returns spoken audio.
 * History lives in Firestore and is replayed server-side, so the client cannot
 * rewrite the persona's earlier lines.
 */
export const roleplayTurn = onCall(
  callableOptions({ timeoutSeconds: 180, memory: '1GiB' }),
  guarded(async (req) => {
    const actor = await requireUser(req);
    const data = asRecord(req.data ?? {});

    const threadId = requireString(data.threadId, 'threadId', 120);
    const text = optionalString(data.text, 'text', 2000);
    const audioPath = optionalString(data.audioPath, 'audioPath', 400);
    const wantSpeech = data.speak === true;

    if (!text && !audioPath) {
      throw new AppError('invalid-argument', 'Send either text or audioPath.');
    }

    const thread = await loadThread(actor.uid, threadId);
    const scenario = findScenario(thread.scenarioId);
    if (!scenario) throw new AppError('failed-precondition', 'This scenario no longer exists.');

    let userText = text ?? '';

    if (!userText && audioPath) {
      if (!isOwnedStoragePath(audioPath, actor.uid, 'recordings')) {
        throw new AppError('permission-denied', 'That recording path is not yours.');
      }

      const file = storage.bucket(config.storageBucket).file(audioPath);
      const [meta] = await file.getMetadata();
      if (Number(meta.size ?? 0) > config.maxUploadBytes) {
        throw new AppError('invalid-argument', 'That recording is too large.');
      }
      const [buffer] = await file.download();

      const sttCfg = await resolveProvider(optionalString(data.sttProviderId, 'sttProviderId', 40), 'stt');
      const heard = await transcribe(sttCfg, buffer, String(meta.contentType ?? 'audio/webm'), thread.language);
      userText = heard.text;

      await consumeQuota(actor.uid, 'transcribe', {
        providerId: heard.providerId,
        latencyMs: heard.latencyMs
      });
    }

    const history: ChatMessage[] = (thread.messages ?? []).slice(-16).map((m) => ({
      role: m.role,
      content: m.content
    }));

    const cfg = await resolveProvider(optionalString(data.providerId, 'providerId', 40), 'chat');

    const result = await chat(cfg, {
      messages: [
        {
          role: 'system',
          content: roleplaySystemPrompt({
            personaName: scenario.personaName,
            personaRole: scenario.personaRole,
            personality: scenario.personality,
            setting: scenario.setting,
            goal: scenario.goal,
            language: thread.language
          })
        },
        ...history,
        { role: 'user', content: userText }
      ],
      temperature: 0.85,
      maxTokens: 260
    });

    await consumeQuota(actor.uid, 'chat', { providerId: result.providerId, latencyMs: result.latencyMs });

    const now = FieldValueRef.serverTimestamp();
    await threadRef(actor.uid, threadId).update({
      messages: [
        ...(thread.messages ?? []),
        { role: 'user', content: userText, at: now },
        { role: 'assistant', content: result.text, at: now, provider: result.providerId }
      ],
      updatedAt: now
    });

    let audio: { segments: { audioBase64: string; mimeType: string }[] } | null = null;

    if (wantSpeech) {
      try {
        const ttsCfg = await resolveProvider(optionalString(data.ttsProviderId, 'ttsProviderId', 40), 'tts');
        const spoken = await speak(ttsCfg, result.text, thread.language);
        audio = { segments: spoken.segments };
        await consumeQuota(actor.uid, 'tts', {
          providerId: spoken.providerId,
          latencyMs: spoken.latencyMs
        });
      } catch (err) {
        // A failed synthesis must not lose the reply that was already generated.
        console.warn('[roleplay] TTS failed:', err instanceof Error ? err.message : err);
      }
    }

    return {
      userText,
      reply: result.text,
      audio,
      provider: { id: result.providerId, name: result.providerName }
    };
  })
);

/** End-of-roleplay debrief, scored against the scenario goal. */
export const debriefRoleplay = onCall(
  callableOptions({ timeoutSeconds: 120, memory: '512MiB' }),
  guarded(async (req) => {
    const actor = await requireUser(req);
    const data = asRecord(req.data ?? {});

    const threadId = requireString(data.threadId, 'threadId', 120);
    const thread = await loadThread(actor.uid, threadId);
    const scenario = findScenario(thread.scenarioId);
    if (!scenario) throw new AppError('failed-precondition', 'This scenario no longer exists.');

    const userTurns = (thread.messages ?? []).filter((m) => m.role === 'user');
    if (userTurns.length < 1) {
      throw new AppError('failed-precondition', 'Say at least one thing before asking for a debrief.');
    }

    const transcript = (thread.messages ?? [])
      .map((m) => `${m.role === 'user' ? 'LEARNER' : scenario.personaName.toUpperCase()}: ${m.content}`)
      .join('\n');

    const cfg = await resolveProvider(optionalString(data.providerId, 'providerId', 40), 'chat');

    const result = await chat(cfg, {
      messages: [
        { role: 'system', content: 'You are a speech coach. You return only valid JSON.' },
        { role: 'user', content: roleplayDebriefPrompt(transcript, scenario.goal) }
      ],
      temperature: 0.3,
      maxTokens: 700,
      jsonMode: true
    });

    // Reuse the tolerant extractor: models sometimes wrap JSON in prose.
    let raw: any = {};
    try {
      raw = JSON.parse(extractJsonObject(result.text));
    } catch {
      raw = {};
    }

    const parsed = normaliseScore(raw);

    await consumeQuota(actor.uid, 'chat', { providerId: result.providerId, latencyMs: result.latencyMs });

    return {
      overall: parsed.overall,
      wentWell: Array.isArray(raw.wentWell) ? raw.wentWell.slice(0, 4) : parsed.strengths,
      workOn: Array.isArray(raw.workOn) ? raw.workOn.slice(0, 4) : parsed.improvements,
      bestLine: typeof raw.bestLine === 'string' ? raw.bestLine : '',
      nextTime: typeof raw.nextTime === 'string' ? raw.nextTime : parsed.coachNote
    };
  })
);

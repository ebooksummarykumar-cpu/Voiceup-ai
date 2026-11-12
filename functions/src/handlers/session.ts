import { onCall } from 'firebase-functions/v2/https';
import { storage, db, collections, FieldValueRef } from '../admin';
import { config } from '../config';
import { findLesson } from '../content/catalogue';
import { chat } from '../ai/chat';
import { scoringPrompt } from '../ai/prompts';
import { resolveProvider } from '../ai/registry';
import { transcribe } from '../ai/stt';
import { AppError } from '../errors';
import { consumeQuota, guarded, requireUser } from '../guards';
import { parseScoreJson } from '../lib/score';
import { asRecord, isOwnedStoragePath, optionalString, requireString } from '../lib/validation';
import { callableOptions } from './options';

interface SessionDoc {
  uid: string;
  type: 'coach' | 'lesson' | 'roleplay';
  lessonId?: string;
  audioPath?: string;
  durationMs?: number;
  transcript?: string;
  status?: string;
}

async function loadOwnedSession(sessionId: string, uid: string): Promise<SessionDoc> {
  const snap = await db.collection(collections.sessions).doc(sessionId).get();
  if (!snap.exists) throw new AppError('not-found', 'That practice session no longer exists.');

  const data = snap.data() as SessionDoc;
  if (data.uid !== uid) throw new AppError('permission-denied', 'That session belongs to another user.');
  return data;
}

/**
 * Downloads the caller's recording from Cloud Storage and transcribes it with
 * the configured speech provider. The audio path is validated against the
 * caller's uid, so one user can never transcribe another user's file.
 */
export const transcribeSession = onCall(
  callableOptions({ timeoutSeconds: 180, memory: '1GiB' }),
  guarded(async (req) => {
    const actor = await requireUser(req);
    const data = asRecord(req.data ?? {});

    const sessionId = requireString(data.sessionId, 'sessionId', 120);
    const providerId = optionalString(data.providerId, 'providerId', 40);
    const language = optionalString(data.language, 'language', 16);

    const session = await loadOwnedSession(sessionId, actor.uid);

    if (!session.audioPath) {
      throw new AppError('failed-precondition', 'This session has no uploaded recording.');
    }
    if (!isOwnedStoragePath(session.audioPath, actor.uid, 'recordings')) {
      throw new AppError('permission-denied', 'That recording path is not yours.');
    }

    const file = storage.bucket(config.storageBucket).file(session.audioPath);
    const [exists] = await file.exists();
    if (!exists) throw new AppError('not-found', 'The recording has not finished uploading. Try again in a moment.');

    const [meta] = await file.getMetadata();
    const size = Number(meta.size ?? 0);
    if (size > config.maxUploadBytes) {
      throw new AppError('invalid-argument', 'That recording is larger than 12 MB. Keep attempts under 10 minutes.');
    }

    const [buffer] = await file.download();
    const mimeType = String(meta.contentType ?? 'audio/webm');

    const cfg = await resolveProvider(providerId, 'stt');
    const result = await transcribe(cfg, buffer, mimeType, language);

    await db.collection(collections.sessions).doc(sessionId).update({
      transcript: result.text,
      transcriptProvider: result.providerId,
      transcriptLanguage: result.language ?? null,
      status: 'transcribed',
      transcribedAt: FieldValueRef.serverTimestamp()
    });

    await consumeQuota(actor.uid, 'transcribe', {
      providerId: result.providerId,
      latencyMs: result.latencyMs
    });

    return {
      transcript: result.text,
      language: result.language ?? null,
      provider: { id: result.providerId, name: result.providerName },
      latencyMs: result.latencyMs
    };
  })
);

/**
 * Scores a transcribed attempt. The transcript is read from Firestore, never
 * from the client, so a user cannot paste in a better answer than they spoke.
 */
export const scoreSession = onCall(
  callableOptions({ timeoutSeconds: 120, memory: '512MiB' }),
  guarded(async (req) => {
    const actor = await requireUser(req);
    const data = asRecord(req.data ?? {});

    const sessionId = requireString(data.sessionId, 'sessionId', 120);
    const providerId = optionalString(data.providerId, 'providerId', 40);

    const session = await loadOwnedSession(sessionId, actor.uid);

    if (!session.transcript || session.transcript.trim().length === 0) {
      throw new AppError('failed-precondition', 'Transcribe the recording before scoring it.');
    }

    const lesson = session.lessonId ? findLesson(session.lessonId) : undefined;

    const prompt = scoringPrompt({
      transcript: session.transcript,
      durationMs: Number(session.durationMs ?? 0),
      promptText: lesson?.prompt,
      rubric: lesson?.rubric
    });

    const cfg = await resolveProvider(providerId, 'chat');
    const result = await chat(cfg, {
      messages: [
        { role: 'system', content: 'You are a strict but fair speech coach. You return only valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      maxTokens: 1200,
      jsonMode: true
    });

    const score = parseScoreJson(result.text);

    await db.collection(collections.sessions).doc(sessionId).update({
      score,
      scoreProvider: result.providerId,
      status: 'scored',
      scoredAt: FieldValueRef.serverTimestamp()
    });

    await consumeQuota(actor.uid, 'chat', { providerId: result.providerId, latencyMs: result.latencyMs });

    return { score, sessionId, provider: { id: result.providerId, name: result.providerName } };
  })
);

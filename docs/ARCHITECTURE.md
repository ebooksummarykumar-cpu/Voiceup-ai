# Architecture

## Shape of the system

VOICEUP AI is a static single-page app talking to a serverless backend.

- **Netlify** serves the compiled React bundle from a CDN. It does no computation.
- **Firebase Cloud Functions** does all the work that needs a secret or a trust boundary.
- **Firestore** holds user data; **Cloud Storage** holds audio.
- **AI providers** are called from inside the functions, never from the browser.

The split exists for one reason: an AI API key cannot be shipped to a browser. Everything else
follows from that.

---

## Why the frontend cannot cheat

The interesting design decision is that the client is treated as untrusted even though it is our
own code.

1. **A score is never computed on the client.** `scoreSession` loads the transcript from Firestore.
2. **A transcript is never accepted from the client.** `transcribeSession` downloads the audio from
   Storage using the path stored on the session document.
3. **A session shell is all the client may create.** `firestore.rules` forbids `transcript`, `score`
   and `feedback` keys on create, and forbids them on update entirely.
4. **A storage path is checked, not trusted.** `isOwnedStoragePath()` requires the path to start
   with `recordings/{caller-uid}/` and rejects `..`. Prefix tricks (`recordings/abcdef/…` for uid
   `abc`) are caught by requiring the trailing slash.

So the only way to get a high score is to actually speak well.

---

## Request flows

### A practice attempt

```
1. Browser      MediaRecorder → Blob (webm/opus)
2. Browser      uploadBytes → recordings/{uid}/{sessionId}.webm
3. Browser      setDoc sessions/{id}  { uid, type, lessonId, audioPath, durationMs }
                  → rules: no transcript/score keys allowed
4. Browser  →   transcribeSession({ sessionId })
5. Function     load session, verify uid, verify path, download from Storage
6. Function     provider.stt → transcript
7. Function     update session { transcript, status: 'transcribed' }
8. Browser  →   scoreSession({ sessionId })
9. Function     read transcript from Firestore (not from the request)
10. Function    provider.chat(jsonMode) → strict JSON
11. Function    normalise + clamp the score, update session { score, status: 'scored' }
12. Browser     renders ScoreCard
```

Three round trips, each independently retryable. A failed transcription does not lose the audio; a
failed scoring does not lose the transcript.

### A roleplay turn

```
1. Browser      record (or type) → optional upload to recordings/{uid}/turn-*.webm
2. Browser  →   roleplayTurn({ threadId, audioPath | text, speak })
3. Function     load thread from Firestore — the client cannot rewrite history
4. Function     if audioPath: verify ownership, download, transcribe
5. Function     system prompt = persona + setting + goal (held server-side)
6. Function     provider.chat → 1-3 sentence in-character reply
7. Function     append both turns to the thread (Admin SDK write)
8. Function     if speak: provider.tts → ordered audio segments
9. Browser      plays segments in order
```

Personas live in `functions/src/content/catalogue.ts`. The client receives a description of the
scenario, never the system prompt, so it cannot inject its own.

---

## The provider layer

```
handlers/*            know about HTTP, auth, quota, Firestore
    │
ai/registry.ts       resolves config: env + Firestore, merged
    │
ai/select.ts         pure precedence: requested → default → first usable
    │
ai/chat.ts           one chat call, any format
ai/stt.ts            one transcription, vendor-branched
ai/tts.ts            one synthesis, chunked
    │
ai/formats.ts        pure: build request, parse response  ← unit tested
http.ts              timeout + bounded retries, safe error messages
```

`formats.ts` has no Firebase and no network imports, which is what makes it testable without
mocking anything.

### Format differences that actually matter

| | OpenAI-compatible | Gemini | Anthropic |
| --- | --- | --- | --- |
| URL | `/chat/completions` | `/models/{model}:generateContent` | `/messages` |
| Auth | `Authorization: Bearer` | `x-goog-api-key` | `x-api-key` + version |
| System prompt | a message in the array | `systemInstruction` | top-level `system` |
| Assistant role | `assistant` | `model` | `assistant` |
| Token cap | `max_tokens` | `maxOutputTokens` | `max_tokens` |
| JSON mode | `response_format` | `responseMimeType` | prompt only |

Ignoring these is the usual way a "universal AI client" breaks on its second provider.

### Speech is not uniform either

- **Sarvam** caps one TTS call at ~500 characters and returns base64 WAV. `splitForTts()` breaks
  text on sentence boundaries (including the Devanagari danda) and the reply comes back as ordered
  segments that the client plays in sequence.
- **OpenAI / Groq** accept a file upload for transcription and return binary MP3 for synthesis.
- **Gemini** takes inline base64 audio for transcription and has no TTS at all.

`supportsStt` / `supportsTts` are declared per provider, so `resolveProvider(_, 'tts')` will never
pick a provider that cannot speak.

---

## Cost and abuse control

`consumeQuota(uid, kind)` runs a Firestore transaction against
`users/{uid}/usage/{yyyy-mm-dd}`:

```
read current count → if >= limit throw resource-exhausted → else increment
```

A transaction, not a read-then-write, so two concurrent calls cannot both slip under the limit.
The day key is computed in `Asia/Kolkata`, so the budget resets at local midnight rather than UTC.
Counters live in a subcollection the client can read but never write.

---

## Frontend structure

- `AuthContext` owns the Firebase user and mirrors a Firestore profile document with `onSnapshot`,
  so a language change in Settings propagates without a reload.
- `useCatalogue()` fetches lessons and scenarios once per session and caches them in a module-level
  variable, with an in-flight promise guard so ten components mounting at once still make one call.
- `useRecorder()` encapsulates MediaRecorder, the `AnalyserNode` level meter, an auto-stop at three
  minutes, and the cleanup that releases the microphone on unmount. Releasing the track matters:
  otherwise the browser tab keeps showing the recording indicator.
- `PracticeRunner` is shared by free practice and lessons, so there is one implementation of the
  upload → transcribe → score flow rather than two that drift.

---

## What was deliberately not built

See `KNOWN_LIMITATIONS.md`. The short version: no server-side rate limiting by IP (only per-user
quota), no App Check enforcement, no automated Firestore rules tests against the emulator, and no
audio stitching across TTS segments — segments are played in sequence instead.

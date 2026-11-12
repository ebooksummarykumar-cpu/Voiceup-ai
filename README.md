# VOICEUP AI

**An AI voice and communication coach.** Record yourself speaking, get an honest score on clarity,
pace, grammar and confidence, work through targeted lessons, and roleplay the conversations you are
dreading — a job interview, an angry client, a salary negotiation — with an AI that plays the other
person and speaks its replies out loud.

This is a real full-stack application, not a UI prototype. The browser holds no credentials, the
backend runs on Firebase, and the frontend ships from Netlify.

---

## What is actually built

| Area | Status |
| --- | --- |
| Microphone recording, playback, live level meter | Working (MediaRecorder + Web Audio) |
| Firebase Auth (Google + email/password) | Working |
| Firestore data model + security rules | Working, rules deny by default |
| Cloud Storage uploads with per-user isolation | Working |
| Speech-to-text (Sarvam, Gemini, OpenAI/Groq Whisper) | Working, provider-agnostic |
| AI scoring with a structured rubric | Working |
| Text-to-speech coach replies and roleplay | Working |
| Roleplay engine with server-held personas | Working |
| 10 speaking lessons, 6 roleplay scenarios | Working |
| Admin UI for AI providers | Working (admin-only) |
| Netlify build + SPA routing + deploy previews | Configured |
| Automated tests (67 backend, 9 frontend) | Passing |
| CI on push/PR (build, test, secret scan) | Configured |

See `docs/KNOWN_LIMITATIONS.md` for what is deliberately *not* finished.

---

## Stack

- **Frontend** — React 18, Vite 5, TypeScript, React Router. Static build, no SSR.
- **Backend** — Firebase Cloud Functions v2 (Node 20, `asia-south1`), Firebase Auth, Firestore,
  Cloud Storage.
- **Hosting** — Netlify for the static frontend only.
- **AI** — a provider registry with adapters for Google Gemini, Sarvam AI, OpenAI, OpenRouter,
  Groq and any OpenAI-compatible custom endpoint.

---

## Architecture

```
                 ┌──────────────────────────────┐
   Browser  ───► │  Netlify CDN                 │   static React bundle
                 │  (SPA, /* → /index.html)     │
                 └───────────────┬──────────────┘
                                 │  Firebase ID token
                 ┌───────────────▼──────────────┐
                 │  Cloud Functions (v2)        │
                 │  aiChat · transcribeSession  │
                 │  scoreSession · speakText    │
                 │  startRoleplay · roleplayTurn│
                 │  getCatalogue · providers    │
                 └───┬───────────┬──────────┬───┘
                     │           │          │
             ┌───────▼──┐  ┌─────▼─────┐ ┌──▼────────────┐
             │Firestore │  │  Storage  │ │ AI providers  │
             │ rules    │  │  rules    │ │ (keys server  │
             │ deny-all │  │ per-user  │ │  side only)   │
             └──────────┘  └───────────┘ └───────────────┘
```

**Why no Netlify Functions:** the backend already exists in Firebase. Duplicating it would double
the secret surface and split the data model. Netlify serves bytes; Firebase does work.

---

## Repository layout

```
voiceup-ai/
├── web/                       React + Vite frontend
│   ├── src/
│   │   ├── components/        AppShell, RecordPanel, PracticeRunner, ScoreCard, ScoreRing…
│   │   ├── context/           AuthContext (Firebase Auth + profile sync)
│   │   ├── hooks/             useCatalogue (server-served curriculum, cached)
│   │   ├── lib/               firebase, api (typed callables), recorder, sessions, audio, format
│   │   └── pages/             Auth, Setup, Dashboard, Practice, Lessons, Roleplay, Progress, Settings
│   └── .env.example
├── functions/                 Firebase Cloud Functions
│   ├── src/
│   │   ├── ai/                registry, formats, chat, stt, tts, prompts, chunk, select
│   │   ├── content/           lessons + scenarios (single source of truth)
│   │   ├── handlers/          one file per endpoint group
│   │   ├── lib/               score parsing, validation
│   │   ├── guards.ts          auth, admin, per-user daily quota
│   │   └── index.ts
│   └── test/                  67 unit tests (vitest)
├── docs/                      setup, deployment, architecture, limitations
├── scripts/check-secrets.mjs  pre-commit / CI secret scanner
├── firestore.rules            deny-by-default rules
├── storage.rules              per-user storage isolation
├── firebase.json              functions + rules + emulators
├── netlify.toml               build, SPA redirects, headers, deploy previews
└── .github/workflows/ci.yml   build + test + secret scan
```

---

## Quick start

```bash
git clone <this-repo>
cd voiceup-ai

# 1. Install both halves
npm run install:all

# 2. Configure the frontend (Firebase web config - public, not secret)
cp web/.env.example web/.env
#    ...fill in the six VITE_FIREBASE_* values

# 3. Configure the backend (real secrets - never commit)
cp functions/.env.example functions/.env
#    ...add at least one provider key, e.g. GEMINI_API_KEY

# 4. Run
npm run dev:web          # http://localhost:5173
```

For a fully local run with the Firebase emulators:

```bash
firebase emulators:start --only auth,firestore,storage,functions
# in another terminal
VITE_USE_EMULATORS=true npm run dev:web
```

Detailed instructions: [`docs/FIREBASE_SETUP.md`](docs/FIREBASE_SETUP.md) ·
[`docs/NETLIFY_DEPLOY.md`](docs/NETLIFY_DEPLOY.md) ·
[`docs/ENV_CHECKLIST.md`](docs/ENV_CHECKLIST.md)

---

## API surface

Every endpoint below is a Firebase callable that requires a valid ID token, except `health`.

| Callable | Purpose | Capability used |
| --- | --- | --- |
| `aiChat` | Free-form coaching conversation | chat |
| `speakText` | Text → speech (returns ordered audio segments) | tts |
| `transcribeSession` | Download the caller's recording, transcribe it, store the transcript | stt |
| `scoreSession` | Score a stored transcript against a rubric | chat |
| `startRoleplay` | Open a thread, let the persona speak first | chat |
| `roleplayTurn` | One exchange, from text or audio, optionally spoken | stt + chat + tts |
| `debriefRoleplay` | End-of-conversation feedback | chat |
| `getCatalogue` | Lessons and scenarios | — |
| `listProviders` | Provider metadata (never keys) | — |
| `saveProvider` / `deleteProvider` / `testProvider` | Admin-only provider management | chat |
| `health` (HTTPS GET) | Liveness probe, reports which providers are configured | — |

---

## The AI provider manager

Providers are described by `{ id, name, format, endpoint, apiKey, model, capabilities }` and can
come from two places, merged at runtime:

1. **Environment variables** in `functions/.env` — fastest to bootstrap.
2. **The `aiProviders` Firestore collection** — managed from Settings in the app by an admin.

Three wire formats are implemented, because providers genuinely differ:

- `openai` — `POST {endpoint}/chat/completions`, `Authorization: Bearer`. Covers OpenAI, OpenRouter,
  Groq, Sarvam and any compatible endpoint.
- `gemini` — `POST {endpoint}/models/{model}:generateContent`, `x-goog-api-key`, with the system
  prompt lifted into `systemInstruction`.
- `anthropic` — `POST {endpoint}/messages`, `x-api-key` + `anthropic-version`.

Transcription and synthesis are vendor-specific and handled per provider id (Sarvam `saarika`/
`bulbul`, Gemini inline audio, Whisper-compatible endpoints). Selection precedence is
*requested provider → configured default → first usable provider*, and it is unit tested.

**Keys never reach the browser.** `listProviders` returns metadata and a `configured` boolean only.
The `aiProviders` collection is `allow read, write: if false` for all clients.

---

## Security model

| Concern | Control |
| --- | --- |
| Unauthenticated access | Every callable calls `requireUser()`; Firestore/Storage rules require `request.auth` |
| Cross-user data access | Rules check `resource.data.uid == request.auth.uid`; storage paths are `recordings/{uid}/…` |
| Tampering with a score | Clients may not write `transcript`, `score` or `feedback`; rules forbid those keys on create, and only Functions (Admin SDK) write them |
| Prompt-stuffing a better answer | Scoring reads the transcript from Firestore, never from the request body |
| API key leakage | Keys live only in the Functions process env or the locked `aiProviders` collection |
| Runaway cost | Atomic per-user daily quota (chat/transcribe/tts) in a Firestore transaction |
| Secret in git | `scripts/check-secrets.mjs` runs in CI and blocks the build |
| Path traversal | `isOwnedStoragePath()` rejects `..` and prefix tricks; unit tested |

Run the scanner yourself any time:

```bash
npm run check:secrets
```

---

## Testing

```bash
npm test                 # both halves
npm --prefix functions test
npm --prefix web test
```

76 tests total: request building and response parsing for all three wire formats, provider
selection precedence, score-JSON extraction (fenced, prose-wrapped, escaped quotes, truncated),
input validation and storage-path ownership, TTS chunking including Devanagari, and the pure
frontend formatters.

---

## Deployment, in one paragraph

Deploy rules and functions with `firebase deploy --only functions,firestore:rules,firestore:indexes,storage`
after `firebase use --add`. Connect the GitHub repo to a Netlify site with base directory `web`,
build `npm ci && npm run build`, publish `dist`, and add the six `VITE_FIREBASE_*` variables plus
`VITE_FUNCTIONS_REGION`. Push to `main` and Netlify rebuilds; open a PR and you get a deploy
preview. Full steps in [`docs/NETLIFY_DEPLOY.md`](docs/NETLIFY_DEPLOY.md).

---

## License

MIT. See `LICENSE`.

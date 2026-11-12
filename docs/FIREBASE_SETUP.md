# Firebase setup

Everything here is done once, in the Firebase console and the Firebase CLI. You need a Google
account and Node 20.

---

## 1. Create the project

1. Go to <https://console.firebase.google.com> → **Add project**.
2. Name it something like `voiceup-ai`. Analytics is optional.
3. Upgrade to the **Blaze (pay-as-you-go)** plan. Cloud Functions and outbound network calls to AI
   providers require Blaze. Budget alerts are free — set one before you deploy.

---

## 2. Register a web app

**Project settings → General → Your apps → Web (`</>`)**.

Copy the six config values into `web/.env`:

```bash
cp web/.env.example web/.env
```

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FUNCTIONS_REGION=asia-south1
```

These values are **public**. They identify the project; they do not grant access. Access is decided
by Firebase Auth and by the security rules in this repo.

> If you skip this step the app still builds, but shows a setup screen instead of the login page —
> it will not fail silently.

---

## 3. Enable Authentication

**Authentication → Get started → Sign-in method**:

- **Google** — enable, choose a support email.
- **Email/Password** — enable.

Then **Authentication → Settings → Authorized domains** and add:

- `localhost` (already there)
- `your-site.netlify.app`
- any custom domain you attach

Without this, Google sign-in fails with `auth/unauthorized-domain`.

---

## 4. Create Firestore

**Firestore Database → Create database → Production mode → region `asia-south1`**.

Production mode starts locked down; the rules in this repo are stricter still and are deployed in
step 7.

### Data model

| Path | Written by | Purpose |
| --- | --- | --- |
| `users/{uid}` | client (own doc) + Functions | profile, language, voice, level |
| `users/{uid}/usage/{yyyy-mm-dd}` | Functions only | daily quota counters |
| `users/{uid}/roleplay/{threadId}` | Functions (create), client (read/delete) | roleplay transcript |
| `sessions/{sessionId}` | client (shell) + Functions (results) | recording metadata, transcript, score |
| `aiProviders/{id}` | Functions only (admin) | provider config incl. API key |
| `aiSettings/default` | Functions only (admin) | which provider is default |

### Composite indexes

`firestore.indexes.json` declares the two the app needs (`uid` + `createdAt`, and
`uid` + `type` + `createdAt`). They are created by the deploy in step 7. If you create them by hand
instead, the console will offer a one-click link the first time a query fails.

---

## 5. Enable Cloud Storage

**Storage → Get started → Production mode → same region**.

The rules in `storage.rules` allow a user to write only under `recordings/{their-uid}/` and read only
their own objects, with a 12 MB cap and audio content types only.

---

## 6. Configure the backend secrets

```bash
cp functions/.env.example functions/.env
```

Add at least one provider key:

```env
GEMINI_API_KEY=your_key_here
DEFAULT_AI_PROVIDER=gemini
ADMIN_EMAILS=you@example.com
ALLOWED_ORIGINS=http://localhost:5173,https://your-site.netlify.app
```

**Getting keys**

| Provider | Where | Notes |
| --- | --- | --- |
| Gemini | <https://aistudio.google.com/apikey> | Free tier available. Handles chat, audio transcription, no TTS. |
| Sarvam | <https://dashboard.sarvam.ai> | Indian languages, best Indic TTS + STT. Needs a subscription key. |
| OpenAI | <https://platform.openai.com/api-keys> | Chat, Whisper STT, TTS. |
| OpenRouter | <https://openrouter.ai/keys> | One key, many models. Chat only. |
| Groq | <https://console.groq.com/keys> | Very fast chat + Whisper STT. |

`ADMIN_EMAILS` is a comma-separated allowlist. Only these accounts can open the provider editor in
Settings. Leave it empty and nobody can, including you.

`functions/.env` is gitignored. It must never be committed. The CI secret scanner will block you if
it is.

---

## 7. Deploy rules, indexes and functions

```bash
npm install -g firebase-tools
firebase login
firebase use --add          # pick your project, alias it "default"

cd functions && npm install && cd ..
npm run deploy:functions
```

That command builds TypeScript, then deploys functions, Firestore rules, indexes and Storage rules.

Verify:

```bash
curl https://asia-south1-your-project-id.cloudfunctions.net/health
```

You should see `{"status":"ok", ...}` and the list of providers that have credentials. If
`providers.configured` is `0`, your `functions/.env` was not picked up — redeploy.

---

## 8. Run it

```bash
npm run dev:web
```

Open <http://localhost:5173>, sign in, allow the microphone, record something, press
**Analyse my speaking**.

### Common first-run failures

| Symptom | Cause | Fix |
| --- | --- | --- |
| `auth/unauthorized-domain` | Netlify domain not allowlisted | Authentication → Settings → Authorized domains |
| `auth/operation-not-allowed` | Provider not enabled | Enable Google / Email in Sign-in method |
| `CORS` error on a callable | `ALLOWED_ORIGINS` missing your origin | Add it, redeploy functions |
| `permission-denied` reading sessions | Rules deployed but index missing | Deploy indexes; check the console link |
| `No AI provider is configured` | No key in `functions/.env` | Add one, redeploy |
| `Failed to fetch` from the browser | Functions not deployed to the region in `VITE_FUNCTIONS_REGION` | Match the two values |
| Microphone blocked | Site not https, or permission denied | Use https or localhost, allow mic in site settings |

---

## Local emulators (optional but recommended)

```bash
firebase emulators:start --only auth,firestore,storage,functions
```

Then run the frontend with `VITE_USE_EMULATORS=true`. The app connects to
`localhost:9099/8080/9199/5001` automatically. Emulator data is discarded when you stop it, so seed
a test account each session.

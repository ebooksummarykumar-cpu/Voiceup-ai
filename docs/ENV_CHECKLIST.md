# Environment variable checklist

Copy this into your own notes and tick it off. Nothing here is committed with real values.

---

## A. `web/.env` — and Netlify environment variables

Public. Inlined into the bundle at build time.

| Variable | Required | Where to get it |
| --- | --- | --- |
| `VITE_FIREBASE_API_KEY` | yes | Firebase → Project settings → Web app config |
| `VITE_FIREBASE_AUTH_DOMAIN` | yes | same |
| `VITE_FIREBASE_PROJECT_ID` | yes | same |
| `VITE_FIREBASE_STORAGE_BUCKET` | yes | same |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | yes | same |
| `VITE_FIREBASE_APP_ID` | yes | same |
| `VITE_FUNCTIONS_REGION` | yes | must equal `FUNCTIONS_REGION` |
| `VITE_USE_EMULATORS` | no | `true` only for local emulator work |
| `VITE_APP_ENV` | no | set by `netlify.toml` per context |

- [ ] All six Firebase values present
- [ ] Region matches the deployed functions
- [ ] `VITE_USE_EMULATORS` is **not** `true` in production

---

## B. `functions/.env` — server side only

Secret. Never commit. Never prefix with `VITE_`.

### At least one provider

| Variable | Required | Enables |
| --- | --- | --- |
| `GEMINI_API_KEY` | one of these | chat + transcription |
| `SARVAM_API_KEY` | | chat + Indic transcription + best Indic TTS |
| `OPENAI_API_KEY` | | chat + Whisper + TTS |
| `OPENROUTER_API_KEY` | | chat only |
| `GROQ_API_KEY` | | fast chat + Whisper |
| `CUSTOM_AI_ENDPOINT` + `CUSTOM_AI_API_KEY` + `CUSTOM_AI_MODEL` | | any OpenAI-compatible endpoint |

- [ ] At least one provider key set
- [ ] `DEFAULT_AI_PROVIDER` names a provider you actually configured
- [ ] If you need voice replies, that provider supports TTS (Sarvam or OpenAI)

### Runtime

| Variable | Required | Notes |
| --- | --- | --- |
| `FUNCTIONS_REGION` | yes | `asia-south1` recommended for India |
| `ALLOWED_ORIGINS` | strongly recommended | comma-separated; include localhost and your Netlify URL |
| `ADMIN_EMAILS` | for provider management | comma-separated; empty means nobody can edit providers |
| `DAILY_CHAT_LIMIT` | no | default 300; `0` = unlimited |
| `DAILY_TRANSCRIBE_LIMIT` | no | default 60 |
| `DAILY_TTS_LIMIT` | no | default 200 |

- [ ] `ALLOWED_ORIGINS` includes every origin that will call the API
- [ ] `ADMIN_EMAILS` contains your own email if you want the provider editor
- [ ] Daily limits set to something you can afford

### Model overrides (all optional)

`GEMINI_CHAT_MODEL`, `GEMINI_AUDIO_MODEL`, `OPENAI_CHAT_MODEL`, `OPENAI_STT_MODEL`,
`OPENAI_TTS_MODEL`, `OPENROUTER_CHAT_MODEL`, `GROQ_CHAT_MODEL`, `GROQ_STT_MODEL`,
`SARVAM_CHAT_MODEL`, `SARVAM_STT_MODEL`, `SARVAM_TTS_MODEL`, `SARVAM_TTS_SPEAKER`.

---

## C. Never in any file

- [ ] No `.env` file committed
- [ ] No Firebase service-account JSON in the repo
- [ ] No key pasted into a React component
- [ ] No key in a `NEXT_PUBLIC_` / `VITE_` variable

Verify mechanically:

```bash
npm run check:secrets
```

---

## D. Post-deploy sanity checks

- [ ] `curl https://<region>-<project>.cloudfunctions.net/health` returns `status: ok`
- [ ] `providers.configured` in that response is at least 1
- [ ] Netlify domain added to Firebase **Authorized domains**
- [ ] Sign-in works on the deployed URL
- [ ] Recording works (microphone permission prompt appears)
- [ ] One attempt transcribes and scores end to end

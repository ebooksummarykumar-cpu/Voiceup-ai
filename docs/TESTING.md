# Testing

## Run everything

```bash
npm test                  # functions + web
npm run verify            # secret scan, both builds, both test suites
```

## What is covered

### `functions/test` — 67 tests

| File | Covers |
| --- | --- |
| `formats.test.ts` | Auth headers per vendor (bearer vs `x-goog-api-key` vs `x-api-key`, Sarvam's dual header), request bodies for OpenAI / Gemini / Anthropic, system-prompt lifting, assistant→`model` role mapping, JSON mode per format, trailing-slash handling, response parsing including non-text blocks and empty completions, usage normalisation |
| `select.test.ts` | Precedence (requested → default → first usable), unknown provider error, empty-key skipping, capability filtering |
| `score.test.ts` | Score clamping, code-fence stripping, JSON extraction from prose, braces inside strings, escaped quotes, truncated JSON, malformed drill/filler filtering, the "no feedback cannot look perfect" cap |
| `validation.test.ts` | Storage-path ownership (prefix tricks, traversal, wrong folder), duration bounds, session type allowlist, message count/length/role rules, provider input validation (https, id charset, format) |
| `chunk.test.ts` | TTS splitting on sentence boundaries, hard-wrapping long words, the max-length invariant, Devanagari danda, whitespace collapsing |

### `web/src` — 9 tests

| File | Covers |
| --- | --- |
| `lib/format.test.ts` | Duration formatting, score banding and labels, averaging, initials |

## What is *not* covered

- Firestore and Storage security rules (see `KNOWN_LIMITATIONS.md`)
- Anything requiring a live provider key
- React component rendering (no DOM test environment configured)

## Adding a rules test

The quickest high-value addition:

```bash
npm i -D @firebase/rules-unit-testing
firebase emulators:exec --only firestore "npm --prefix functions run test:rules"
```

Then assert that a signed-in user cannot write `score` to a session, cannot read another user's
document, and cannot read `aiProviders` at all.

## Manual verification checklist

Run through this after any deployment:

1. Sign in with Google and with email/password.
2. Allow the microphone; the level meter moves when you speak.
3. Record 20 seconds, play it back, press **Analyse my speaking**.
4. A transcript appears and six scores render.
5. Press **Hear it** on the coach note — audio plays.
6. Open a lesson, complete an attempt, confirm the score references the lesson rubric.
7. Start a roleplay, send a text turn, then a voice turn; the persona replies in character.
8. Press **End and get a debrief** — a score and two lists appear.
9. Check **Progress** — both attempts are listed with transcripts.
10. As an admin, **Settings → Test** on a provider returns a latency and a sample.
11. As a non-admin, the provider editor is hidden.
12. Sign out; protected routes redirect to `/login`.

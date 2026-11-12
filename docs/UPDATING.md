# Instructions for future updates

How to change things without breaking them.

---

## The three deploy paths

| You changed | Command | What happens |
| --- | --- | --- |
| Anything under `web/` | `git push` | Netlify rebuilds and publishes automatically |
| Anything under `functions/src/` or `functions/.env` | `npm run deploy:functions` | Cloud Functions redeploy |
| `firestore.rules`, `storage.rules`, `firestore.indexes.json` | `npm run deploy:rules` | Rules and indexes update |
| `functions/src/content/catalogue.ts` (lessons, scenarios) | `npm run deploy:functions` | Curriculum updates, **no frontend rebuild needed** |

Pushing to GitHub does **not** deploy functions. That is deliberate — rules and backend changes
should be a conscious action, not a side effect of a push.

---

## Adding a lesson

Edit `functions/src/content/catalogue.ts`, add an object to `LESSONS`:

```ts
{
  id: 'unique-kebab-id',          // used in the URL: /lessons/unique-kebab-id
  title: 'Shown on the card',
  level: 'beginner' | 'intermediate' | 'advanced',
  category: 'Interviews',          // free text, used by the search filter
  minutes: 4,
  prompt: 'The exact instruction the learner sees and is scored against.',
  why: 'One sentence on why this matters.',
  tips: ['Three short, specific tips.'],
  rubric: ['structure', 'pacing']  // passed into the scoring prompt
}
```

Then `npm run deploy:functions`. The frontend fetches the catalogue through `getCatalogue`, so no
web rebuild is needed.

## Adding a roleplay scenario

Same file, `SCENARIOS` array. `personality` is what makes the roleplay feel real — describe how the
person reacts, not just who they are. `goal` is scored against in the debrief, so keep it
observable ("ask for 20% more and keep the offer alive", not "negotiate well").

The system prompt is built server-side from these fields, so the client cannot inject its own
persona.

---

## Adding a new AI provider

**No code needed** for anything OpenAI-compatible:

Settings → AI providers → **Add provider**, with base endpoint, key, model and capabilities.
It is stored in `aiProviders` and picked up immediately.

**Code needed** only for a genuinely new wire format:

1. Add the format to `ApiFormat` in `functions/src/ai/types.ts`.
2. Implement request building and response parsing in `functions/src/ai/formats.ts`.
3. Add a case to `authHeaders()` if the vendor uses a different auth header.
4. Add tests in `functions/test/formats.test.ts` — the existing ones are the template.

Transcription and synthesis are branched by provider id in `stt.ts` / `tts.ts`. If a new vendor
speaks a non-OpenAI speech API, add a branch there.

---

## Changing the scoring rubric

`functions/src/ai/prompts.ts` → `scoringPrompt()`. If you add a new dimension, also update:

- `DIMENSIONS` in `functions/src/lib/score.ts`
- the `ScoreBreakdown` interface in `functions/src/lib/score.ts`
- `ScoreBreakdown` in `web/src/types.ts`
- `DIMENSIONS` in `web/src/components/ScoreCard.tsx`

Miss one and the value silently renders as 0.

---

## Changing the data model

1. Update `firestore.rules` **first**, in the same commit.
2. Update `functions/src/lib/validation.ts` if the field comes from the client.
3. Update `web/src/types.ts`.
4. If you add a query, add the composite index to `firestore.indexes.json`.
5. Deploy rules before deploying functions, or functions will hit permission errors.

A client may never be given permission to write `transcript`, `score` or `feedback`. That invariant
is what makes scores trustworthy.

---

## Before every commit

```bash
npm run verify        # secret scan + both builds + both test suites
```

If you only remember one thing: **never** put a real key in `web/`, and never commit `.env`. The CI
secret scanner blocks both, but it is a net, not a guarantee.

---

## Rolling back

```bash
git revert <sha> && git push          # frontend rolls back on the next Netlify build
git log --oneline -5                  # find the commit to revert
npm run deploy:functions              # then redeploy the reverted backend
```

Netlify keeps every deploy: **Deploys → previous deploy → Publish deploy** reverts the frontend
instantly without touching git.

---

## Local development loop

```bash
firebase emulators:start --only auth,firestore,storage,functions   # terminal 1
VITE_USE_EMULATORS=true npm --prefix web run dev                   # terminal 2
```

Emulator data is discarded on stop, so you re-create a test account each session. Functions hot
reload only after `npm --prefix functions run build`.

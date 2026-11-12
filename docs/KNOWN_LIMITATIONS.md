# Known limitations

Written honestly, because a list of what does not work is more useful than a claim that everything
does.

---

## Requires your accounts to become fully live

The code is complete and builds clean, but these steps can only be done by the account owner:

| Thing | Why | Where |
| --- | --- | --- |
| A Firebase project | You own it; needs Blaze billing | `docs/FIREBASE_SETUP.md` |
| Provider API keys | Billing and terms are yours | `functions/.env` |
| A Netlify site | Requires your GitHub authorisation | `docs/NETLIFY_DEPLOY.md` |
| `firebase deploy` | Requires `firebase login` as you | `npm run deploy:functions` |

Until those exist, the app builds and shows a setup screen; it does not pretend to work.

---

## Not implemented

**1. Firestore rules tests against the emulator.**
`firestore.rules` is deny-by-default and carefully written, but it is not covered by automated
tests. Adding `@firebase/rules-unit-testing` and a `firebase emulators:exec` step in CI is the
obvious next task. Until then, treat the rules as reviewed-but-unverified.

**2. Audio stitching across TTS segments.**
Long replies come back as several audio files played in sequence. There is a small gap between
segments. Concatenating WAV headers correctly (or re-encoding) would remove it.

**3. Real-time streaming responses.**
Chat replies arrive whole. Token streaming would need a different transport than callables (SSE
through an HTTPS function, or Firestore listeners on a partial document).

**4. Word-level timing feedback.**
Scores are per attempt, not per sentence. Highlighting the exact phrase that trailed off would need
a provider that returns word timestamps; Sarvam and Whisper both can, but the plumbing is not built.

**5. Offline support.**
No service worker, no Firestore offline persistence. The app needs a connection.

**6. Server-side rate limiting per IP.**
Only per-user daily quota exists. Someone creating many accounts could still consume budget. App
Check attestation would be the right fix and is wired as an option (`enforceAppCheck: false`) but not
enforced.

**7. Admin role is an email allowlist, not a custom claim.**
`ADMIN_EMAILS` is checked against the ID token's email on every admin call. That is simple and safe,
but it means changing admins requires editing env vars and redeploying rather than setting a claim.

**8. Lesson progress tracking.**
Attempts are recorded, but there is no "lesson completed" state, no spaced-repetition scheduling,
and no streak calculation beyond the field existing on the profile.

**9. Tests cover pure logic only.**
76 tests cover request building, response parsing, provider selection, score normalisation, input
validation, storage-path ownership and TTS chunking. There are no integration tests that hit a real
provider, because that would need live keys and would be slow and non-deterministic. The
`testProvider` admin callable exists precisely so a human can verify connectivity in one click.

---

## Operational constraints to be aware of

- **Cloud Functions cold starts** on `asia-south1` add roughly 1–3 seconds to the first call after
  idle. Setting a minimum instance count removes it at a cost.
- **Callable payload limit is ~10 MB.** TTS audio is returned as base64 in the response; a very long
  reply could approach this. Replies are capped at 260 tokens, so in practice it is not close.
- **Storage rules cap uploads at 12 MB** and the recorder auto-stops at three minutes. A 10-minute
  limit is enforced again server-side in `requireDuration`.
- **Sarvam's free tier** has tight concurrency limits; a burst of users will see 429s, which surface
  as a readable "rate-limited" message rather than a crash.
- **Firestore composite indexes** take a minute or two to build after the first deploy. Queries fail
  with a console link until they finish.

---

## Cosmetic

- Voice names in Settings are a fixed list of Sarvam speakers; OpenAI voice names (`alloy`, `nova`…)
  can be typed into the provider form but are not offered in the dropdown.
- The score sparkline shows the last 12 attempts only.
- No dark/light theme toggle — the app is dark by design.

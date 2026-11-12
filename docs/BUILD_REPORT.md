# Build and test report

Generated during the build of this repository. Every line below was produced by running the command
shown, in this repository, on Node 20.

---

## Environment

| Item | Value |
| --- | --- |
| OS | Debian 12 (bookworm), x86_64 |
| Node | 20.20.2 |
| npm | 10.8.2 |
| TypeScript | 5.5.x |
| Vite | 5.4.21 |
| firebase-functions | 5.x |
| firebase-admin | 12.x |

---

## 1. Backend typecheck

```
$ cd functions && npx tsc --noEmit
(no output)
exit 0
```

`strict: true`, `noImplicitReturns`, `noFallthroughCasesInSwitch` all enabled.

---

## 2. Backend tests

```
$ cd functions && vitest run

 ✓ test/formats.test.ts     (18 tests)
 ✓ test/validation.test.ts  (21 tests)
 ✓ test/score.test.ts       (14 tests)
 ✓ test/select.test.ts       (7 tests)
 ✓ test/chunk.test.ts        (7 tests)

 Test Files  5 passed (5)
      Tests  67 passed (67)
```

---

## 3. Frontend typecheck

```
$ cd web && tsc --noEmit
(no output)
exit 0
```

---

## 4. Frontend tests

```
$ cd web && vitest run

 ✓ src/lib/format.test.ts (9 tests)

 Test Files  1 passed (1)
      Tests  9 passed (9)
```

---

## 5. Production frontend build

```
$ cd web && vite build

vite v5.4.21 building for production...
✓ 78 modules transformed.
dist/index.html                     1.19 kB │ gzip:   0.60 kB
dist/assets/index-*.css            24.73 kB │ gzip:   5.63 kB
dist/assets/index-*.js            217.59 kB │ gzip:  69.25 kB
dist/assets/firebase-*.js         494.44 kB │ gzip: 115.68 kB
✓ built in 9.52s
```

Firebase is split into its own chunk so the app shell is cached independently of the SDK.

---

## 6. Secret scan

```
$ node scripts/check-secrets.mjs
Secret scan clean: <n> tracked files inspected, 0 findings.
```

Scans every tracked file for Google/OpenAI/Groq/OpenRouter/Sarvam/AWS/GitHub/Slack key shapes,
private key blocks, Firebase service-account JSON and JWTs. Also blocks `.env` and `*.pem` from being
tracked at all.

---

## Summary

| Check | Result |
| --- | --- |
| Backend typecheck | pass |
| Backend tests | 67 / 67 pass |
| Frontend typecheck | pass |
| Frontend tests | 9 / 9 pass |
| Frontend production build | pass |
| Secret scan | clean |

---

## Not verified here, and why

These need live credentials or a browser, so they could not be executed in the build environment:

| Check | Reason | How to verify |
| --- | --- | --- |
| Firebase Auth sign-in | needs a real project | `docs/FIREBASE_SETUP.md` step 8 |
| Firestore rules behaviour | needs the emulator or a project | `docs/TESTING.md` |
| Storage upload/download | needs a real bucket | manual checklist |
| A live AI provider call | needs a provider key | `Settings → Test`, or `curl .../health` |
| Microphone capture | needs a browser and a user gesture | manual checklist |
| Netlify deploy | needs the site linked to the repo | `docs/NETLIFY_DEPLOY.md` |
| `firebase deploy` | needs `firebase login` as the owner | `npm run deploy:functions` |

Nothing in this report claims those passed.

# Netlify deployment

Netlify serves the static frontend. The backend stays on Firebase. `netlify.toml` is committed and
already correct — you mostly need to connect the repo and add environment variables.

---

## 1. Connect the repository

1. <https://app.netlify.com> → **Add new site → Import an existing project → GitHub**.
2. Authorise Netlify for the repository `voiceup-ai`.
3. Netlify reads `netlify.toml`, so the build settings are filled in automatically:

   | Setting | Value |
   | --- | --- |
   | Base directory | `web` |
   | Build command | `npm ci && npm run build` |
   | Publish directory | `web/dist` |

4. Do **not** override them by hand unless you know why.

---

## 2. Environment variables

**Site configuration → Environment variables → Add a variable**, scope **All** (or at minimum
Builds + Functions):

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FUNCTIONS_REGION        # e.g. asia-south1
```

Vite inlines `VITE_*` variables at **build** time. Changing one requires a redeploy — restarting is
not enough.

There are no server-side secrets on Netlify. If you find yourself wanting to add one, it belongs in
`functions/.env` instead.

---

## 3. Routing

`netlify.toml` includes:

```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

Without it, refreshing `/lessons/star-answer` returns a 404, because that path only exists in the
React router.

---

## 4. Headers

The same file sets `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, a strict
`Referrer-Policy`, and `Permissions-Policy: microphone=(self)` — the microphone has to be allowed
explicitly or recording silently fails in an iframe context. Hashed assets under `/assets/*` get a
one-year immutable cache.

---

## 5. Automatic deploys and previews

Once the site is linked:

- **Push to `main`** → production deploy.
- **Open a pull request** → deploy preview at a unique URL.

Previews are useful for testing a UI change against staging data. `netlify.toml` sets
`VITE_APP_ENV=preview` in that context. If you want previews to use a *different* Firebase project,
create a second site or override the `VITE_FIREBASE_*` variables per deploy context.

---

## 6. After the first deploy

1. Copy the site URL, e.g. `https://voiceup-ai.netlify.app`.
2. Add it to **Firebase → Authentication → Settings → Authorized domains**.
3. Add it to `ALLOWED_ORIGINS` in `functions/.env` and redeploy functions, or callables will fail
   CORS in the browser.
4. Visit the site and sign in. If the login page does not appear, a `VITE_FIREBASE_*` variable is
   missing — the app shows its setup screen instead of a blank page.

---

## 7. Verifying a production build before you deploy

```bash
npm --prefix web run build
npm --prefix web run preview     # serves dist/ on :4173
```

`preview` serves the exact bundle Netlify will publish, including the SPA fallback behaviour.

---

## 8. Rollbacks

Netlify keeps every deploy. **Deploys → select a previous deploy → Publish deploy** rolls back the
frontend instantly. Note that functions and rules roll back separately — `firebase deploy` history
is in the Firebase console, not in Netlify.

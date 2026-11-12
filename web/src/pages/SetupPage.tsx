/**
 * Shown when the build has no Firebase config. Better an honest checklist than
 * a white screen and a console error.
 */
export function SetupPage() {
  return (
    <div className="setup-page">
      <div className="setup-card">
        <div className="brand-mark brand-mark-lg">V</div>
        <h1>VOICEUP AI needs a Firebase project</h1>
        <p className="muted">
          This build has no Firebase configuration, so sign-in and the AI coach cannot work yet.
        </p>

        <ol className="setup-steps">
          <li>
            Create a Firebase project, then add a <strong>Web app</strong> in Project settings.
          </li>
          <li>
            Copy the six config values into <code>web/.env</code> (locally) or into
            <strong> Netlify → Site settings → Environment variables</strong>.
          </li>
          <li>
            Use the keys listed in <code>web/.env.example</code> — every one starts with
            <code> VITE_</code>.
          </li>
          <li>
            Rebuild. Locally that is <code>npm --prefix web run dev</code>.
          </li>
        </ol>

        <p className="muted small">
          Full instructions, including security rules and function deployment, are in
          <code> docs/FIREBASE_SETUP.md</code>.
        </p>
      </div>
    </div>
  );
}

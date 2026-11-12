import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Spinner } from '../components/Spinner';

export function AuthPage() {
  const { user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!loading && user) return <Navigate to="/" replace />;

  const friendly = (err: unknown): string => {
    const code = (err as { code?: string })?.code ?? '';
    if (code.includes('invalid-credential') || code.includes('wrong-password')) {
      return 'That email and password do not match.';
    }
    if (code.includes('user-not-found')) return 'No account with that email. Create one below.';
    if (code.includes('email-already-in-use')) return 'That email is already registered. Sign in instead.';
    if (code.includes('weak-password')) return 'Use a password with at least 6 characters.';
    if (code.includes('popup-closed-by-user') || code.includes('cancelled-popup-request')) {
      return 'Google sign-in was cancelled.';
    }
    if (code.includes('popup-blocked')) return 'Your browser blocked the popup. Allow popups and retry.';
    if (code.includes('operation-not-allowed')) {
      return 'That sign-in method is disabled in your Firebase project. Enable it in Authentication → Sign-in method.';
    }
    return (err as Error)?.message?.replace(/^Firebase: /, '') ?? 'Sign-in failed.';
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signup') await signUpWithEmail(email, password, name);
      else await signInWithEmail(email, password);
    } catch (err) {
      setError(friendly(err));
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(friendly(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-hero">
        <div className="brand-row">
          <div className="brand-mark">V</div>
          <span className="brand-name">VOICEUP AI</span>
        </div>
        <h1>
          Speak better.
          <br />
          Get hired, heard, understood.
        </h1>
        <p>
          Record yourself, get an honest score on clarity, pace and confidence, then practise the
          exact conversation you are dreading — with an AI that plays the other person.
        </p>
        <ul className="hero-points">
          <li>Speaking lessons with a rubric, not vague tips</li>
          <li>Roleplay interviews, client calls and negotiations</li>
          <li>Every score traces back to what you actually said</li>
        </ul>
      </div>

      <div className="auth-panel">
        <div className="auth-tabs">
          <button
            className={mode === 'signin' ? 'is-active' : ''}
            onClick={() => setMode('signin')}
            type="button"
          >
            Sign in
          </button>
          <button
            className={mode === 'signup' ? 'is-active' : ''}
            onClick={() => setMode('signup')}
            type="button"
          >
            Create account
          </button>
        </div>

        <button className="btn btn-google" onClick={google} disabled={busy} type="button">
          Continue with Google
        </button>

        <div className="divider">
          <span>or use email</span>
        </div>

        <form onSubmit={submit} className="auth-form">
          {mode === 'signup' ? (
            <label>
              Your name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Asha Rao"
                autoComplete="name"
              />
            </label>
          ) : null}

          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              required
              minLength={6}
            />
          </label>

          {error ? <p className="field-error">{error}</p> : null}

          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? <Spinner label="Working" /> : mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <p className="muted small">
          Your recordings stay in your own Firebase Storage folder and are never public.
        </p>
      </div>
    </div>
  );
}

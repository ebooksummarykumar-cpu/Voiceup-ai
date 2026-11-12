import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, describeError } from '../lib/api';
import { LANGUAGES } from '../lib/format';
import { Spinner } from '../components/Spinner';
import type { ProviderListResponse } from '../types';

const VOICES = ['anushka', 'abhilash', 'manisha', 'vidya', 'arya', 'karun', 'hitesh'];

interface ProviderForm {
  id: string;
  name: string;
  format: 'openai' | 'gemini' | 'anthropic';
  endpoint: string;
  apiKey: string;
  model: string;
  sttModel: string;
  ttsModel: string;
  voice: string;
  supportsChat: boolean;
  supportsStt: boolean;
  supportsTts: boolean;
  makeDefault: boolean;
}

const EMPTY_FORM: ProviderForm = {
  id: '',
  name: '',
  format: 'openai',
  endpoint: '',
  apiKey: '',
  model: '',
  sttModel: '',
  ttsModel: '',
  voice: '',
  supportsChat: true,
  supportsStt: false,
  supportsTts: false,
  makeDefault: false
};

export function SettingsPage() {
  const { profile, user, updateProfile, signOut } = useAuth();

  const [name, setName] = useState(profile?.displayName ?? '');
  const [language, setLanguage] = useState(profile?.targetLanguage ?? 'en-IN');
  const [voice, setVoice] = useState(profile?.voice ?? 'anushka');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

  const [providers, setProviders] = useState<ProviderListResponse | null>(null);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [form, setForm] = useState<ProviderForm | null>(null);
  const [savingProvider, setSavingProvider] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    setName(profile?.displayName ?? '');
    setLanguage(profile?.targetLanguage ?? 'en-IN');
    setVoice(profile?.voice ?? 'anushka');
  }, [profile?.displayName, profile?.targetLanguage, profile?.voice]);

  const loadProviders = () => {
    setLoadingProviders(true);
    api
      .providers()
      .then((data) => {
        setProviders(data);
        setProviderError(null);
      })
      .catch((err) => setProviderError(describeError(err)))
      .finally(() => setLoadingProviders(false));
  };

  useEffect(loadProviders, []);

  const saveProfile = async () => {
    setSavingProfile(true);
    setProfileMessage(null);
    try {
      await updateProfile({ displayName: name.trim() || 'Speaker', targetLanguage: language, voice });
      setProfileMessage('Saved.');
    } catch (err) {
      setProfileMessage(describeError(err));
    } finally {
      setSavingProfile(false);
    }
  };

  const saveProvider = async () => {
    if (!form) return;
    setSavingProvider(true);
    setProviderError(null);
    try {
      await api.saveProvider({
        id: form.id.trim().toLowerCase(),
        name: form.name.trim(),
        format: form.format,
        endpoint: form.endpoint.trim(),
        apiKey: form.apiKey,
        model: form.model.trim(),
        sttModel: form.sttModel.trim() || undefined,
        ttsModel: form.ttsModel.trim() || undefined,
        voice: form.voice.trim() || undefined,
        supportsChat: form.supportsChat,
        supportsStt: form.supportsStt,
        supportsTts: form.supportsTts,
        makeDefault: form.makeDefault
      });
      setForm(null);
      loadProviders();
    } catch (err) {
      setProviderError(describeError(err));
    } finally {
      setSavingProvider(false);
    }
  };

  const testProvider = async (id: string) => {
    setTestResult(`Testing ${id}…`);
    try {
      const result = await api.testProvider(id);
      setTestResult(`✓ ${id} responded in ${result.latencyMs} ms using ${result.model}: “${result.sample}”`);
    } catch (err) {
      setTestResult(`✗ ${describeError(err)}`);
    }
  };

  const removeProvider = async (id: string) => {
    if (!window.confirm(`Remove provider "${id}"? Any key stored for it is deleted.`)) return;
    try {
      await api.deleteProvider(id);
      loadProviders();
    } catch (err) {
      setProviderError(describeError(err));
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>Your setup</h1>
          <p className="muted">{user?.email}</p>
        </div>
      </header>

      <section className="section">
        <h2>Profile</h2>
        <div className="form-grid">
          <label>
            Display name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </label>

          <label>
            Practice language
            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Coach voice
            <select value={voice} onChange={(e) => setVoice(e.target.value)}>
              {VOICES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="form-actions">
          <button className="btn btn-primary" onClick={saveProfile} disabled={savingProfile} type="button">
            {savingProfile ? <Spinner label="Saving" /> : 'Save profile'}
          </button>
          {profileMessage ? <span className="muted small">{profileMessage}</span> : null}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>AI providers</h2>
          {providers?.isAdmin ? (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setForm(form ? null : { ...EMPTY_FORM })}
              type="button"
            >
              {form ? 'Cancel' : 'Add provider'}
            </button>
          ) : null}
        </div>

        <p className="muted small">
          Keys are stored server-side only. The browser never receives one — this list shows
          metadata and whether a key is present.
        </p>

        {loadingProviders ? <Spinner label="Loading providers" /> : null}
        {providerError ? <div className="banner banner-error">{providerError}</div> : null}

        {providers && !providers.isAdmin ? (
          <div className="banner banner-info">
            Only an administrator can change providers. Add your email to <code>ADMIN_EMAILS</code> in
            <code> functions/.env</code> to unlock this.
          </div>
        ) : null}

        <ul className="provider-list">
          {providers?.providers.map((provider) => (
            <li className="provider-row" key={provider.id}>
              <div>
                <div className="provider-title">
                  <strong>{provider.name}</strong>
                  {provider.id === providers.defaultProvider ? (
                    <span className="chip chip-soft">default</span>
                  ) : null}
                  <span className={`chip ${provider.configured ? 'chip-ok' : 'chip-warn'}`}>
                    {provider.configured ? 'configured' : 'no key'}
                  </span>
                  <span className="chip chip-soft">{provider.source}</span>
                </div>
                <p className="muted small">
                  {provider.format} · {provider.model || 'no model set'} ·{' '}
                  {[
                    provider.capabilities.chat ? 'chat' : null,
                    provider.capabilities.stt ? 'transcribe' : null,
                    provider.capabilities.tts ? 'speak' : null
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              </div>

              {providers.isAdmin ? (
                <div className="provider-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => testProvider(provider.id)} type="button">
                    Test
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setForm({
                        id: provider.id,
                        name: provider.name,
                        format: provider.format,
                        endpoint: '',
                        apiKey: '',
                        model: provider.model,
                        sttModel: '',
                        ttsModel: '',
                        voice: '',
                        supportsChat: provider.capabilities.chat,
                        supportsStt: provider.capabilities.stt,
                        supportsTts: provider.capabilities.tts,
                        makeDefault: provider.id === providers.defaultProvider
                      });
                    }}
                    type="button"
                  >
                    Edit
                  </button>
                  {provider.source === 'firestore' ? (
                    <button
                      className="btn btn-ghost btn-sm btn-danger"
                      onClick={() => removeProvider(provider.id)}
                      type="button"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>

        {testResult ? <p className="muted small">{testResult}</p> : null}

        {form ? (
          <div className="provider-form">
            <h3>{form.id ? `Edit ${form.id}` : 'New provider'}</h3>

            <div className="form-grid">
              <label>
                Provider id
                <input
                  value={form.id}
                  onChange={(e) => setForm({ ...form, id: e.target.value })}
                  placeholder="my-provider"
                  disabled={Boolean(form.id) && providers?.providers.some((p) => p.id === form.id)}
                />
              </label>

              <label>
                Display name
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="My Provider"
                />
              </label>

              <label>
                API format
                <select
                  value={form.format}
                  onChange={(e) => setForm({ ...form, format: e.target.value as ProviderForm['format'] })}
                >
                  <option value="openai">OpenAI-compatible</option>
                  <option value="gemini">Google Gemini</option>
                  <option value="anthropic">Anthropic</option>
                </select>
              </label>

              <label>
                Base endpoint
                <input
                  value={form.endpoint}
                  onChange={(e) => setForm({ ...form, endpoint: e.target.value })}
                  placeholder="https://api.example.com/v1"
                />
              </label>

              <label>
                API key {form.apiKey ? '' : '(leave blank to keep the current key)'}
                <input
                  type="password"
                  value={form.apiKey}
                  onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                  placeholder="stored server-side only"
                  autoComplete="off"
                />
              </label>

              <label>
                Chat model
                <input
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  placeholder="gpt-4o-mini"
                />
              </label>

              <label>
                Transcription model (optional)
                <input
                  value={form.sttModel}
                  onChange={(e) => setForm({ ...form, sttModel: e.target.value })}
                  placeholder="whisper-1"
                />
              </label>

              <label>
                Speech model (optional)
                <input
                  value={form.ttsModel}
                  onChange={(e) => setForm({ ...form, ttsModel: e.target.value })}
                  placeholder="gpt-4o-mini-tts"
                />
              </label>

              <label>
                Voice (optional)
                <input
                  value={form.voice}
                  onChange={(e) => setForm({ ...form, voice: e.target.value })}
                  placeholder="alloy"
                />
              </label>
            </div>

            <div className="checkbox-row">
              <label>
                <input
                  type="checkbox"
                  checked={form.supportsChat}
                  onChange={(e) => setForm({ ...form, supportsChat: e.target.checked })}
                />
                Chat
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={form.supportsStt}
                  onChange={(e) => setForm({ ...form, supportsStt: e.target.checked })}
                />
                Transcription
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={form.supportsTts}
                  onChange={(e) => setForm({ ...form, supportsTts: e.target.checked })}
                />
                Speech
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={form.makeDefault}
                  onChange={(e) => setForm({ ...form, makeDefault: e.target.checked })}
                />
                Make default
              </label>
            </div>

            <div className="form-actions">
              <button className="btn btn-primary" onClick={saveProvider} disabled={savingProvider} type="button">
                {savingProvider ? <Spinner label="Saving" /> : 'Save provider'}
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="section">
        <h2>Account</h2>
        <button className="btn btn-ghost btn-danger" onClick={() => void signOut()} type="button">
          Sign out
        </button>
      </section>
    </div>
  );
}

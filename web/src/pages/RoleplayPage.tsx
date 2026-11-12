import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCatalogue } from '../hooks/useCatalogue';
import { useAuth } from '../context/AuthContext';
import { api, describeError } from '../lib/api';
import { Spinner } from '../components/Spinner';

export function RoleplayPage() {
  const { catalogue, loading, error } = useCatalogue();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [starting, setStarting] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

  const start = async (scenarioId: string) => {
    setStarting(scenarioId);
    setStartError(null);
    try {
      const result = await api.startRoleplay({
        scenarioId,
        language: profile?.targetLanguage ?? 'en-IN'
      });
      navigate(`/roleplay/${result.threadId}`);
    } catch (err) {
      setStartError(describeError(err));
      setStarting(null);
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Roleplay</p>
          <h1>Practise the conversation you are dreading</h1>
          <p className="muted">
            The AI plays the other person — a hiring manager, an angry client, a recruiter. Speak or
            type; you can hear every reply.
          </p>
        </div>
      </header>

      {error ? <div className="banner banner-error">{error}</div> : null}
      {startError ? <div className="banner banner-error">{startError}</div> : null}
      {loading ? <Spinner label="Loading scenarios" /> : null}

      <div className="scenario-grid">
        {catalogue?.scenarios.map((scenario) => (
          <article className="scenario-card" key={scenario.id}>
            <div className="scenario-top">
              <span className="scenario-emoji" aria-hidden="true">
                {scenario.emoji}
              </span>
              <span className={`level-badge level-${scenario.difficulty}`}>{scenario.difficulty}</span>
            </div>
            <h3>{scenario.title}</h3>
            <p className="muted">{scenario.setting}</p>
            <p className="scenario-goal">
              <strong>Your goal:</strong> {scenario.goal}
            </p>
            <div className="scenario-persona">
              <span className="avatar avatar-sm">{scenario.personaName[0]}</span>
              <span>
                <strong>{scenario.personaName}</strong>
                <small className="muted">{scenario.personaRole}</small>
              </span>
            </div>
            <button
              className="btn btn-primary btn-block"
              onClick={() => start(scenario.id)}
              disabled={starting !== null}
              type="button"
            >
              {starting === scenario.id ? <Spinner label="Starting" /> : 'Start roleplay'}
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}

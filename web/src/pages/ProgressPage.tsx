import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { listSessions } from '../lib/sessions';
import { average, formatDuration, formatRelativeTime } from '../lib/format';
import type { PracticeSession } from '../types';
import { ScoreRing } from '../components/ScoreRing';
import { Spinner } from '../components/Spinner';

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const width = 320;
  const height = 72;
  const step = width / (values.length - 1);
  const points = values.map((v, i) => `${i * step},${height - (v / 100) * height}`).join(' ');

  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Score trend">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      {values.map((v, i) => (
        <circle key={i} cx={i * step} cy={height - (v / 100) * height} r="3" fill="currentColor" />
      ))}
    </svg>
  );
}

export function ProgressPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    listSessions(user.uid, 100)
      .then((data) => {
        if (!cancelled) setSessions(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load history.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const scored = useMemo(() => sessions.filter((s) => s.score), [sessions]);
  const avg = average(scored.map((s) => s.score!.overall));
  const trend = useMemo(
    () => scored.slice(0, 12).map((s) => s.score!.overall).reverse(),
    [scored]
  );
  const best = scored.reduce((max, s) => Math.max(max, s.score!.overall), 0);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Progress</p>
          <h1>Your speaking history</h1>
          <p className="muted">Every attempt, with the transcript the score was based on.</p>
        </div>
      </header>

      {error ? <div className="banner banner-error">{error}</div> : null}
      {loading ? <Spinner label="Loading history" /> : null}

      {!loading && sessions.length === 0 ? (
        <div className="empty-state">
          <p>No attempts yet. Your history builds itself as you practise.</p>
          <Link className="btn btn-primary" to="/practice">
            Record something
          </Link>
        </div>
      ) : null}

      {scored.length > 0 ? (
        <section className="progress-summary">
          <div className="summary-left">
            <ScoreRing value={avg} size={110} />
            <div>
              <span className="stat-label">Average</span>
              <p className="muted small">Best: {best}</p>
              <p className="muted small">{scored.length} scored attempts</p>
            </div>
          </div>
          <div className="summary-right">
            <span className="stat-label">Last {trend.length} attempts</span>
            <Sparkline values={trend} />
          </div>
        </section>
      ) : null}

      <ul className="session-list">
        {sessions.map((session) => {
          const isOpen = expanded === session.id;
          return (
            <li key={session.id} className={`session-row session-row-expandable ${isOpen ? 'is-open' : ''}`}>
              <button
                className="session-toggle"
                onClick={() => setExpanded(isOpen ? null : session.id)}
                type="button"
                aria-expanded={isOpen}
              >
                <div className="session-main">
                  <span className={`type-badge type-${session.type}`}>{session.type}</span>
                  <strong>{session.title ?? 'Practice attempt'}</strong>
                  <span className="muted small">
                    {formatRelativeTime(session.createdAt)} · {formatDuration(session.durationMs ?? 0)}
                  </span>
                </div>
                {session.score ? (
                  <span
                    className={`score-pill tone-${
                      session.score.overall >= 80 ? 'high' : session.score.overall >= 60 ? 'mid' : 'low'
                    }`}
                  >
                    {session.score.overall}
                  </span>
                ) : (
                  <span className="muted small">unscored</span>
                )}
              </button>

              {isOpen ? (
                <div className="session-detail">
                  {session.score ? (
                    <>
                      <p className="coach-note">{session.score.coachNote}</p>
                      <div className="mini-scores">
                        {(
                          [
                            ['Fluency', session.score.fluency],
                            ['Clarity', session.score.clarity],
                            ['Grammar', session.score.grammar],
                            ['Confidence', session.score.confidence],
                            ['Vocabulary', session.score.vocabulary]
                          ] as const
                        ).map(([label, value]) => (
                          <span className="mini-score" key={label}>
                            <small>{label}</small>
                            <strong>{value}</strong>
                          </span>
                        ))}
                      </div>
                      {session.score.improvements.length > 0 ? (
                        <ul className="cross-list">
                          {session.score.improvements.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      ) : null}
                    </>
                  ) : (
                    <p className="muted">This attempt was never scored.</p>
                  )}

                  {session.transcript ? (
                    <details className="transcript">
                      <summary>Transcript</summary>
                      <p>{session.transcript}</p>
                    </details>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

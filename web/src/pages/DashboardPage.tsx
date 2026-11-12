import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCatalogue } from '../hooks/useCatalogue';
import { listSessions } from '../lib/sessions';
import { average, formatDuration, formatRelativeTime } from '../lib/format';
import type { PracticeSession } from '../types';
import { ScoreRing } from '../components/ScoreRing';
import { Spinner } from '../components/Spinner';

export function DashboardPage() {
  const { user, profile } = useAuth();
  const { catalogue, loading: catalogueLoading } = useCatalogue();
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    listSessions(user.uid, 20)
      .then((data) => {
        if (!cancelled) setSessions(data);
      })
      .catch(() => {
        if (!cancelled) setSessions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const scored = sessions.filter((s) => s.score);
  const avg = average(scored.map((s) => s.score!.overall));
  const todayDrill = catalogue?.lessons[(new Date().getDate() + sessions.length) % (catalogue.lessons.length || 1)];
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">{greeting}</p>
          <h1>{profile?.displayName ?? 'Speaker'}</h1>
          <p className="muted">
            {scored.length === 0
              ? 'Your first recording is the hardest. It gets easier from there.'
              : `${scored.length} attempt${scored.length === 1 ? '' : 's'} scored so far.`}
          </p>
        </div>
        <Link className="btn btn-primary" to="/practice">
          Start speaking
        </Link>
      </header>

      <section className="stat-row">
        <div className="stat-card">
          <span className="stat-label">Average score</span>
          {scored.length > 0 ? (
            <ScoreRing value={avg} size={96} />
          ) : (
            <span className="stat-empty">—</span>
          )}
        </div>
        <div className="stat-card">
          <span className="stat-label">Attempts</span>
          <strong className="stat-value">{sessions.length}</strong>
          <span className="muted small">recordings analysed</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Speaking time</span>
          <strong className="stat-value">
            {formatDuration(sessions.reduce((sum, s) => sum + (s.durationMs ?? 0), 0))}
          </strong>
          <span className="muted small">across all attempts</span>
        </div>
      </section>

      {todayDrill ? (
        <section className="drill-card">
          <div>
            <span className="eyebrow">Today's drill</span>
            <h2>{todayDrill.title}</h2>
            <p className="muted">{todayDrill.prompt}</p>
            <div className="chips">
              <span className="chip">{todayDrill.category}</span>
              <span className="chip">{todayDrill.level}</span>
              <span className="chip">{todayDrill.minutes} min</span>
            </div>
          </div>
          <Link className="btn btn-secondary" to={`/lessons/${todayDrill.id}`}>
            Take the drill
          </Link>
        </section>
      ) : catalogueLoading ? (
        <section className="drill-card">
          <Spinner label="Loading today's drill" />
        </section>
      ) : null}

      <section className="section">
        <div className="section-head">
          <h2>Recent attempts</h2>
          <Link className="link-more" to="/progress">
            See all
          </Link>
        </div>

        {loading ? (
          <Spinner label="Loading your history" />
        ) : sessions.length === 0 ? (
          <div className="empty-state">
            <p>Nothing recorded yet.</p>
            <Link className="btn btn-primary" to="/practice">
              Record your first attempt
            </Link>
          </div>
        ) : (
          <ul className="session-list">
            {sessions.slice(0, 4).map((session) => (
              <li key={session.id} className="session-row">
                <div className="session-main">
                  <span className={`type-badge type-${session.type}`}>{session.type}</span>
                  <strong>{session.title ?? 'Practice attempt'}</strong>
                  <span className="muted small">
                    {formatRelativeTime(session.createdAt)} · {formatDuration(session.durationMs ?? 0)}
                  </span>
                </div>
                {session.score ? (
                  <span className={`score-pill tone-${session.score.overall >= 80 ? 'high' : session.score.overall >= 60 ? 'mid' : 'low'}`}>
                    {session.score.overall}
                  </span>
                ) : (
                  <span className="muted small">not scored</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

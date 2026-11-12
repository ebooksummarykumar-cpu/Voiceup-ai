import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCatalogue } from '../hooks/useCatalogue';
import { Spinner } from '../components/Spinner';
import type { Level } from '../types';

const LEVELS: (Level | 'all')[] = ['all', 'beginner', 'intermediate', 'advanced'];

export function LessonsPage() {
  const { catalogue, loading, error } = useCatalogue();
  const [level, setLevel] = useState<Level | 'all'>('all');
  const [search, setSearch] = useState('');

  const lessons = useMemo(() => {
    if (!catalogue) return [];
    const term = search.trim().toLowerCase();
    return catalogue.lessons.filter((lesson) => {
      const levelOk = level === 'all' || lesson.level === level;
      const searchOk =
        !term ||
        lesson.title.toLowerCase().includes(term) ||
        lesson.category.toLowerCase().includes(term) ||
        lesson.prompt.toLowerCase().includes(term);
      return levelOk && searchOk;
    });
  }, [catalogue, level, search]);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Lessons</p>
          <h1>Targeted speaking drills</h1>
          <p className="muted">Each one has a prompt, a reason, and a rubric the scorer uses.</p>
        </div>
      </header>

      <div className="filter-row">
        <div className="segmented">
          {LEVELS.map((option) => (
            <button
              key={option}
              className={level === option ? 'is-active' : ''}
              onClick={() => setLevel(option)}
              type="button"
            >
              {option}
            </button>
          ))}
        </div>
        <input
          className="search-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search drills…"
          aria-label="Search lessons"
        />
      </div>

      {error ? <div className="banner banner-error">{error}</div> : null}
      {loading ? <Spinner label="Loading lessons" /> : null}

      <div className="lesson-grid">
        {lessons.map((lesson) => (
          <Link className="lesson-card" key={lesson.id} to={`/lessons/${lesson.id}`}>
            <div className="lesson-card-top">
              <span className={`level-badge level-${lesson.level}`}>{lesson.level}</span>
              <span className="muted small">{lesson.minutes} min</span>
            </div>
            <h3>{lesson.title}</h3>
            <p>{lesson.why}</p>
            <div className="chips">
              <span className="chip">{lesson.category}</span>
              {lesson.rubric.slice(0, 2).map((r) => (
                <span className="chip chip-soft" key={r}>
                  {r}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>

      {!loading && lessons.length === 0 ? (
        <div className="empty-state">
          <p>No drills match that filter.</p>
        </div>
      ) : null}
    </div>
  );
}

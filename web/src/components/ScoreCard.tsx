import { useState } from 'react';
import type { ScoreBreakdown } from '../types';
import { api, describeError } from '../lib/api';
import { tryPlaySegments } from '../lib/audio';
import { ScoreRing } from './ScoreRing';

const DIMENSIONS: { key: keyof ScoreBreakdown; label: string }[] = [
  { key: 'fluency', label: 'Fluency' },
  { key: 'clarity', label: 'Clarity' },
  { key: 'grammar', label: 'Grammar' },
  { key: 'confidence', label: 'Confidence' },
  { key: 'vocabulary', label: 'Vocabulary' }
];

export function ScoreCard({
  score,
  transcript,
  language = 'en-IN'
}: {
  score: ScoreBreakdown;
  transcript?: string;
  language?: string;
}) {
  const [speaking, setSpeaking] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  const listen = async () => {
    if (!score.coachNote) return;
    setSpeaking(true);
    setAudioError(null);
    try {
      const result = await api.speak({ text: score.coachNote, language });
      await tryPlaySegments(result.segments);
    } catch (err) {
      setAudioError(describeError(err));
    } finally {
      setSpeaking(false);
    }
  };

  return (
    <section className="score-card">
      <div className="score-head">
        <ScoreRing value={score.overall} />
        <div className="score-head-copy">
          <h2>Your coach's read</h2>
          <p className="coach-note">{score.coachNote}</p>
          <div className="score-meta">
            <span className={`pace pace-${score.pace.verdict.replace(' ', '-')}`}>
              {score.pace.wordsPerMinute} wpm · {score.pace.verdict}
            </span>
            {score.coachNote ? (
              <button className="btn btn-ghost btn-sm" onClick={listen} disabled={speaking}>
                {speaking ? 'Speaking…' : '🔊 Hear it'}
              </button>
            ) : null}
          </div>
          {audioError ? <p className="field-error">{audioError}</p> : null}
        </div>
      </div>

      <div className="score-bars">
        {DIMENSIONS.map((dim) => {
          const value = Number(score[dim.key] ?? 0);
          return (
            <div className="score-bar" key={dim.key}>
              <span className="score-bar-label">{dim.label}</span>
              <span className="score-bar-track">
                <span className="score-bar-fill" style={{ width: `${value}%` }} />
              </span>
              <span className="score-bar-value">{value}</span>
            </div>
          );
        })}
      </div>

      {score.fillerWords.length > 0 ? (
        <div className="score-block">
          <h3>Filler words</h3>
          <div className="chips">
            {score.fillerWords.map((f) => (
              <span className="chip chip-warn" key={f.word}>
                “{f.word}” × {f.count}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="score-grid">
        <div className="score-block">
          <h3>What worked</h3>
          <ul className="tick-list">
            {score.strengths.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
        <div className="score-block">
          <h3>What to fix</h3>
          <ul className="cross-list">
            {score.improvements.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      </div>

      {score.drills.length > 0 ? (
        <div className="score-block">
          <h3>Do this next</h3>
          <div className="drills">
            {score.drills.map((drill) => (
              <div className="drill" key={drill.title}>
                <strong>{drill.title}</strong>
                <p>{drill.instruction}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {transcript ? (
        <details className="transcript">
          <summary>What we heard</summary>
          <p>{transcript}</p>
        </details>
      ) : null}
    </section>
  );
}

import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, describeError } from '../lib/api';
import { useRecorder } from '../lib/recorder';
import { uploadAndCreateSession } from '../lib/sessions';
import type { ScoreBreakdown, SessionType } from '../types';
import { RecordPanel } from './RecordPanel';
import { ScoreCard } from './ScoreCard';
import { Spinner } from './Spinner';

type Phase = 'record' | 'analysing' | 'done';

const STEPS = ['Uploading your recording', 'Transcribing what you said', 'Scoring your delivery'] as const;

export function PracticeRunner({
  type,
  lessonId,
  title,
  prompt,
  tips,
  rubric
}: {
  type: SessionType;
  lessonId?: string;
  title?: string;
  prompt: string;
  tips?: string[];
  rubric?: string[];
}) {
  const { user, profile } = useAuth();
  const recorder = useRecorder();
  const [phase, setPhase] = useState<Phase>('record');
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [score, setScore] = useState<ScoreBreakdown | null>(null);
  const [transcript, setTranscript] = useState<string>('');

  const language = profile?.targetLanguage ?? 'en-IN';

  const analyse = async () => {
    if (!recorder.result || !user) return;

    setPhase('analysing');
    setError(null);
    setStep(0);

    try {
      const { sessionId } = await uploadAndCreateSession({
        uid: user.uid,
        type,
        lessonId,
        title: title ?? prompt.slice(0, 60),
        blob: recorder.result.blob,
        durationMs: recorder.result.durationMs
      });

      setStep(1);
      const transcription = await api.transcribeSession({ sessionId, language });
      setTranscript(transcription.transcript);

      setStep(2);
      const scored = await api.scoreSession({ sessionId });
      setScore(scored.score);
      setPhase('done');
    } catch (err) {
      setError(describeError(err));
      setPhase('record');
    }
  };

  const restart = () => {
    recorder.reset();
    setScore(null);
    setTranscript('');
    setPhase('record');
    setStep(0);
    setError(null);
  };

  return (
    <div className="runner">
      <div className="task-card">
        <span className="eyebrow">Your task</span>
        <p className="task-prompt">{prompt}</p>
        {tips && tips.length > 0 ? (
          <ul className="tips">
            {tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        ) : null}
        {rubric && rubric.length > 0 ? (
          <div className="chips">
            {rubric.map((r) => (
              <span className="chip" key={r}>
                {r}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {error ? <div className="banner banner-error">{error}</div> : null}

      {phase === 'record' ? (
        <>
          <RecordPanel recorder={recorder} />
          <div className="runner-actions">
            <button
              className="btn btn-primary btn-lg"
              onClick={analyse}
              disabled={!recorder.result || recorder.isRecording}
            >
              Analyse my speaking
            </button>
            {recorder.result ? (
              <button className="btn btn-ghost" onClick={restart}>
                Start over
              </button>
            ) : null}
          </div>
        </>
      ) : null}

      {phase === 'analysing' ? (
        <div className="analyse-steps">
          {STEPS.map((label, i) => (
            <div
              key={label}
              className={`analyse-step ${i < step ? 'is-done' : i === step ? 'is-active' : ''}`}
            >
              <span className="step-dot">{i < step ? '✓' : i + 1}</span>
              <span>{label}</span>
              {i === step ? <Spinner /> : null}
            </div>
          ))}
          <p className="muted">This usually takes 5-15 seconds.</p>
        </div>
      ) : null}

      {phase === 'done' && score ? (
        <>
          <ScoreCard score={score} transcript={transcript} language={language} />
          <div className="runner-actions">
            <button className="btn btn-primary" onClick={restart}>
              Try it again
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

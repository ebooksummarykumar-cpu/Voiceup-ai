import { MAX_RECORDING_MS, type useRecorder } from '../lib/recorder';
import { formatDuration } from '../lib/format';

type RecorderApi = ReturnType<typeof useRecorder>;

const BARS = 28;

export function RecordPanel({ recorder, hint }: { recorder: RecorderApi; hint?: string }) {
  const { state, isRecording, elapsedMs, level, error, result, start, stop, reset } = recorder;
  const progress = Math.min(1, elapsedMs / MAX_RECORDING_MS);

  return (
    <div className="record-panel">
      <div className={`record-orb ${isRecording ? 'is-recording' : ''}`}>
        <svg className="record-ring" viewBox="0 0 120 120" aria-hidden="true">
          <circle cx="60" cy="60" r="56" className="record-ring-track" />
          <circle
            cx="60"
            cy="60"
            r="56"
            className="record-ring-value"
            strokeDasharray={2 * Math.PI * 56}
            strokeDashoffset={2 * Math.PI * 56 * (1 - progress)}
          />
        </svg>

        {isRecording ? (
          <button className="orb-button" onClick={stop} aria-label="Stop recording">
            <span className="orb-square" />
          </button>
        ) : (
          <button
            className="orb-button"
            onClick={() => (result ? reset() : start())}
            aria-label={result ? 'Record again' : 'Start recording'}
            disabled={state === 'requesting'}
          >
            {state === 'requesting' ? <span className="orb-dots" /> : <span className="orb-mic">🎙️</span>}
          </button>
        )}
      </div>

      <div className="level-meter" aria-hidden="true">
        {Array.from({ length: BARS }).map((_, i) => {
          const active = isRecording && level * BARS > i;
          const mid = Math.abs(i - BARS / 2) / (BARS / 2);
          const height = 12 + (1 - mid) * 26;
          return (
            <span
              key={i}
              className={`level-bar ${active ? 'is-active' : ''}`}
              style={{ height: `${height}px`, animationDelay: `${i * 20}ms` }}
            />
          );
        })}
      </div>

      <p className="record-timer">
        {isRecording
          ? `${formatDuration(elapsedMs)} / ${formatDuration(MAX_RECORDING_MS)}`
          : result
            ? `Recorded ${formatDuration(result.durationMs)}`
            : hint ?? 'Tap the mic and speak'}
      </p>

      {result && !isRecording ? (
        <div className="playback">
          <audio src={result.url} controls preload="metadata" />
        </div>
      ) : null}

      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}

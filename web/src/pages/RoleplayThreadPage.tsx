import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { api, describeError } from '../lib/api';
import { tryPlaySegments } from '../lib/audio';
import { useRecorder } from '../lib/recorder';
import { uploadTurnAudio } from '../lib/sessions';
import { Spinner } from '../components/Spinner';
import type { RoleplayThread } from '../types';

interface Debrief {
  overall: number;
  wentWell: string[];
  workOn: string[];
  bestLine: string;
  nextTime: string;
}

export function RoleplayThreadPage() {
  const { threadId } = useParams<{ threadId: string }>();
  const { user, profile } = useAuth();
  const recorder = useRecorder();

  const [thread, setThread] = useState<RoleplayThread | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [debrief, setDebrief] = useState<Debrief | null>(null);
  const [debriefing, setDebriefing] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const lastSentUrl = useRef<string | null>(null);

  const language = profile?.targetLanguage ?? 'en-IN';

  useEffect(() => {
    if (!user || !threadId) return;

    const unsubscribe = onSnapshot(
      doc(db, 'users', user.uid, 'roleplay', threadId),
      (snap) => {
        if (snap.exists()) {
          setThread({ id: snap.id, ...(snap.data() as Omit<RoleplayThread, 'id'>) });
        } else {
          setThread(null);
        }
        setLoading(false);
      },
      (err) => {
        setError(describeError(err));
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user, threadId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [thread?.messages.length, sending]);

  const sendText = async () => {
    const text = draft.trim();
    if (!text || !threadId || sending) return;

    setDraft('');
    setSending(true);
    setError(null);

    try {
      const result = await api.roleplayTurn({ threadId, text, speak: autoSpeak });
      await tryPlaySegments(result.audio?.segments);
    } catch (err) {
      setError(describeError(err));
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  const sendVoice = async (blob: Blob) => {
    if (!user || !threadId) return;
    setSending(true);
    setError(null);

    try {
      const audioPath = await uploadTurnAudio(user.uid, blob);
      const result = await api.roleplayTurn({ threadId, audioPath, speak: autoSpeak });
      await tryPlaySegments(result.audio?.segments);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSending(false);
      recorder.reset();
    }
  };

  // A finished recording is sent immediately - this is a voice conversation.
  useEffect(() => {
    if (!recorder.result) return;
    if (lastSentUrl.current === recorder.result.url) return;
    lastSentUrl.current = recorder.result.url;
    void sendVoice(recorder.result.blob);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.result]);

  const finish = async () => {
    if (!threadId) return;
    setDebriefing(true);
    setError(null);
    try {
      const result = await api.debriefRoleplay({ threadId });
      setDebrief(result);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setDebriefing(false);
    }
  };

  if (loading) return <div className="page"><Spinner label="Opening conversation" /></div>;

  if (!thread) {
    return (
      <div className="page">
        <div className="empty-state">
          <p>That conversation no longer exists.</p>
          <Link className="btn btn-secondary" to="/roleplay">
            Pick a scenario
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page roleplay-page">
      <Link className="back-link" to="/roleplay">
        ← All scenarios
      </Link>

      <header className="roleplay-head">
        <div>
          <h1>{thread.title}</h1>
          <p className="muted small">
            Speak or type. Replies are short — this is a conversation, not a lecture.
          </p>
        </div>
        <label className="switch">
          <input type="checkbox" checked={autoSpeak} onChange={(e) => setAutoSpeak(e.target.checked)} />
          <span>Voice replies</span>
        </label>
      </header>

      {error ? <div className="banner banner-error">{error}</div> : null}

      <div className="chat-log chat-log-tall">
        {thread.messages.map((message, i) => (
          <div key={i} className={`bubble bubble-${message.role}`}>
            <p>{message.content}</p>
            {message.role === 'assistant' ? (
              <button
                className="bubble-action"
                type="button"
                onClick={async () => {
                  try {
                    const spoken = await api.speak({ text: message.content, language });
                    await tryPlaySegments(spoken.segments);
                  } catch (err) {
                    setError(describeError(err));
                  }
                }}
              >
                🔊 Listen
              </button>
            ) : null}
          </div>
        ))}
        {sending ? <Spinner label="They are responding" /> : null}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input roleplay-input">
        <button
          className={`btn btn-mic ${recorder.isRecording ? 'is-recording' : ''}`}
          onClick={() => (recorder.isRecording ? recorder.stop() : void recorder.start())}
          disabled={sending}
          type="button"
          aria-label={recorder.isRecording ? 'Stop and send' : 'Record a reply'}
        >
          {recorder.isRecording ? '■ Stop' : '🎙️'}
        </button>

        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void sendText();
          }}
          placeholder={recorder.isRecording ? 'Listening…' : 'Type your reply…'}
          disabled={recorder.isRecording}
          aria-label="Your reply"
        />

        <button
          className="btn btn-primary"
          onClick={sendText}
          disabled={!draft.trim() || sending || recorder.isRecording}
          type="button"
        >
          Send
        </button>
      </div>

      {recorder.error ? <p className="field-error">{recorder.error}</p> : null}

      <div className="debrief-bar">
        <button className="btn btn-secondary" onClick={finish} disabled={debriefing} type="button">
          {debriefing ? <Spinner label="Writing debrief" /> : 'End and get a debrief'}
        </button>
      </div>

      {debrief ? (
        <section className="debrief-card">
          <div className="debrief-head">
            <h2>Debrief</h2>
            <span className="score-pill tone-high">{debrief.overall}</span>
          </div>
          <div className="score-grid">
            <div className="score-block">
              <h3>Went well</h3>
              <ul className="tick-list">
                {debrief.wentWell.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="score-block">
              <h3>Work on</h3>
              <ul className="cross-list">
                {debrief.workOn.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
          {debrief.bestLine ? (
            <blockquote className="best-line">“{debrief.bestLine}”</blockquote>
          ) : null}
          <p className="muted">{debrief.nextTime}</p>
        </section>
      ) : null}
    </div>
  );
}

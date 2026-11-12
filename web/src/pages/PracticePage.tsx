import { useState } from 'react';
import { PracticeRunner } from '../components/PracticeRunner';
import { api, describeError } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { tryPlaySegments } from '../lib/audio';
import { Spinner } from '../components/Spinner';

const FREE_PROMPTS = [
  'Describe your job to someone who has never heard of it. 45 seconds.',
  'Talk about a decision you made last month and why. 60 seconds.',
  'Explain one thing you are good at, with an example. 60 seconds.',
  'Pitch yourself for a role you want. 45 seconds.',
  'Tell the story of a mistake you fixed. 60 seconds.'
];

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export function PracticePage() {
  const { profile } = useAuth();
  const [promptIndex, setPromptIndex] = useState(0);
  const [chat, setChat] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const prompt = FREE_PROMPTS[promptIndex % FREE_PROMPTS.length];
  const language = profile?.targetLanguage ?? 'en-IN';

  const send = async () => {
    const text = draft.trim();
    if (!text || thinking) return;

    const nextChat: ChatTurn[] = [...chat, { role: 'user', content: text }];
    setChat(nextChat);
    setDraft('');
    setThinking(true);
    setChatError(null);

    try {
      const result = await api.chat({
        messages: nextChat.map((t) => ({ role: t.role, content: t.content }))
      });
      setChat([...nextChat, { role: 'assistant', content: result.text }]);
    } catch (err) {
      setChatError(describeError(err));
      setChat(nextChat);
    } finally {
      setThinking(false);
    }
  };

  const hearIt = async (text: string) => {
    try {
      const result = await api.speak({ text, language });
      await tryPlaySegments(result.segments);
    } catch (err) {
      setChatError(describeError(err));
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Free practice</p>
          <h1>Speak, then get scored</h1>
          <p className="muted">
            Record an answer to the prompt. You get a transcript, six scores and one thing to fix.
          </p>
        </div>
        <button
          className="btn btn-ghost"
          onClick={() => setPromptIndex((i) => i + 1)}
          type="button"
        >
          Shuffle prompt
        </button>
      </header>

      <PracticeRunner
        key={prompt}
        type="coach"
        prompt={prompt}
        title="Free practice"
        tips={['Aim for 30-60 seconds.', 'One idea, developed, beats five ideas listed.']}
      />

      <section className="section coach-chat">
        <div className="section-head">
          <h2>Ask your coach</h2>
          <span className="muted small">Follow-up questions about your speaking</span>
        </div>

        <div className="chat-log">
          {chat.length === 0 ? (
            <p className="muted">
              Try: “How do I stop saying ‘um’?” or “Was my opening too long?”
            </p>
          ) : null}

          {chat.map((turn, i) => (
            <div key={i} className={`bubble bubble-${turn.role}`}>
              <p>{turn.content}</p>
              {turn.role === 'assistant' ? (
                <button className="bubble-action" onClick={() => hearIt(turn.content)} type="button">
                  🔊 Listen
                </button>
              ) : null}
            </div>
          ))}

          {thinking ? <Spinner label="Coach is thinking" /> : null}
        </div>

        {chatError ? <div className="banner banner-error">{chatError}</div> : null}

        <div className="chat-input">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void send();
            }}
            placeholder="Ask a question about your speaking…"
            aria-label="Message your coach"
          />
          <button className="btn btn-primary" onClick={send} disabled={!draft.trim() || thinking} type="button">
            Send
          </button>
        </div>
      </section>
    </div>
  );
}

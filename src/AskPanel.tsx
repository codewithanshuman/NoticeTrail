import { useEffect, useId, useRef, useState } from 'react';
import { LoaderCircle, MessageCircle, Send } from 'lucide-react';
import type { Fact, Version } from './domain';
import type { PrivacyMode, Source } from './types';
import { answerQuestion, type NoticeAnswer } from './assistant';
import { isConfigured } from './firebase';
import { indexNotice } from './evidence';
import SourceExcerpt from './SourceExcerpt';

const sourceLabels: Record<Source, string> = {
  SAMPLE: 'Prewritten demonstration',
  ON_DEVICE: 'Answered on this device',
  IN_CLOUD: 'Answered in the cloud',
  UNKNOWN: 'Inference source unreported',
};

const demoQuestions = [
  'What do I need to bring?',
  'When is orientation?',
  'What if I cannot attend?',
  'Where can I find the agreement?',
];

function demonstration(question: string, version: Version): NoticeAnswer | null {
  if (version.source !== 'SAMPLE' || !demoQuestions.includes(question)) return null;
  if (question === demoQuestions[3]) {
    return { answer: 'The document does not say where to find the volunteer agreement.', quote: '', source: 'SAMPLE' };
  }
  const patterns = [
    /Bring [^\n]+?\.(?=\s|$)/i,
    /(?:The )?orientation is [^\n]+?\.(?=\s|$)/i,
    /If you cannot attend,[^\n]+?to request another session\./i,
  ];
  const excerpt = version.text.match(patterns[demoQuestions.indexOf(question)])?.[0];
  const match = excerpt ? indexNotice(version.text)(excerpt) : null;
  if (!match) return { answer: 'The document does not say.', quote: '', source: 'SAMPLE' };
  return { answer: match.text, quote: match.text, source: 'SAMPLE' };
}

type Props = { version: Version; selected?: Fact; mode: PrivacyMode };

export default function AskPanel({ version, selected, mode }: Props) {
  const inputId = useId();
  const scope = JSON.stringify([version.id, version.text, selected?.id, selected?.quote, mode]);
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const requestId = useRef(0);
  const activeRequest = useRef(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<NoticeAnswer | null>(null);
  const [asked, setAsked] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const readable = Boolean(version.text.trim()) && !version.image;

  useEffect(() => {
    requestId.current++;
    activeRequest.current = false;
    setAnswer(null);
    setAsked('');
    setError('');
    setBusy(false);
    setProgress(null);
    return () => { requestId.current++; activeRequest.current = false; };
  }, [scope]);

  async function ask(value: string) {
    const nextQuestion = value.trim();
    if (activeRequest.current || nextQuestion.length < 3 || nextQuestion.length > 500 || !readable) return;
    const demo = demonstration(nextQuestion, version);
    setQuestion(nextQuestion);
    setAsked(nextQuestion);
    setError('');
    if (demo) { setAnswer(demo); return; }
    if (!isConfigured) {
      setAnswer(null);
      setError(version.source === 'SAMPLE' ? 'Live questions need Firebase setup. You can try the example questions above.' : 'Live questions need Firebase setup. Your notice and source excerpts are still available to read.');
      return;
    }

    const id = ++requestId.current;
    activeRequest.current = true;
    const currentScope = scope;
    const stillCurrent = () => id === requestId.current && currentScope === scopeRef.current;
    setBusy(true);
    setProgress(null);
    setAnswer(null);
    try {
      const result = await answerQuestion({
        text: version.text,
        question: nextQuestion,
        selectedQuote: selected?.quote,
        mode,
        onProgress: value => { if (stillCurrent() && Number.isFinite(value)) setProgress(Math.min(1, Math.max(0, value))); },
      });
      if (stillCurrent()) setAnswer(result);
    } catch (cause) {
      if (stillCurrent()) setError(cause instanceof Error ? cause.message : 'Could not answer. Please try again.');
    } finally {
      if (stillCurrent()) { activeRequest.current = false; setBusy(false); }
    }
  }

  return <section className="ask-panel" aria-label="Ask about this notice">
    <h3><MessageCircle size={18}/> Ask NoticeTrail</h3>
    <p className="ask-scope">{selected ? 'Focused on ' + selected.title : 'About this notice'} · {version.label}</p>
    {version.source === 'SAMPLE' && readable && <div className="ask-suggestions" aria-label="Demonstration questions">
      {demoQuestions.map(value => <button key={value} type="button" disabled={busy} onClick={() => ask(value)}>{value}</button>)}
    </div>}
    {!readable ? <p>Questions need source text. Review this image and its excerpts in the evidence inspector.</p> : <>
      <form onSubmit={event => { event.preventDefault(); void ask(question); }}>
        <label htmlFor={inputId}>{selected ? 'Ask about this detail' : 'Ask about this notice'}</label>
        <div className="ask-input">
          <input id={inputId} value={question} onChange={event => setQuestion(event.target.value)} maxLength={500} disabled={busy} aria-describedby={inputId + '-help'} placeholder="What does this mean for me?"/>
          <button type="submit" disabled={busy || question.trim().length < 3} aria-label={busy ? 'Reading the notice' : 'Ask question'}>{busy ? <LoaderCircle size={18} className="spin"/> : <Send size={18}/>}</button>
        </div>
        <p className="ask-guidance" id={inputId + '-help'}>Answers use this version only. Check the quoted passage before acting.</p>
      </form>
      {isConfigured && <p className="ask-privacy">{mode === 'auto' ? 'Automatic may send this notice and question to cloud AI.' : 'Device only stops if the local model is unavailable.'}</p>}
    </>}
    <div className="ask-response" aria-live="polite" aria-busy={busy}>
      {busy && <p>{progress !== null && mode === 'device' ? 'Preparing the device model · ' + Math.round(progress * 100) + '%' : 'Reading the notice…'}</p>}
      {error && <p role="alert">{error}</p>}
      {answer && <>
        <small>{sourceLabels[answer.source]}</small>
        {answer.grounding && answer.grounding !== 'not_stated' && <span className="answer-grounding">{answer.grounding === 'excerpt' ? 'From the source' : 'AI interpretation · source matched'}</span>}
        <h4>{asked}</h4>
        <p>{answer.answer}</p>
        {answer.quote && <SourceExcerpt original={version.text} evidence={answer.quote}/>}
      </>}
    </div>
  </section>;
}

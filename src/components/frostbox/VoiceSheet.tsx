'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, cx, Icon, IconButton, VoiceButton, Wave } from './ui';
import { useSpeech } from './useSpeech';
import {
  CATEGORIES, UNITS, addedLabel, categoryOf, formatAmount, formatNumber, shortDate, total, unitWord,
  type Category, type Draft, type InventoryItem, type Source, type Unit,
} from '@/lib/domain';
import { parseCommand, type Question } from '@/lib/parse';

export type VoiceMode = 'voice' | 'type' | 'add';
type Phase = 'listening' | 'typing' | 'review' | 'answer';

type Props = {
  mode: VoiceMode;
  items: InventoryItem[];
  today: string;
  onSave: (drafts: Draft[], source: Source) => Promise<string | null>;
  onClose: () => void;
};

const blankAdd = (today: string): Draft => ({ kind: 'add', name: '', quantity: 1, unit: 'pack', category: 'other', frozenOn: today });
const MIC_NOTE_KEY = 'frostbox:mic-explained';

export function VoiceSheet({ mode, items, today, onSave, onClose }: Props) {
  const speech = useSpeech();
  const [phase, setPhase] = useState<Phase>(mode === 'add' ? 'review' : 'typing');
  const [transcript, setTranscript] = useState('');
  const [typed, setTyped] = useState('');
  const [drafts, setDrafts] = useState<Draft[]>(mode === 'add' ? [blankAdd(today)] : []);
  const [unparsed, setUnparsed] = useState<string[]>([]);
  const [question, setQuestion] = useState<Question | null>(null);
  const [editing, setEditing] = useState<number | null>(mode === 'add' ? 0 : null);
  const [source, setSource] = useState<Source>(mode === 'add' ? 'manual' : 'voice');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [explainMic, setExplainMic] = useState(false);
  const started = useRef(false);

  function understand(text: string, from: Source) {
    const result = parseCommand(text, items, today);
    setTranscript(text);
    setSource(from);
    setUnparsed(result.unparsed);
    setEditing(null);
    if (result.question) {
      setQuestion(result.question);
      setPhase('answer');
      return;
    }
    setQuestion(null);
    setDrafts(result.drafts);
    setPhase('review');
  }

  function listen() {
    setError('');
    setTranscript('');
    try {
      if (!localStorage.getItem(MIC_NOTE_KEY)) {
        setExplainMic(true);
        localStorage.setItem(MIC_NOTE_KEY, '1');
      }
    } catch {}
    const ok = speech.start({
      onText: setTranscript,
      onDone: (text) => (text.trim() ? understand(text, 'voice') : (setError('Didn’t hear anything. Try again, or type it.'), setPhase('typing'))),
      onError: (message) => {
        setError(message);
        setPhase('typing');
      },
    });
    setPhase(ok ? 'listening' : 'typing');
  }

  useEffect(() => {
    if (started.current || mode !== 'voice') return;
    started.current = true;
    if (speech.supported) listen();
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function close() {
    speech.cancel();
    onClose();
  }

  function sayAgain() {
    setDrafts([]);
    setQuestion(null);
    if (speech.supported) listen();
    else {
      setTyped(transcript);
      setPhase('typing');
    }
  }

  const update = (i: number, patch: Partial<Draft>) => setDrafts((l) => l.map((d, j) => (j === i ? ({ ...d, ...patch } as Draft) : d)));
  const problems = drafts.map((d) => problemWith(d, items));
  const ready = drafts.length > 0 && problems.every((p) => !p);

  async function save() {
    setSaving(true);
    setError('');
    const failure = await onSave(drafts, source);
    setSaving(false);
    if (failure) setError(failure);
  }

  const eyebrow =
    phase === 'listening' ? <><Wave className="fb-wave--inline" />Listening…</>
      : phase === 'typing' ? <><Icon name="note" size={14} />Type or dictate</>
        : phase === 'answer' ? <><Icon name="search" size={14} />In this freezer</>
          : <><Icon name="check" size={14} />{mode === 'add' && !transcript ? 'Add item' : 'Review changes'}</>;

  return (
    <div className="fb-scrim" onClick={close}>
      <div className="fb-sheet" role="dialog" aria-modal="true" aria-label={mode === 'add' ? 'Add item' : 'Voice input'} onClick={(e) => e.stopPropagation()}>
        <div className="fb-sheet__grip" aria-hidden />
        <div className="fb-sheet__head">
          <div className="fb-sheet__eyebrow" aria-live="polite">{eyebrow}</div>
          <IconButton icon="x" label="Close" size="sm" onClick={close} />
        </div>

        {phase === 'listening' && (
          <>
            {explainMic && <p className="fb-sheet__perm">Your browser will ask to use the microphone. Its speech service turns what you say into text.</p>}
            <p className="fb-sheet__transcript is-live" aria-live="polite">
              {transcript || <span className="fb-sheet__hint">Try “add two bags of frozen peas” or “we used the lasagna”.</span>}
            </p>
            <div className="fb-sheet__center">
              <VoiceButton state="listening" size="lg" onClick={speech.stop} />
              <div className="fb-sheet__tip">Tap to finish</div>
            </div>
            <button type="button" className="fb-sheet__alt" onClick={() => { speech.cancel(); setTyped(transcript); setPhase('typing'); }}>Type instead</button>
          </>
        )}

        {phase === 'typing' && (
          <form className="fb-sheet__type" onSubmit={(e) => { e.preventDefault(); if (typed.trim()) understand(typed, 'manual'); }}>
            {error && <p className="fb-sheet__error" role="alert">{error}</p>}
            <label className="sr-only" htmlFor="voice-text">What changed in the freezer</label>
            <textarea id="voice-text" className="input" autoFocus value={typed} onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
              placeholder="Add two packs of chicken thighs, took out a pizza" />
            <div className="fb-sheet__foot">
              {speech.supported && <Button size="lg" icon="mic" onClick={listen}>Speak</Button>}
              <Button type="submit" variant="primary" size="lg" block disabled={!typed.trim()}>Review</Button>
            </div>
          </form>
        )}

        {phase === 'answer' && question && (
          <>
            <p className="fb-sheet__transcript">“{transcript}”</p>
            <div className="fb-sheet__answer">
              {question.itemIds.length === 0 ? (
                <p className="muted">None of that in this freezer.</p>
              ) : (
                <ul className="fb-sheet__actions">
                  {question.itemIds.map((id) => {
                    const it = items.find((i) => i.id === id)!;
                    return (
                      <li key={id} className="fb-action">
                        <span className="fb-action__text">
                          <span className="fb-action__name">{it.name}</span>
                          <span className="fb-action__note">{it.lots.length > 1 ? `${it.lots.length} packs · since ${shortDate(it.lots[0].frozenOn, today)}` : addedLabel(it.lots[0].frozenOn, today)}</span>
                        </span>
                        <span className="fb-action__after">{formatAmount(total(it), it.unit)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="fb-sheet__foot">
              <Button size="lg" icon="mic" onClick={sayAgain}>Ask again</Button>
              <Button variant="primary" size="lg" block onClick={close}>Done</Button>
            </div>
          </>
        )}

        {phase === 'review' && (
          <>
            {transcript && <p className="fb-sheet__transcript">“{transcript}”</p>}
            {unparsed.length > 0 && drafts.length > 0 && <p className="fb-sheet__perm">Didn’t catch {unparsed.map((u) => `“${u}”`).join(', ')}.</p>}
            {drafts.length === 0 ? (
              <p className="fb-sheet__hint" style={{ margin: '0 0 var(--space-5)' }}>Didn’t catch that. Try “add two bags of peas”.</p>
            ) : (
              <ul className="fb-sheet__actions">
                {drafts.map((d, i) => (
                  <li key={i} className="fb-actionwrap" data-testid="draft">
                    <ActionRow draft={d} items={items} today={today} problem={problems[i]} onEdit={() => setEditing(editing === i ? null : i)}
                      onChoose={(itemId) => update(i, { itemId, lotId: null, choices: [] })} />
                    {editing === i && (
                      <EditDraft draft={d} items={items} today={today} onChange={(patch) => update(i, patch)} onDone={() => setEditing(null)}
                        onDrop={() => { setDrafts((l) => l.filter((_, j) => j !== i)); setEditing(null); }} />
                    )}
                  </li>
                ))}
              </ul>
            )}
            {mode === 'add' && !transcript && (
              <Button variant="ghost" size="sm" icon="plus" onClick={() => { setDrafts((l) => [...l, blankAdd(today)]); setEditing(drafts.length); }}>Add another item</Button>
            )}
            {error && <p className="fb-sheet__error" role="alert">{error}</p>}
            <div className="fb-sheet__foot" style={{ marginTop: 'var(--space-3)' }}>
              {mode !== 'add' || transcript ? <Button size="lg" icon="mic" onClick={sayAgain}>Say again</Button> : <Button size="lg" onClick={close}>Cancel</Button>}
              {drafts.length > 0 && (
                <Button variant="primary" size="lg" block disabled={!ready || saving} onClick={save}>
                  {saving ? 'Saving…' : `Save ${drafts.length} ${drafts.length === 1 ? 'change' : 'changes'}`}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function describe(d: Draft, items: InventoryItem[], today: string) {
  if (d.kind === 'add') {
    const key = d.name.trim().toLowerCase().replace(/\s+/g, ' ');
    const existing = items.find((i) => i.name.toLowerCase() === key && i.unit === d.unit);
    const have = existing ? total(existing) : 0;
    const label = categoryOf(d.category).label;
    return {
      title: `Add ${formatNumber(d.quantity)}${unitWord(d.quantity, d.unit) ? ` ${unitWord(d.quantity, d.unit)}` : ''} · ${d.name.trim() || 'New item'}`,
      note: [existing ? `${label} · matched existing item` : `New item · ${label}`, d.frozenOn !== today ? addedLabel(d.frozenOn, today) : null,
        d.bestBy ? `Best by ${shortDate(d.bestBy, today)}` : null].filter(Boolean).join(' · '),
      after: have + d.quantity,
      warn: false,
    };
  }
  const item = items.find((i) => i.id === d.itemId);
  if (!item) return { title: `Remove ${formatNumber(d.quantity)} · ${d.heard || 'something'}`, note: 'Not in this freezer. Tap to pick the item.', after: null, warn: true };
  const lot = d.lotId ? item.lots.find((l) => l.id === d.lotId) : item.lots[0];
  const after = total(item) - d.quantity;
  const from = lot ? (d.lotId ? `From the pack added ${shortDate(lot.frozenOn, today)}` : `From the oldest pack (added ${shortDate(lot.frozenOn, today)})`) : '';
  return {
    title: `Remove ${formatNumber(d.quantity)}${unitWord(d.quantity, item.unit) ? ` ${unitWord(d.quantity, item.unit)}` : ''} · ${item.name}`,
    note: after <= 0 ? 'Last one. It will leave the freezer.' : `${from} · ${formatNumber(after)} left`,
    after,
    warn: false,
  };
}

function ActionRow({ draft, items, today, problem, onEdit, onChoose }: {
  draft: Draft; items: InventoryItem[]; today: string; problem: string | null; onEdit: () => void; onChoose: (id: string) => void;
}) {
  const v = describe(draft, items, today);
  const add = draft.kind === 'add';
  const choices = draft.kind === 'remove' ? draft.choices : [];
  return (
    <>
      <button type="button" className={cx('fb-action', add ? 'fb-action--add' : 'fb-action--remove', (v.warn || problem) && 'fb-action--warn')} onClick={onEdit} aria-label={`${v.title}. Tap to change.`}>
        <span className="fb-action__op" aria-hidden><Icon name={add ? 'plus' : 'minus'} size={16} strokeWidth={2} /></span>
        <span className="fb-action__text">
          <span className="fb-action__name">{v.title}</span>
          <span className="fb-action__note">{problem ?? v.note}</span>
        </span>
        <span className="fb-action__after">{v.after != null ? `→ ${formatNumber(Math.max(0, v.after))}` : ''}</span>
      </button>
      {choices.length > 1 && (
        <div className="fb-choices" role="group" aria-label="Which one?">
          {choices.map((id) => {
            const it = items.find((i) => i.id === id);
            return it ? (
              <button key={id} type="button" className={cx('fb-chip', draft.kind === 'remove' && draft.itemId === id && 'is-active')} onClick={() => onChoose(id)}>{it.name}</button>
            ) : null;
          })}
        </div>
      )}
    </>
  );
}

function EditDraft({ draft: d, items, today, onChange, onDone, onDrop }: {
  draft: Draft; items: InventoryItem[]; today: string; onChange: (p: Partial<Draft>) => void; onDone: () => void; onDrop: () => void;
}) {
  const item = d.kind === 'remove' ? items.find((i) => i.id === d.itemId) : null;
  return (
    <div className="fb-edit">
      {d.kind === 'add' ? (
        <>
          <label className="field"><span>Name</span>
            <input className="input" autoFocus value={d.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="Chicken thighs" />
          </label>
          <div className="fb-edit__row">
            <label className="field"><span>Amount</span>
              <input className="input" type="number" inputMode="decimal" min="0.25" step="any" value={d.quantity} onChange={(e) => onChange({ quantity: Number(e.target.value) })} />
            </label>
            <label className="field"><span>Unit</span>
              <select className="input" value={d.unit} onChange={(e) => onChange({ unit: e.target.value as Unit })}>
                {UNITS.map((u) => <option key={u.id} value={u.id}>{u.id === 'item' ? 'Count (no unit)' : u.many}</option>)}
              </select>
            </label>
          </div>
          <div className="fb-edit__row fb-edit__row--2">
            <label className="field"><span>Category</span>
              <select className="input" value={d.category} onChange={(e) => onChange({ category: e.target.value as Category })}>
                {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </label>
            <label className="field"><span>Date added</span>
              <input className="input" type="date" value={d.frozenOn} max={today} onChange={(e) => onChange({ frozenOn: e.target.value })} />
            </label>
          </div>
          <label className="field"><span>Best by (optional)</span>
            <input className="input" type="date" value={d.bestBy ?? ''} min={d.frozenOn} onChange={(e) => onChange({ bestBy: e.target.value || undefined })} />
          </label>
          <p className="t-caption muted">Leave empty to use about {categoryOf(d.category).months} months for {categoryOf(d.category).label.toLowerCase()}.</p>
        </>
      ) : (
        <>
          <label className="field"><span>Item</span>
            <select className="input" value={d.itemId ?? ''} onChange={(e) => onChange({ itemId: e.target.value || null, lotId: null, choices: [] })}>
              <option value="">Pick an item</option>
              {items.filter((i) => total(i) > 0).map((i) => <option key={i.id} value={i.id}>{i.name} ({formatAmount(total(i), i.unit)})</option>)}
            </select>
          </label>
          <div className="fb-edit__row">
            <label className="field"><span>Amount</span>
              <input className="input" type="number" inputMode="decimal" min="0.25" step="any" value={d.quantity} onChange={(e) => onChange({ quantity: Number(e.target.value) })} />
            </label>
            <label className="field"><span>From</span>
              <select className="input" value={d.lotId ?? ''} onChange={(e) => onChange({ lotId: e.target.value || null })} disabled={!item}>
                <option value="">Oldest pack first</option>
                {item?.lots.map((l) => <option key={l.id} value={l.id}>Pack added {shortDate(l.frozenOn, today)} ({formatAmount(l.quantity, item.unit)})</option>)}
              </select>
            </label>
          </div>
        </>
      )}
      <div className="fb-edit__bar">
        <Button variant="danger" size="sm" icon="trash" onClick={onDrop}>Drop this change</Button>
        <Button size="sm" icon="check" onClick={onDone}>Done</Button>
      </div>
    </div>
  );
}

function problemWith(d: Draft, items: InventoryItem[]): string | null {
  if (!(d.quantity > 0)) return 'Amount must be more than zero.';
  if (d.kind === 'add') {
    if (!d.name.trim()) return 'Give it a name.';
    return d.bestBy && d.bestBy < d.frozenOn ? 'Best-by can’t be before the day it went in.' : null;
  }
  const item = items.find((i) => i.id === d.itemId);
  if (!item) return 'Tap to pick which item came out.';
  const have = d.lotId ? item.lots.find((l) => l.id === d.lotId)?.quantity ?? 0 : total(item);
  return d.quantity > have ? `Only ${formatNumber(have)} left${d.lotId ? ' in that pack' : ''}.` : null;
}

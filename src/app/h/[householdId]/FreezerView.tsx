'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ReviewSheet } from './ReviewSheet';
import { useSpeech } from './useSpeech';
import { CATEGORIES, formatAmount, localToday, type Category, type Draft, type InventoryItem } from '@/lib/domain';
import { loadInventory, saveDrafts } from '@/lib/inventory';
import { parseCommand } from '@/lib/parse';
import { supabaseBrowser } from '@/lib/supabase/client';

type Props = {
  household: { id: string; name: string };
  freezers: { id: string; name: string }[];
  initialItems: InventoryItem[];
};

type Review = { drafts: Draft[]; unparsed: string[]; source: 'voice' | 'manual' };

export function FreezerView({ household, freezers, initialItems }: Props) {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [items, setItems] = useState(initialItems);
  const [freezerId, setFreezerId] = useState(freezers[0].id);
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [query, setQuery] = useState('');
  const [command, setCommand] = useState('');
  const [usedMic, setUsedMic] = useState(false);
  const [review, setReview] = useState<Review | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    setItems(await loadInventory(supabase, household.id));
  }, [supabase, household.id]);

  useEffect(() => {
    const channel = supabase
      .channel(`movements:${household.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'movements', filter: `household_id=eq.${household.id}` }, () => {
        void refresh();
      })
      .subscribe();
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      void supabase.removeChannel(channel);
      window.removeEventListener('focus', onFocus);
    };
  }, [supabase, household.id, refresh]);

  const speech = useSpeech((text, final) => {
    setCommand(text);
    setUsedMic(true);
    if (final) openReview(text, 'voice');
  });

  const inFreezer = items.filter((i) => i.freezerId === freezerId);
  const inStock = inFreezer.filter((i) => i.quantity > 0);
  const counts = new Map<Category, number>();
  for (const i of inStock) counts.set(i.category, (counts.get(i.category) ?? 0) + 1);

  const q = query.trim().toLowerCase();
  const visible = inStock.filter((i) => (category === 'all' || i.category === category) && (!q || i.name.toLowerCase().includes(q)));
  const groups = CATEGORIES.map((c) => ({ ...c, items: visible.filter((i) => i.category === c.id) })).filter((g) => g.items.length);

  function openReview(text: string, source: 'voice' | 'manual') {
    if (!text.trim()) return;
    const result = parseCommand(text, inFreezer, localToday());
    setError('');
    setReview({ ...result, source });
  }

  async function save(drafts: Draft[], source: 'voice' | 'manual') {
    setSaving(true);
    setError('');
    const failure = await saveDrafts(supabase, freezerId, drafts, source);
    setSaving(false);
    if (failure) {
      setError(failure);
      return false;
    }
    await refresh();
    setNotice(drafts.length === 1 ? 'Saved.' : `Saved ${drafts.length} changes.`);
    setTimeout(() => setNotice(''), 2500);
    return true;
  }

  async function bump(item: InventoryItem, kind: 'add' | 'remove') {
    const draft: Draft =
      kind === 'add'
        ? { kind, name: item.name, quantity: 1, unit: item.unit, category: item.category, frozenOn: localToday() }
        : { kind, heard: item.name, itemId: item.id, quantity: Math.min(1, item.quantity), ambiguous: false };
    await save([draft], 'manual');
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col pb-40">
      <header className="sticky top-0 z-10 border-b border-line bg-bg/95 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <Link href="/?all=1" className="truncate text-xl font-semibold">{household.name}</Link>
          <nav className="flex shrink-0 gap-4 text-sm font-medium text-accent">
            <Link href={`/h/${household.id}/activity`}>Activity</Link>
            <Link href={`/h/${household.id}/settings`}>Settings</Link>
          </nav>
        </div>
        {freezers.length > 1 && (
          <div className="mt-3 flex gap-2 overflow-x-auto" role="tablist" aria-label="Freezers">
            {freezers.map((f) => (
              <button key={f.id} role="tab" aria-selected={f.id === freezerId} onClick={() => setFreezerId(f.id)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium ${f.id === freezerId ? 'bg-ink text-bg' : 'border border-line bg-surface'}`}>
                {f.name}
              </button>
            ))}
          </div>
        )}
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Categories">
          <Chip active={category === 'all'} onClick={() => setCategory('all')}>All · {inStock.length}</Chip>
          {CATEGORIES.filter((c) => counts.get(c.id)).map((c) => (
            <Chip key={c.id} active={category === c.id} onClick={() => setCategory(c.id)}>{c.label} · {counts.get(c.id)}</Chip>
          ))}
        </div>
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${freezers.find((f) => f.id === freezerId)?.name ?? ''}`} className="field mt-2" />
      </header>

      <main className="flex flex-col gap-5 px-4 pt-4">
        {groups.length === 0 && (
          <div className="card text-muted p-6 text-center">
            {inStock.length === 0 ? (
              <>
                <p className="text-ink text-lg font-medium">This freezer is empty.</p>
                <p className="mt-1 text-sm">Try saying “add two packs of ground turkey and a frozen pizza”.</p>
              </>
            ) : (
              <p>Nothing matches.</p>
            )}
          </div>
        )}
        {groups.map((g) => (
          <section key={g.id} aria-label={g.label}>
            <h2 className="text-muted mb-2 text-xs font-semibold tracking-wider uppercase">{g.label}</h2>
            <ul className="card divide-y divide-line">
              {g.items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{item.name}</p>
                    <p className="text-muted text-sm">
                      {item.oldestFrozenOn && <>Frozen {formatDate(item.oldestFrozenOn)}</>}
                    </p>
                  </div>
                  <button aria-label={`Remove one ${item.name}`} onClick={() => bump(item, 'remove')} disabled={saving}
                    className="grid size-10 place-items-center rounded-full border border-line text-xl">−</button>
                  <span className="min-w-14 text-center font-semibold tabular-nums" data-testid="amount">{formatAmount(item.quantity, item.unit)}</span>
                  <button aria-label={`Add one ${item.name}`} onClick={() => bump(item, 'add')} disabled={saving}
                    className="grid size-10 place-items-center rounded-full border border-line text-xl">+</button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          openReview(command, usedMic ? 'voice' : 'manual');
        }}
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] backdrop-blur"
      >
        <div className="mx-auto flex max-w-2xl flex-col gap-2">
          {(notice || error || speech.error) && !review && (
            <p role="status" className={`text-sm ${notice ? 'text-ok' : 'text-danger'}`}>{notice || error || speech.error}</p>
          )}
          <div className="flex items-end gap-2">
            {speech.supported && (
              <button type="button" onClick={() => (speech.listening ? speech.stop() : speech.start())}
                aria-label={speech.listening ? 'Stop listening' : 'Speak a command'}
                className={`grid size-12 shrink-0 place-items-center rounded-full text-xl ${speech.listening ? 'animate-pulse bg-danger text-white' : 'bg-accent text-accent-ink'}`}>
                🎙
              </button>
            )}
            <textarea
              value={command}
              onChange={(e) => {
                setCommand(e.target.value);
                setUsedMic(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  openReview(command, usedMic ? 'voice' : 'manual');
                }
              }}
              rows={1}
              aria-label="Command"
              placeholder={speech.supported ? 'e.g. “took out a pizza”' : 'e.g. “add 2 packs of chicken”'}
              className="field min-h-12 resize-none"
            />
            <button className="btn-primary h-12 shrink-0" disabled={!command.trim()}>Go</button>
          </div>
          <button type="button" className="self-start text-sm font-medium text-accent"
            onClick={() => setReview({ drafts: [{ kind: 'add', name: '', quantity: 1, unit: 'pack', category: 'other', frozenOn: localToday() }], unparsed: [], source: 'manual' })}>
            + Add an item by hand
          </button>
        </div>
      </form>

      {review && (
        <ReviewSheet
          initial={review.drafts}
          unparsed={review.unparsed}
          items={inStock}
          saving={saving}
          error={error}
          onCancel={() => {
            setReview(null);
            setError('');
          }}
          onSave={async (drafts) => {
            if (await save(drafts, review.source)) {
              setReview(null);
              setCommand('');
              setUsedMic(false);
            }
          }}
        />
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${active ? 'bg-accent text-accent-ink' : 'border border-line bg-surface'}`}>
      {children}
    </button>
  );
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}


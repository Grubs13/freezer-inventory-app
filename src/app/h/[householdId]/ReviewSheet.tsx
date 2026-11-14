'use client';

import { useState } from 'react';
import { CATEGORIES, UNITS, formatAmount, localToday, type Category, type Draft, type InventoryItem, type Unit } from '@/lib/domain';

type Props = {
  initial: Draft[];
  unparsed: string[];
  items: InventoryItem[];
  saving: boolean;
  error: string;
  onCancel: () => void;
  onSave: (drafts: Draft[]) => void;
};

export function ReviewSheet({ initial, unparsed, items, saving, error, onCancel, onSave }: Props) {
  const [drafts, setDrafts] = useState(initial);
  const update = (index: number, patch: Partial<Draft>) =>
    setDrafts((list) => list.map((d, i) => (i === index ? ({ ...d, ...patch } as Draft) : d)));
  const problems = drafts.map((d) => problemWith(d, items));
  const ready = drafts.length > 0 && problems.every((p) => !p);

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center" onClick={onCancel}>
      <div role="dialog" aria-modal="true" aria-label="Check before saving" onClick={(e) => e.stopPropagation()}
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-bg p-4 pb-[max(env(safe-area-inset-bottom),1rem)] sm:rounded-3xl">
        <h2 className="text-lg font-semibold">Check before saving</h2>
        {unparsed.length > 0 && (
          <p className="text-danger mt-1 text-sm">Didn’t catch: {unparsed.map((u) => `“${u}”`).join(', ')}</p>
        )}
        {drafts.length === 0 && <p className="text-muted mt-3">Nothing to save. Add an item below or try again.</p>}

        <ol className="mt-3 flex flex-col gap-3">
          {drafts.map((d, i) => (
            <li key={i} className="card flex flex-col gap-2 p-3" data-testid="draft">
              <div className="flex items-center justify-between">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${d.kind === 'add' ? 'bg-accent-soft text-accent' : 'bg-danger/10 text-danger'}`}>
                  {d.kind === 'add' ? 'Add' : 'Take out'}
                </span>
                <button type="button" onClick={() => setDrafts((l) => l.filter((_, j) => j !== i))} className="text-muted text-sm" aria-label="Drop this line">✕</button>
              </div>

              {d.kind === 'add' ? (
                <>
                  <input aria-label="Name" value={d.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="What is it?" className="field" />
                  <div className="grid grid-cols-[5rem_1fr] gap-2">
                    <input aria-label="Quantity" type="number" inputMode="decimal" min="0.25" step="any" value={d.quantity}
                      onChange={(e) => update(i, { quantity: Number(e.target.value) })} className="field" />
                    <select aria-label="Unit" value={d.unit} onChange={(e) => update(i, { unit: e.target.value as Unit })} className="field">
                      {UNITS.map((u) => <option key={u.id} value={u.id}>{u.id === 'item' ? 'count (no unit)' : u.many}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select aria-label="Category" value={d.category} onChange={(e) => update(i, { category: e.target.value as Category })} className="field">
                      {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                    <input aria-label="Date frozen" type="date" value={d.frozenOn} max={localToday()} onChange={(e) => update(i, { frozenOn: e.target.value })} className="field" />
                  </div>
                </>
              ) : (
                <>
                  {d.heard && <p className="text-muted text-sm">Heard “{d.heard}”{d.ambiguous && d.itemId ? ', is this the right one?' : ''}</p>}
                  <div className="grid grid-cols-[5rem_1fr] gap-2">
                    <input aria-label="Quantity" type="number" inputMode="decimal" min="0.25" step="any" value={d.quantity}
                      onChange={(e) => update(i, { quantity: Number(e.target.value) })} className="field" />
                    <select aria-label="Item" value={d.itemId ?? ''} onChange={(e) => update(i, { itemId: e.target.value || null, ambiguous: false })}
                      className={`field ${d.ambiguous ? 'border-danger' : ''}`}>
                      <option value="">Which item?</option>
                      {items.map((it) => <option key={it.id} value={it.id}>{it.name} ({formatAmount(it.quantity, it.unit)})</option>)}
                    </select>
                  </div>
                </>
              )}
              {problems[i] && <p className="text-danger text-sm">{problems[i]}</p>}
            </li>
          ))}
        </ol>

        <button type="button" className="mt-3 text-sm font-medium text-accent"
          onClick={() => setDrafts((l) => [...l, { kind: 'add', name: '', quantity: 1, unit: 'pack', category: 'other', frozenOn: localToday() }])}>
          + Another item
        </button>

        {error && <p role="alert" className="text-danger mt-3 text-sm">{error}</p>}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" className="btn" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn-primary" disabled={!ready || saving} onClick={() => onSave(drafts)}>
            {saving ? 'Saving…' : drafts.length > 1 ? `Save ${drafts.length}` : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function problemWith(d: Draft, items: InventoryItem[]): string | null {
  if (!(d.quantity > 0)) return 'Amount must be more than zero.';
  if (d.kind === 'add') return d.name.trim() ? null : 'Give it a name.';
  if (!d.itemId) return 'Pick which item came out.';
  const have = items.find((i) => i.id === d.itemId)?.quantity ?? 0;
  return d.quantity > have ? `Only ${have} left.` : null;
}

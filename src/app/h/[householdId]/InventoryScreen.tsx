'use client';

import { useState } from 'react';
import { useHousehold } from './HouseholdShell';
import { InventoryTable, ItemRow, type InventoryRow } from '@/components/frostbox/inventory';
import { Button, CategoryChips, Icon, IconButton, SearchField, StatCard } from '@/components/frostbox/ui';
import { CATEGORIES, categoryOf, shortDate, total, type Category, type InventoryItem } from '@/lib/domain';
import { itemStatus, lotViews, stepItem, stepLot, stepperUnit } from '@/lib/views';

type StatusFilter = 'all' | 'soon' | 'expired';

export function InventoryScreen() {
  const { household, freezers, freezer, setFreezerId, inFreezer, today, busy, change, openVoice } = useHousehold();
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');

  const stocked = inFreezer.filter((i) => total(i) > 0);
  const statusOf = new Map(stocked.map((i) => [i.id, itemStatus(i, today)]));
  const count = (s: 'soon' | 'expired') => stocked.filter((i) => statusOf.get(i.id) === s).length;
  const month = today.slice(0, 7);
  const addedThisMonth = stocked.flatMap((i) => i.lots).filter((l) => l.frozenOn.startsWith(month));

  const perCategory = new Map<Category, number>();
  for (const i of stocked) perCategory.set(i.category, (perCategory.get(i.category) ?? 0) + 1);
  const chips = [
    { id: 'all', label: 'All', count: stocked.length },
    ...CATEGORIES.filter((c) => perCategory.get(c.id)).sort((a, b) => perCategory.get(b.id)! - perCategory.get(a.id)!)
      .map((c) => ({ id: c.id, label: c.label, count: perCategory.get(c.id) })),
  ];

  const q = query.trim().toLowerCase();
  const visible = stocked.filter((i) =>
    (category === 'all' || i.category === category) &&
    (status === 'all' || statusOf.get(i.id) === status) &&
    (!q || i.name.toLowerCase().includes(q)));
  const oldestFirst = [...visible].sort((a, b) => a.lots[0].frozenOn.localeCompare(b.lots[0].frozenOn));
  const filtered = category !== 'all' || status !== 'all' || q !== '';
  const eatNext = oldestFirst.filter((i) => statusOf.get(i.id) !== 'fresh');
  const rest = visible.filter((i) => statusOf.get(i.id) === 'fresh')
    .sort((a, b) => b.lots[b.lots.length - 1].frozenOn.localeCompare(a.lots[a.lots.length - 1].frozenOn));

  const href = (i: InventoryItem) => `/h/${household.id}/item/${i.id}`;
  const row = (i: InventoryItem) => (
    <ItemRow key={i.id} name={i.name} category={categoryOf(i.category).label} qty={total(i)} unit={stepperUnit(i, total(i))}
      status={statusOf.get(i.id)!} lots={lotViews(i, today)} href={href(i)} disabled={busy}
      onQtyChange={(n) => change(stepItem(i, n, today))} />
  );
  const tableRows: InventoryRow[] = oldestFirst.map((i) => ({
    id: i.id, name: i.name, category: categoryOf(i.category).label, status: statusOf.get(i.id)!, qty: total(i),
    unit: stepperUnit(i, total(i)), href: href(i), lots: lotViews(i, today, true),
    added: i.lots.length > 1 ? `Oldest ${shortDate(i.lots[0].frozenOn, today, true)}` : shortDate(i.lots[0].frozenOn, today, true),
  }));
  const byId = new Map(stocked.map((i) => [i.id, i]));

  const toggle = (s: StatusFilter) => setStatus((cur) => (cur === s ? 'all' : s));

  return (
    <>
      <header className="screenhead">
        <div>
          <div className="t-overline muted">{household.name}</div>
          {freezers.length > 1 ? (
            <label className="freezer-pick">
              <h1 className="t-title screenhead__title">{freezer.name}</h1>
              <Icon name="chevronDown" size={18} />
              <select value={freezer.id} onChange={(e) => setFreezerId(e.target.value)} aria-label="Switch freezer">
                {freezers.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </label>
          ) : (
            <h1 className="t-title screenhead__title">{freezer.name}</h1>
          )}
        </div>
        <div className="screenhead__actions">
          <span className="only-mobile"><IconButton icon="plus" label="Add item" variant="secondary" onClick={() => openVoice('add')} /></span>
          <span className="only-desktop"><Button icon="mic" onClick={() => openVoice('voice')}>Speak</Button></span>
          <span className="only-desktop"><Button variant="primary" icon="plus" onClick={() => openVoice('add')}>Add item</Button></span>
        </div>
      </header>

      <div className="stats stats--home">
        <StatCard compact label="Items" value={stocked.length} hint={`across ${perCategory.size} ${perCategory.size === 1 ? 'category' : 'categories'}`} />
        <StatCard compact label="Use soon" value={count('soon')} tone="soon" hint="eat these next" pressed={status === 'soon'} onClick={() => toggle('soon')} />
        <StatCard compact label="Past best" value={count('expired')} tone="expired" hint="still safe, quality drops" pressed={status === 'expired'} onClick={() => toggle('expired')} />
        <span className="only-desktop">
          <StatCard compact label="Added this month" value={addedThisMonth.length} tone="frost"
            hint={`${addedThisMonth.filter((l) => l.source === 'voice').length} by voice`} />
        </span>
      </div>

      <div className="toolbar">
        <SearchField value={query} onChange={(e) => setQuery(e.target.value)} onVoice={() => openVoice('voice')} />
        <CategoryChips items={chips} active={category} onChange={(id) => setCategory(id as Category | 'all')} />
      </div>

      {stocked.length === 0 ? (
        <div className="empty" style={{ marginTop: 'var(--space-6)' }}>
          <div className="empty__art"><Icon name="snowflake" size={28} /></div>
          <p className="t-heading">Your freezer’s empty.</p>
          <p className="muted">Tap the mic and say what you put in.</p>
          <Button variant="primary" size="lg" icon="plus" onClick={() => openVoice('add')}>Add item</Button>
        </div>
      ) : visible.length === 0 ? (
        <div className="empty" style={{ marginTop: 'var(--space-6)' }}><p className="muted">Nothing matches. Try another search or category.</p></div>
      ) : (
        <>
          <div className="only-mobile">
            {filtered ? (
              <>
                <div className="fb-section-head"><h2>{visible.length} {visible.length === 1 ? 'item' : 'items'}</h2><span className="muted t-caption">Oldest first</span></div>
                <div className="fb-list">{oldestFirst.map(row)}</div>
              </>
            ) : (
              <>
                {eatNext.length > 0 && (
                  <>
                    <div className="fb-section-head"><h2>Eat next</h2><span className="muted t-caption">Oldest first</span></div>
                    <div className="fb-list">{eatNext.map(row)}</div>
                  </>
                )}
                {rest.length > 0 && (
                  <>
                    <div className="fb-section-head"><h2>{eatNext.length ? 'Everything else' : 'In the freezer'}</h2><span className="muted t-caption">Newest first</span></div>
                    <div className="fb-list">{rest.map(row)}</div>
                  </>
                )}
              </>
            )}
          </div>
          <div className="only-desktop">
            <InventoryTable rows={tableRows} disabled={busy}
              onQtyChange={(r, n) => change(stepItem(byId.get(r.id)!, n, today))}
              onLotQtyChange={(r, l, n) => {
                const item = byId.get(r.id)!;
                change(stepLot(item, item.lots.find((x) => x.id === l.id)!, n, today));
              }} />
          </div>
        </>
      )}
    </>
  );
}


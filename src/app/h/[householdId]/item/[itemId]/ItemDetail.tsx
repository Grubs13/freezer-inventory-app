'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useHousehold } from '../../HouseholdShell';
import { LotList } from '@/components/frostbox/inventory';
import { Button, Icon, StatCard } from '@/components/frostbox/ui';
import { bestBy, categoryOf, daysSince, formatNumber, initials, shortDate, total, unitWord } from '@/lib/domain';
import { supabaseBrowser } from '@/lib/supabase/client';
import { itemStatus, lotViews, stepLot } from '@/lib/views';

type Movement = { id: number; delta: number; source: string; user_id: string; created_at: string };

export function ItemDetail({ itemId }: { itemId: string }) {
  const { household, freezers, freezer, setFreezerId, items, today, busy, change } = useHousehold();
  const supabase = useMemo(() => supabaseBrowser(), []);
  const item = items.find((i) => i.id === itemId);
  const [history, setHistory] = useState<{ rows: Movement[]; who: Map<string, string> } | null>(null);
  const have = item ? total(item) : 0;

  useEffect(() => {
    if (item && item.freezerId !== freezer.id) setFreezerId(item.freezerId);
  }, [item, freezer.id, setFreezerId]);

  useEffect(() => {
    let live = true;
    void (async () => {
      const [{ data: rows }, { data: members }, { data: me }] = await Promise.all([
        supabase.from('movements').select('id, delta, source, user_id, created_at').eq('item_id', itemId).order('created_at', { ascending: false }).limit(50),
        supabase.from('memberships').select('user_id, email').eq('household_id', household.id),
        supabase.auth.getUser(),
      ]);
      if (!live) return;
      const who = new Map((members ?? []).map((m) => [m.user_id as string, m.user_id === me.user?.id ? 'You' : (m.email as string).split('@')[0]]));
      setHistory({ rows: (rows ?? []) as Movement[], who });
    })();
    return () => {
      live = false;
    };
  }, [supabase, itemId, household.id, have]);

  const back = (
    <Link href={`/h/${household.id}`} className="fb-back"><Icon name="chevronLeft" size={20} />{freezers.find((f) => f.id === item?.freezerId)?.name ?? freezer.name}</Link>
  );
  if (!item) {
    return (
      <>
        {back}
        <div className="empty" style={{ marginTop: 'var(--space-4)' }}><p className="muted">This item isn’t in the household any more.</p></div>
      </>
    );
  }

  const category = categoryOf(item.category);
  const oldestLot = item.lots[0];
  const weighed = ['lb', 'oz', 'kg', 'g'].includes(item.unit);
  const addPack = () => change({
    actions: [{ kind: 'add', item_id: item.id, quantity: 1, frozen_on: today }],
    text: `Added 1 ${unitWord(1, item.unit) || 'more'} of ${item.name}`,
    detail: item.lots.some((l) => l.frozenOn === today) ? 'Into today’s pack' : 'New pack dated today',
  });

  return (
    <>
      {back}
      <div className="detailhead">
        <div className="fb-item__tile" aria-hidden>{initials(category.label)}</div>
        <div>
          <h1 className="t-title">{item.name}</h1>
          <div className="t-label muted" style={{ fontWeight: 400 }}>{category.label} · keeps about {category.months} months</div>
        </div>
      </div>

      {oldestLot ? (
        <>
          <div className="stats">
            <StatCard compact label="On hand" value={formatNumber(have)} hint={unitWord(have, item.unit) || 'count'} />
            <StatCard compact label="Oldest" value={`${daysSince(oldestLot.frozenOn, today)}d`} hint={shortDate(oldestLot.frozenOn, today)} tone={itemStatus(item, today)} />
            <StatCard compact label="Best by" value={shortDate(bestBy(item.category, oldestLot.frozenOn), today).replace(/, \d{4}$/, '')}
              hint={`oldest pack, ${bestBy(item.category, oldestLot.frozenOn).slice(0, 4)}`} />
          </div>
          <div style={{ marginTop: 'var(--space-4)' }}>
            <LotList lots={lotViews(item, today)} unit={weighed ? item.unit : undefined} onAdd={addPack} disabled={busy}
              onQtyChange={(l, n) => change(stepLot(item, item.lots.find((x) => x.id === l.id)!, n, today))} />
          </div>
        </>
      ) : (
        <div className="empty">
          <p className="t-heading">None left in the freezer.</p>
          <Button variant="primary" size="lg" icon="plus" onClick={addPack} disabled={busy}>Add a pack</Button>
        </div>
      )}

      <div className="fb-section-head"><h2>History</h2></div>
      {history && history.rows.length > 0 ? (
        <ul className="fb-history">
          {history.rows.map((m) => {
            const n = Number(m.delta);
            const word = unitWord(Math.abs(n), item.unit);
            return (
              <li key={m.id}>
                <Icon name={n > 0 ? 'plus' : 'minus'} size={16} />
                <div>
                  {n > 0 ? 'Added' : 'Removed'} {formatNumber(Math.abs(n))}{word ? ` ${word}` : ''}
                  <time dateTime={m.created_at}>
                    {new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {history.who.get(m.user_id) ?? 'Former member'}
                    {m.source === 'voice' ? ' · by voice' : ''}
                  </time>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="muted t-label" style={{ fontWeight: 400 }}>{history ? 'No history yet.' : 'Loading…'}</p>
      )}
    </>
  );
}

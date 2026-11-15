'use client';

import Link from 'next/link';
import { Fragment, useState } from 'react';
import { Badge, Button, cx, Icon, QuantityStepper, VoiceButton, type IconName, type VoiceState } from './ui';
import { initials, type Freshness, type Source } from '@/lib/domain';

/** One pack as the components show it. Dates arrive already formatted. */
export type LotView = { id: string; date: string; qty: number; unit?: string; added: string; bestBy?: string; status: Freshness; note?: string; source?: Source };

type ItemRowProps = {
  name: string;
  category: string;
  qty: number;
  unit?: string;
  added?: string;
  status: Freshness;
  lots?: LotView[];
  href?: string;
  onQtyChange?: (n: number) => void;
  disabled?: boolean;
};

export function ItemRow({ name, category, qty, unit, added, status, lots, href, onQtyChange, disabled }: ItemRowProps) {
  const many = lots && lots.length > 1;
  const when = (label: string) => label.replace(/^Added /, '');
  const first = added ?? lots?.[0]?.added;
  const meta = many ? `Since ${when(lots[0].added)}` : first ? capitalize(when(first)) : category;
  const main = (
    <>
      <div className="fb-item__name">{name}</div>
      <div className="fb-item__meta">
        <Badge tone={status} dot />
        <span>{meta}</span>
      </div>
    </>
  );
  return (
    <div className={cx('fb-item', href && 'is-link')} data-testid="item-row">
      <div className="fb-item__tile" aria-hidden>
        {initials(category)}
        {many && <span className="fb-item__stack">{lots.length}</span>}
      </div>
      {href ? (
        <Link href={href} className="fb-item__main" aria-label={`Open ${name}`}>{main}</Link>
      ) : (
        <div className="fb-item__main">{main}</div>
      )}
      <QuantityStepper size="sm" value={qty} unit={unit} onChange={(n) => onQtyChange?.(n)} label={`Quantity of ${name}`} trashAtOne disabled={disabled || !onQtyChange} />
      {href && (
        <Link href={href} className="fb-item__chev" aria-hidden tabIndex={-1}>
          <Icon name="chevronRight" size={16} />
        </Link>
      )}
    </div>
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function dateParts(iso: string): [string, string] {
  const d = new Date(`${iso}T12:00:00`);
  return [d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(), String(d.getDate())];
}

export function LotList({ lots, unit, title = 'Packs', onAdd, onQtyChange, disabled }: {
  lots: LotView[];
  unit?: string;
  title?: string | false;
  onAdd?: () => void;
  onQtyChange?: (lot: LotView, n: number) => void;
  disabled?: boolean;
}) {
  const sum = lots.reduce((n, l) => n + l.qty, 0);
  return (
    <div className="fb-lots">
      {title !== false && (
        <div className="fb-lots__head">
          <div>
            <div className="fb-lots__title">{title}</div>
            <div className="fb-lots__sub">
              {lots.length} {lots.length === 1 ? 'pack' : 'packs'}
              {unit ? ` · ${Number.isInteger(sum) ? sum : sum.toFixed(2)} ${unit} total` : ''} · oldest first
            </div>
          </div>
          {onAdd && <Button size="sm" icon="plus" onClick={onAdd} disabled={disabled}>Add a pack</Button>}
        </div>
      )}
      <ul className="fb-lots__list">
        {lots.map((l, i) => {
          const [mon, day] = dateParts(l.date);
          return (
            <li key={l.id} className={cx('fb-lot', i === 0 && 'is-first')} data-testid="lot">
              <div className="fb-lot__date" aria-hidden><span>{mon}</span><b>{day}</b></div>
              <div className="fb-lot__main">
                <div className="fb-lot__title">{l.added}{i === 0 && lots.length > 1 && <Badge tone="frost">Use first</Badge>}</div>
                <div className="fb-lot__meta">
                  <Badge tone={l.status} dot />
                  {l.bestBy && <span>Best by {l.bestBy}</span>}
                </div>
                {(l.note || l.source === 'voice') && (
                  <div className="fb-lot__note">
                    <Icon name={l.source === 'voice' ? 'mic' : 'note'} size={12} />
                    {[l.source === 'voice' ? 'Added by voice' : null, l.note].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
              <QuantityStepper size="sm" value={l.qty} unit={l.unit} onChange={(n) => onQtyChange?.(l, n)}
                label={`Quantity in pack ${l.added.toLowerCase()}`} trashAtOne disabled={disabled || !onQtyChange} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export type InventoryRow = {
  id: string;
  name: string;
  category: string;
  added: string;
  status: Freshness;
  qty: number;
  unit?: string;
  href: string;
  lots: LotView[];
};

export function InventoryTable({ rows, onQtyChange, onLotQtyChange, disabled }: {
  rows: InventoryRow[];
  onQtyChange: (row: InventoryRow, n: number) => void;
  onLotQtyChange: (row: InventoryRow, lot: LotView, n: number) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  return (
    <div className="fb-table-wrap">
      <table className="fb-table">
        <thead>
          <tr>
            <th>Item</th><th>Category</th><th>Added</th><th>Status</th><th className="is-num">Quantity</th><th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const multi = r.lots.length > 1;
            const expanded = multi && open[r.id];
            return (
              <Fragment key={r.id}>
                <tr className={cx(expanded && 'is-open')}>
                  <td>
                    <div className="fb-table__item">
                      {multi ? (
                        <button type="button" className={cx('fb-table__toggle', expanded && 'is-open')} aria-expanded={expanded}
                          aria-label={`${expanded ? 'Hide' : 'Show'} packs of ${r.name}`} onClick={() => setOpen((o) => ({ ...o, [r.id]: !o[r.id] }))}>
                          <Icon name="chevronRight" size={14} />
                        </button>
                      ) : <span className="fb-table__toggle-sp" />}
                      <span className="fb-table__tile" aria-hidden>{initials(r.category)}</span>
                      <span className="fb-table__name"><Link href={r.href}>{r.name}</Link></span>
                      {multi && <span className="fb-table__lots">{r.lots.length} packs</span>}
                    </div>
                  </td>
                  <td className="is-muted">{r.category}</td>
                  <td className="is-muted">{r.added}</td>
                  <td><Badge tone={r.status} dot /></td>
                  <td className="is-num">
                    <QuantityStepper size="sm" value={r.qty} unit={r.unit} onChange={(n) => onQtyChange(r, n)} label={`Quantity of ${r.name}`} trashAtOne disabled={disabled} />
                  </td>
                  <td className="is-action"><Link href={r.href} className="fb-iconbtn fb-iconbtn--ghost fb-iconbtn--sm" aria-label={`Open ${r.name}`}><Icon name="chevronRight" size={16} /></Link></td>
                </tr>
                {expanded && r.lots.map((l, i) => (
                  <tr key={l.id} className="fb-table__lot">
                    <td>
                      <div className="fb-table__lotname">
                        <span className="fb-table__lotdot" aria-hidden />Pack {i + 1}
                        {i === 0 && <Badge tone="frost">Use first</Badge>}
                        {l.source === 'voice' && <span className="fb-table__lotnote">Added by voice</span>}
                      </div>
                    </td>
                    <td className="is-muted">{l.bestBy ? `Best by ${l.bestBy}` : ''}</td>
                    <td className="is-muted">{l.added.replace(/^Added /, '')}</td>
                    <td><Badge tone={l.status} dot /></td>
                    <td className="is-num">
                      <QuantityStepper size="sm" value={l.qty} unit={l.unit} onChange={(n) => onLotQtyChange(r, l, n)} label={`Quantity in pack ${i + 1} of ${r.name}`} trashAtOne disabled={disabled} />
                    </td>
                    <td className="is-action" />
                  </tr>
                ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export type Tab = { id: string; label: string; icon: IconName; href: string };

export function TabBar({ items, active, onVoice, voiceState }: { items: Tab[]; active: string; onVoice?: () => void; voiceState?: VoiceState }) {
  const half = Math.ceil(items.length / 2);
  const tab = (t: Tab) => (
    <Link key={t.id} href={t.href} className={cx('fb-tab', t.id === active && 'is-active')} aria-current={t.id === active ? 'page' : undefined}>
      <Icon name={t.icon} size={22} />
      <span>{t.label}</span>
    </Link>
  );
  return (
    <nav className="fb-tabbar" aria-label="Main">
      {items.slice(0, half).map(tab)}
      {onVoice && <div className="fb-tabbar__voice"><VoiceButton state={voiceState} onClick={onVoice} /></div>}
      {items.slice(half).map(tab)}
    </nav>
  );
}

export function Toast({ text, detail, tone, onUndo }: { text: string; detail?: string; tone?: 'error'; onUndo?: () => void }) {
  return (
    <div className={cx('fb-toast', tone === 'error' && 'fb-toast--error')} role="status" aria-live="polite">
      <div className="fb-toast__text">{text}{detail && <small>{detail}</small>}</div>
      {onUndo && <Button size="sm" onClick={onUndo}>Undo</Button>}
    </div>
  );
}

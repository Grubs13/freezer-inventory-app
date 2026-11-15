import type { LotView } from '@/components/frostbox/inventory';
import {
  addedLabel, bestBy, freshness, formatNumber, shortDate, total, unitWord,
  type Freshness, type InventoryItem, type Lot,
} from './domain';
import type { Action } from './inventory';

const monthDay = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/** Steppers show units like "bags" or "lb". Packs and plain counts show just the number, as in the Frostbox lists. */
export const stepperUnit = (item: InventoryItem, qty: number) => (item.unit === 'pack' ? undefined : unitWord(qty, item.unit) || undefined);

export function lotStatus(item: InventoryItem, lot: Lot, today: string): Freshness {
  return freshness(item.category, lot.frozenOn, today);
}

/** An item's freshness is its oldest pack's, because that one is eaten next. */
export function itemStatus(item: InventoryItem, today: string): Freshness {
  return item.lots[0] ? lotStatus(item, item.lots[0], today) : 'fresh';
}

export function lotViews(item: InventoryItem, today: string, withYear = false): LotView[] {
  return item.lots.map((l) => ({
    id: l.id,
    qty: l.quantity,
    unit: stepperUnit(item, l.quantity),
    date: l.frozenOn,
    added: withYear ? `Added ${shortDate(l.frozenOn, today, true)}` : addedLabel(l.frozenOn, today),
    bestBy: withYear ? shortDate(bestBy(item.category, l.frozenOn), today, true) : monthDay(bestBy(item.category, l.frozenOn)),
    status: lotStatus(item, l, today),
    source: l.source,
  }));
}

export type Change = { actions: Action[]; text: string; detail?: string };

const amount = (item: InventoryItem, q: number) => {
  const word = unitWord(q, item.unit);
  return `${formatNumber(q)} ${word ? `${word} of ` : ''}${item.name}`;
};

/** + on an item adds one to today's pack; − takes one from the oldest pack. */
export function stepItem(item: InventoryItem, next: number, today: string): Change {
  const have = total(item);
  if (next > have) {
    return {
      actions: [{ kind: 'add', item_id: item.id, quantity: 1, frozen_on: today }],
      text: `Added ${amount(item, 1)}`,
      detail: item.lots.some((l) => l.frozenOn === today) ? 'Into today’s pack' : 'New pack dated today',
    };
  }
  const q = Math.min(1, have);
  const left = have - q;
  return {
    actions: [{ kind: 'remove', item_id: item.id, quantity: q }],
    text: `Removed ${amount(item, q)}`,
    detail: left > 0 ? `From the oldest pack (added ${shortDate(item.lots[0].frozenOn, today)}) · ${formatNumber(left)} left` : 'That was the last one',
  };
}

/** A pack's own stepper changes only that pack. */
export function stepLot(item: InventoryItem, lot: Lot, next: number, today: string): Change {
  const when = shortDate(lot.frozenOn, today);
  if (next > lot.quantity) {
    return { actions: [{ kind: 'add', item_id: item.id, lot_id: lot.id, quantity: 1 }], text: `Added ${amount(item, 1)}`, detail: `To the pack added ${when}` };
  }
  const q = Math.min(1, lot.quantity);
  return {
    actions: [{ kind: 'remove', item_id: item.id, lot_id: lot.id, quantity: q }],
    text: `Removed ${amount(item, q)}`,
    detail: lot.quantity - q > 0 ? `From the pack added ${when}` : `The pack added ${when} is gone`,
  };
}

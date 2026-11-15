export const CATEGORIES = [
  { id: 'meat', label: 'Meat', months: 6 },
  { id: 'poultry', label: 'Poultry', months: 9 },
  { id: 'seafood', label: 'Seafood', months: 6 },
  { id: 'frozen_meals', label: 'Frozen meals', months: 3 },
  { id: 'vegetables', label: 'Vegetables', months: 8 },
  { id: 'fruit', label: 'Fruit', months: 8 },
  { id: 'baked_goods', label: 'Bread & baked', months: 3 },
  { id: 'desserts', label: 'Desserts', months: 2 },
  { id: 'other', label: 'Other', months: 6 },
] as const;
export type Category = (typeof CATEGORIES)[number]['id'];

export const UNITS = [
  { id: 'item', one: '', many: '' },
  { id: 'pack', one: 'pack', many: 'packs' },
  { id: 'bag', one: 'bag', many: 'bags' },
  { id: 'box', one: 'box', many: 'boxes' },
  { id: 'container', one: 'container', many: 'containers' },
  { id: 'tray', one: 'tray', many: 'trays' },
  { id: 'roll', one: 'roll', many: 'rolls' },
  { id: 'piece', one: 'piece', many: 'pieces' },
  { id: 'lb', one: 'lb', many: 'lb' },
  { id: 'oz', one: 'oz', many: 'oz' },
  { id: 'kg', one: 'kg', many: 'kg' },
  { id: 'g', one: 'g', many: 'g' },
] as const;
export type Unit = (typeof UNITS)[number]['id'];

export type Freshness = 'fresh' | 'soon' | 'expired';
export type Source = 'voice' | 'manual' | 'photo';

/** One pack: what went into the freezer on one day. */
export type Lot = { id: string; quantity: number; frozenOn: string; source: Source };

export type InventoryItem = {
  id: string;
  freezerId: string;
  name: string;
  category: Category;
  unit: Unit;
  /** Oldest first. Empty when the item has run out. */
  lots: Lot[];
};

export type AddDraft = {
  kind: 'add';
  name: string;
  quantity: number;
  unit: Unit;
  category: Category;
  frozenOn: string;
};

export type RemoveDraft = {
  kind: 'remove';
  heard: string;
  itemId: string | null;
  lotId: string | null;
  quantity: number;
  /** Other items that fit what was heard about as well, best first. */
  choices: string[];
};

export type Draft = AddDraft | RemoveDraft;

export const total = (item: InventoryItem) => item.lots.reduce((n, l) => n + l.quantity, 0);

export function categoryOf(id: Category) {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}

export function initials(label: string): string {
  return label
    .replace(/&/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

const DAY = 86_400_000;
const parse = (iso: string) => new Date(`${iso}T12:00:00`);
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function localToday(now = new Date()): string {
  return iso(now);
}

export function bestBy(category: Category, frozenOn: string): string {
  const d = parse(frozenOn);
  d.setMonth(d.getMonth() + categoryOf(category).months);
  return iso(d);
}

export function freshness(category: Category, frozenOn: string, today: string): Freshness {
  const start = parse(frozenOn).getTime();
  const life = parse(bestBy(category, frozenOn)).getTime() - start;
  const used = (parse(today).getTime() - start) / life;
  return used > 1 ? 'expired' : used >= 0.75 ? 'soon' : 'fresh';
}

export function daysSince(frozenOn: string, today: string): number {
  return Math.round((parse(today).getTime() - parse(frozenOn).getTime()) / DAY);
}

export const FRESHNESS_LABEL: Record<Freshness, string> = { fresh: 'Fresh', soon: 'Use soon', expired: 'Past best' };

export function unitWord(quantity: number, unit: Unit): string {
  const u = UNITS.find((x) => x.id === unit)!;
  return quantity === 1 ? u.one : u.many;
}

export function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

export function formatAmount(quantity: number, unit: Unit): string {
  const word = unitWord(quantity, unit);
  return word ? `${formatNumber(quantity)} ${word}` : formatNumber(quantity);
}

/** "Sep 12", or "Sep 12, 2025" outside the current year. */
export function shortDate(frozenOn: string, today: string, withYear = false): string {
  const d = parse(frozenOn);
  const sameYear = d.getFullYear() === parse(today).getFullYear();
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(withYear || !sameYear ? { year: 'numeric' } : {}) });
}

/** "Added today", "Added yesterday", "Added Sep 12". */
export function addedLabel(frozenOn: string, today: string): string {
  const days = daysSince(frozenOn, today);
  if (days === 0) return 'Added today';
  if (days === 1) return 'Added yesterday';
  return `Added ${shortDate(frozenOn, today)}`;
}

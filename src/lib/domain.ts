export const CATEGORIES = [
  { id: 'meat', label: 'Meat' },
  { id: 'poultry', label: 'Poultry' },
  { id: 'seafood', label: 'Seafood' },
  { id: 'frozen_meals', label: 'Frozen meals' },
  { id: 'vegetables', label: 'Vegetables' },
  { id: 'fruit', label: 'Fruit' },
  { id: 'baked_goods', label: 'Bread & baked' },
  { id: 'desserts', label: 'Desserts' },
  { id: 'other', label: 'Other' },
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

export type InventoryItem = {
  id: string;
  freezerId: string;
  name: string;
  category: Category;
  unit: Unit;
  quantity: number;
  oldestFrozenOn: string | null;
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
  quantity: number;
  ambiguous: boolean;
};

export type Draft = AddDraft | RemoveDraft;

export function categoryLabel(id: Category): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? 'Other';
}

export function formatAmount(quantity: number, unit: Unit): string {
  const u = UNITS.find((x) => x.id === unit)!;
  const n = Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  const word = quantity === 1 ? u.one : u.many;
  return word ? `${n} ${word}` : n;
}

export function localToday(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

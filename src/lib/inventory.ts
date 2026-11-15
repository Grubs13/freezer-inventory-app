import type { SupabaseClient } from '@supabase/supabase-js';
import type { Category, Draft, InventoryItem, Lot, Source, Unit } from './domain';

type ItemRow = { id: string; freezer_id: string; name: string; category: Category; unit: Unit };
type LotRow = { id: string; item_id: string; quantity: number | string; frozen_on: string; source: Source };

export async function loadInventory(supabase: SupabaseClient, householdId: string): Promise<InventoryItem[]> {
  const [items, lots] = await Promise.all([
    supabase.from('items').select('id, freezer_id, name, category, unit').eq('household_id', householdId).order('name'),
    supabase.from('lots').select('id, item_id, quantity, frozen_on, source').eq('household_id', householdId).order('frozen_on').order('created_at'),
  ]);
  if (items.error) throw new Error(items.error.message);
  if (lots.error) throw new Error(lots.error.message);

  const byItem = new Map<string, Lot[]>();
  for (const l of lots.data as LotRow[]) {
    const list = byItem.get(l.item_id) ?? [];
    list.push({ id: l.id, quantity: Number(l.quantity), frozenOn: l.frozen_on, source: l.source });
    byItem.set(l.item_id, list);
  }
  return (items.data as ItemRow[]).map((r) => ({
    id: r.id,
    freezerId: r.freezer_id,
    name: r.name,
    category: r.category,
    unit: r.unit,
    lots: byItem.get(r.id) ?? [],
  }));
}

/** The JSON shape apply_actions accepts. Undo results come back in the same shape. */
export type Action =
  | { kind: 'add'; name?: string; category?: Category; unit?: Unit; item_id?: string; lot_id?: string; quantity: number; frozen_on?: string }
  | { kind: 'remove'; item_id: string; lot_id?: string; quantity: number };

export type Applied = { error: string } | { error: null; undo: Action[] };

export function toActions(drafts: Draft[]): Action[] {
  return drafts.map((d) =>
    d.kind === 'add'
      ? { kind: 'add', name: d.name.trim(), category: d.category, unit: d.unit, quantity: d.quantity, frozen_on: d.frozenOn }
      : { kind: 'remove', item_id: d.itemId!, quantity: d.quantity, ...(d.lotId ? { lot_id: d.lotId } : {}) },
  );
}

export async function apply(supabase: SupabaseClient, freezerId: string, actions: Action[], source: Source): Promise<Applied> {
  const { data, error } = await supabase.rpc('apply_actions', { p_freezer_id: freezerId, p_actions: actions, p_source: source });
  return error ? { error: error.message } : { error: null, undo: data as Action[] };
}

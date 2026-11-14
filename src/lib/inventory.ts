import type { SupabaseClient } from '@supabase/supabase-js';
import type { Category, Draft, InventoryItem, Unit } from './domain';

type InventoryRow = {
  id: string;
  freezer_id: string;
  name: string;
  category: Category;
  unit: Unit;
  quantity: number | string;
  oldest_frozen_on: string | null;
};

export async function loadInventory(supabase: SupabaseClient, householdId: string): Promise<InventoryItem[]> {
  const { data, error } = await supabase
    .from('inventory')
    .select('id, freezer_id, name, category, unit, quantity, oldest_frozen_on')
    .eq('household_id', householdId)
    .order('name');
  if (error) throw new Error(error.message);
  return (data as InventoryRow[]).map((r) => ({
    id: r.id,
    freezerId: r.freezer_id,
    name: r.name,
    category: r.category,
    unit: r.unit,
    quantity: Number(r.quantity),
    oldestFrozenOn: r.oldest_frozen_on,
  }));
}

export async function saveDrafts(
  supabase: SupabaseClient,
  freezerId: string,
  drafts: Draft[],
  source: 'voice' | 'manual',
): Promise<string | null> {
  const actions = drafts.map((d) =>
    d.kind === 'add'
      ? { kind: 'add', name: d.name.trim(), category: d.category, unit: d.unit, quantity: d.quantity, frozen_on: d.frozenOn }
      : { kind: 'remove', item_id: d.itemId, quantity: d.quantity },
  );
  const { error } = await supabase.rpc('apply_actions', { p_freezer_id: freezerId, p_actions: actions, p_source: source });
  return error ? error.message : null;
}

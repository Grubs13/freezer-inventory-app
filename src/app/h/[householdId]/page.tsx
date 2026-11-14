import { notFound } from 'next/navigation';
import { FreezerView } from './FreezerView';
import { loadInventory } from '@/lib/inventory';
import { requireUser } from '@/lib/supabase/server';

export default async function HouseholdPage({ params }: { params: Promise<{ householdId: string }> }) {
  const { householdId } = await params;
  const { supabase } = await requireUser();
  const [{ data: household }, { data: freezers }, items] = await Promise.all([
    supabase.from('households').select('id, name').eq('id', householdId).maybeSingle(),
    supabase.from('freezers').select('id, name').eq('household_id', householdId).order('created_at'),
    loadInventory(supabase, householdId),
  ]);
  if (!household || !freezers?.length) notFound();

  return <FreezerView household={household} freezers={freezers} initialItems={items} />;
}

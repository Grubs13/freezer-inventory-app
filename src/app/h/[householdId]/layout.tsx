import { notFound } from 'next/navigation';
import { HouseholdShell } from './HouseholdShell';
import { loadInventory } from '@/lib/inventory';
import { requireUser } from '@/lib/supabase/server';

export default async function HouseholdLayout({ params, children }: { params: Promise<{ householdId: string }>; children: React.ReactNode }) {
  const { householdId } = await params;
  const { supabase } = await requireUser();
  const [{ data: household }, { data: freezers }] = await Promise.all([
    supabase.from('households').select('id, name').eq('id', householdId).maybeSingle(),
    supabase.from('freezers').select('id, name').eq('household_id', householdId).order('created_at'),
  ]);
  if (!household || !freezers?.length) notFound();
  const items = await loadInventory(supabase, householdId);

  return (
    <HouseholdShell key={freezers.map((f) => f.id + f.name).join()} household={household} freezers={freezers} initialItems={items}>
      {children}
    </HouseholdShell>
  );
}

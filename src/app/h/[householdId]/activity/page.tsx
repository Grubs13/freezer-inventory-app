import Link from 'next/link';
import { formatAmount, type Unit } from '@/lib/domain';
import { requireUser } from '@/lib/supabase/server';

type Row = { id: number; delta: number; source: string; user_id: string; created_at: string; items: { name: string; unit: Unit } | null };

export default async function ActivityPage({ params }: { params: Promise<{ householdId: string }> }) {
  const { householdId } = await params;
  const { supabase, user } = await requireUser();
  const [{ data: rows }, { data: members }] = await Promise.all([
    supabase
      .from('movements')
      .select('id, delta, source, user_id, created_at, items(name, unit)')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false })
      .limit(100)
      .returns<Row[]>(),
    supabase.from('memberships').select('user_id, email').eq('household_id', householdId),
  ]);
  const who = new Map(members?.map((m) => [m.user_id, m.user_id === user.id ? 'You' : m.email.split('@')[0]]));

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-4 px-4 py-6">
      <Link href={`/h/${householdId}`} className="font-medium text-accent">‹ Back</Link>
      <h1 className="text-2xl font-semibold">Activity</h1>
      {!rows?.length && <p className="text-muted">Nothing yet.</p>}
      <ul className="card divide-y divide-line">
        {rows?.map((r) => {
          const n = Number(r.delta);
          return (
            <li key={r.id} className="flex items-baseline gap-3 px-4 py-3">
              <span className={`w-6 shrink-0 text-center font-bold ${n > 0 ? 'text-ok' : 'text-danger'}`}>{n > 0 ? '+' : '−'}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate">
                  {formatAmount(Math.abs(n), r.items?.unit ?? 'item')} {r.items?.name ?? 'Deleted item'}
                </p>
                <p className="text-muted text-sm">
                  {who.get(r.user_id) ?? 'Former member'} · {new Date(r.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                  {r.source === 'voice' ? ' · by voice' : ''}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}

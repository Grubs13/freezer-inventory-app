import { Icon } from '@/components/frostbox/ui';
import { formatNumber, unitWord, type Unit } from '@/lib/domain';
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
    <>
      <header className="screenhead">
        <div>
          <div className="t-overline muted">Everyone in the household</div>
          <h1 className="t-title screenhead__title">Activity</h1>
        </div>
      </header>
      {!rows?.length ? (
        <div className="empty"><p className="muted">Nothing yet. Changes show up here as people add and take out food.</p></div>
      ) : (
        <ul className="fb-history" style={{ maxWidth: 720 }}>
          {rows.map((r) => {
            const n = Number(r.delta);
            const word = r.items ? unitWord(Math.abs(n), r.items.unit) : '';
            return (
              <li key={r.id}>
                <Icon name={n > 0 ? 'plus' : 'minus'} size={16} />
                <div>
                  {n > 0 ? 'Added' : 'Removed'} {formatNumber(Math.abs(n))}{word ? ` ${word}` : ''} · {r.items?.name ?? 'Deleted item'}
                  <time dateTime={r.created_at}>
                    {who.get(r.user_id) ?? 'Former member'} · {new Date(r.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    {r.source === 'voice' ? ' · by voice' : ''}
                  </time>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

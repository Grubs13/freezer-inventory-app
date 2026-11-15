import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createHousehold, signOut } from './actions';
import { Icon, Mark } from '@/components/frostbox/ui';
import { requireUser } from '@/lib/supabase/server';

export default async function Home({ searchParams }: { searchParams: Promise<{ all?: string; error?: string }> }) {
  const { all, error } = await searchParams;
  const { supabase, user } = await requireUser();
  await supabase.rpc('accept_my_invites');
  const { data: households } = await supabase.from('households').select('id, name').order('created_at');
  const list = households ?? [];
  if (list.length === 1 && !all) redirect(`/h/${list[0].id}`);

  return (
    <main className="page stack" style={{ gap: 'var(--space-6)' }}>
      <header className="screenhead" style={{ paddingBottom: 0 }}>
        <div className="auth__brand"><Mark size={36} />Frostbox</div>
        <form action={signOut}><button className="fb-btn fb-btn--ghost fb-btn--sm">Sign out</button></form>
      </header>
      <div>
        <h1 className="t-title">Households</h1>
        <p className="muted t-label" style={{ fontWeight: 400 }}>Signed in as {user.email}</p>
      </div>

      {list.length > 0 && (
        <nav className="fb-list" aria-label="Your households">
          {list.map((h) => (
            <Link key={h.id} href={`/h/${h.id}`} className="linkrow">
              {h.name}<Icon name="chevronRight" size={16} />
            </Link>
          ))}
        </nav>
      )}

      <form action={createHousehold} className="card stack">
        <h2 className="t-heading">{list.length ? 'Create another household' : 'Create your household'}</h2>
        {list.length === 0 && <p className="muted">You’ll be its owner and can invite people from Settings.</p>}
        <label className="field"><span>Household name</span>
          <input name="name" required maxLength={80} placeholder="Home" className="input" />
        </label>
        <label className="field"><span>First freezer</span>
          <input name="freezer" maxLength={60} placeholder="Deep freeze" className="input" />
        </label>
        <button className="fb-btn fb-btn--primary fb-btn--lg fb-btn--block">Create household</button>
        {error && <p role="alert" className="notice notice--error">{error}</p>}
      </form>
    </main>
  );
}

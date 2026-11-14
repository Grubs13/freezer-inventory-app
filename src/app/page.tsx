import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createHousehold, signOut } from './actions';
import { requireUser } from '@/lib/supabase/server';

export default async function Home({ searchParams }: { searchParams: Promise<{ all?: string; error?: string }> }) {
  const { all, error } = await searchParams;
  const { supabase, user } = await requireUser();
  await supabase.rpc('accept_my_invites');
  const { data: households } = await supabase.from('households').select('id, name').order('created_at');
  const list = households ?? [];
  if (list.length === 1 && !all) redirect(`/h/${list[0].id}`);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your households</h1>
        <form action={signOut}>
          <button className="text-muted text-sm underline">Sign out</button>
        </form>
      </header>
      <p className="text-muted -mt-4 text-sm">Signed in as {user.email}</p>

      {list.length > 0 && (
        <ul className="card divide-y divide-line">
          {list.map((h) => (
            <li key={h.id}>
              <Link href={`/h/${h.id}`} className="flex items-center justify-between px-4 py-4 text-lg font-medium">
                {h.name} <span aria-hidden className="text-muted">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <form action={createHousehold} className="card flex flex-col gap-3 p-4">
        <h2 className="font-semibold">{list.length ? 'Create another household' : 'Create your household'}</h2>
        {list.length === 0 && (
          <p className="text-muted text-sm">You will be its owner, and you can invite others from its settings.</p>
        )}
        <label className="text-sm font-medium" htmlFor="name">Household name</label>
        <input id="name" name="name" required maxLength={80} placeholder="Home" className="field" />
        <label className="text-sm font-medium" htmlFor="freezer">First freezer</label>
        <input id="freezer" name="freezer" maxLength={60} placeholder="Deep freeze" className="field" />
        <button className="btn-primary">Create</button>
        {error && <p role="alert" className="text-danger text-sm">{error}</p>}
      </form>
    </main>
  );
}

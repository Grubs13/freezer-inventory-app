import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  addFreezer, cancelInvite, deleteFreezer, deleteHousehold, inviteMember, removeMember, renameFreezer, renameHousehold, setRole, signOut,
} from '@/app/actions';
import { requireUser } from '@/lib/supabase/server';

type Params = { params: Promise<{ householdId: string }>; searchParams: Promise<{ error?: string; notice?: string }> };

export default async function SettingsPage({ params, searchParams }: Params) {
  const { householdId } = await params;
  const { error, notice } = await searchParams;
  const { supabase, user } = await requireUser();
  const [{ data: household }, { data: freezers }, { data: members }, { data: invites }] = await Promise.all([
    supabase.from('households').select('id, name').eq('id', householdId).maybeSingle(),
    supabase.from('freezers').select('id, name').eq('household_id', householdId).order('created_at'),
    supabase.from('memberships').select('user_id, email, role').eq('household_id', householdId).order('created_at'),
    supabase.from('invites').select('id, email, role').eq('household_id', householdId).order('created_at'),
  ]);
  if (!household) notFound();
  const isOwner = members?.some((m) => m.user_id === user.id && m.role === 'owner') ?? false;
  const hidden = <input type="hidden" name="householdId" value={householdId} />;

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-6 px-4 py-6">
      <header className="flex items-center justify-between">
        <Link href={`/h/${householdId}`} className="font-medium text-accent">‹ Back</Link>
        <form action={signOut}><button className="text-muted text-sm underline">Sign out</button></form>
      </header>
      <h1 className="text-2xl font-semibold">{household.name}</h1>
      {(error || notice) && (
        <p role={error ? 'alert' : 'status'} className={`card p-3 text-sm ${error ? 'text-danger' : 'text-ok'}`}>{error || notice}</p>
      )}

      {isOwner && (
        <Section title="Household">
          <form action={renameHousehold} className="flex gap-2">
            {hidden}
            <input name="name" defaultValue={household.name} required maxLength={80} aria-label="Household name" className="field" />
            <button className="btn">Rename</button>
          </form>
        </Section>
      )}

      <Section title="Freezers">
        <ul className="flex flex-col gap-2">
          {freezers?.map((f) =>
            isOwner ? (
              <li key={f.id} className="flex gap-2">
                <form action={renameFreezer} className="flex flex-1 gap-2">
                  {hidden}
                  <input type="hidden" name="freezerId" value={f.id} />
                  <input name="name" defaultValue={f.name} required maxLength={60} aria-label="Freezer name" className="field" />
                  <button className="btn">Save</button>
                </form>
                {(freezers?.length ?? 0) > 1 && (
                  <details className="relative">
                    <summary className="btn-danger cursor-pointer list-none">Delete</summary>
                    <form action={deleteFreezer} className="card absolute right-0 z-10 mt-2 w-60 p-3 text-sm">
                      {hidden}
                      <input type="hidden" name="freezerId" value={f.id} />
                      <p>Delete {f.name} and everything in it?</p>
                      <button className="btn-danger mt-2 w-full">Yes, delete</button>
                    </form>
                  </details>
                )}
              </li>
            ) : (
              <li key={f.id} className="card px-3 py-2">{f.name}</li>
            ),
          )}
        </ul>
        {isOwner && (
          <form action={addFreezer} className="mt-3 flex gap-2">
            {hidden}
            <input name="name" required maxLength={60} placeholder="Garage freezer" aria-label="New freezer name" className="field" />
            <button className="btn">Add</button>
          </form>
        )}
      </Section>

      <Section title="People">
        <ul className="card divide-y divide-line">
          {members?.map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center gap-2 px-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{m.email}{m.user_id === user.id ? ' (you)' : ''}</p>
                <p className="text-muted text-sm capitalize">{m.role}</p>
              </div>
              {isOwner && m.user_id !== user.id && (
                <>
                  <form action={setRole}>
                    {hidden}
                    <input type="hidden" name="userId" value={m.user_id} />
                    <input type="hidden" name="role" value={m.role === 'owner' ? 'member' : 'owner'} />
                    <button className="btn text-sm">{m.role === 'owner' ? 'Make member' : 'Make owner'}</button>
                  </form>
                  <form action={removeMember}>
                    {hidden}
                    <input type="hidden" name="userId" value={m.user_id} />
                    <button className="btn-danger text-sm">Remove</button>
                  </form>
                </>
              )}
            </li>
          ))}
          {invites?.map((inv) => (
            <li key={inv.id} className="flex items-center gap-2 px-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{inv.email}</p>
                <p className="text-muted text-sm">Invited as {inv.role}, not joined yet</p>
              </div>
              <form action={cancelInvite}>
                {hidden}
                <input type="hidden" name="inviteId" value={inv.id} />
                <button className="btn text-sm">Cancel</button>
              </form>
            </li>
          ))}
        </ul>
        {isOwner && (
          <form action={inviteMember} className="mt-3 flex flex-col gap-2">
            {hidden}
            <label htmlFor="invite-email" className="text-sm font-medium">Invite someone</label>
            <div className="flex gap-2">
              <input id="invite-email" name="email" type="email" required placeholder="name@example.com" className="field" />
              <select name="role" aria-label="Role" className="field w-32">
                <option value="member">Member</option>
                <option value="owner">Owner</option>
              </select>
            </div>
            <button className="btn-primary">Send invite</button>
            <p className="text-muted text-xs">Members add and take out food. Owners also manage freezers and people.</p>
          </form>
        )}
      </Section>

      <Section title="Danger zone">
        <form action={removeMember}>
          {hidden}
          <input type="hidden" name="userId" value={user.id} />
          <button className="btn-danger w-full">Leave this household</button>
        </form>
        {isOwner && (
          <form action={deleteHousehold} className="mt-3 flex gap-2">
            {hidden}
            <input name="confirm" placeholder="Type DELETE" aria-label="Type DELETE to confirm" className="field" />
            <button className="btn-danger shrink-0">Delete household</button>
          </form>
        )}
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-muted mb-2 text-xs font-semibold tracking-wider uppercase">{title}</h2>
      {children}
    </section>
  );
}

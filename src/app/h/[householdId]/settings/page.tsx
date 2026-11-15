import { notFound } from 'next/navigation';
import {
  addFreezer, cancelInvite, deleteFreezer, deleteHousehold, inviteMember, removeMember, renameFreezer, renameHousehold, setRole, signOut,
} from '@/app/actions';
import { ThemeSwitch } from '@/components/frostbox/ThemeSwitch';
import { requireUser } from '@/lib/supabase/server';

type Params = { params: Promise<{ householdId: string }>; searchParams: Promise<{ error?: string; notice?: string }> };

const btn = (variant: 'primary' | 'secondary' | 'danger' | 'ghost', size: 'sm' | 'md' | 'lg' = 'md', block = false) =>
  `fb-btn fb-btn--${variant} fb-btn--${size}${block ? ' fb-btn--block' : ''}`;

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
    <div className="stack" style={{ gap: 'var(--space-6)', maxWidth: 640 }}>
      <header className="screenhead" style={{ paddingBottom: 0 }}>
        <div>
          <div className="t-overline muted">{household.name}</div>
          <h1 className="t-title screenhead__title">Settings</h1>
        </div>
        <form action={signOut}><button className={btn('ghost', 'sm')}>Sign out</button></form>
      </header>
      {(error || notice) && <p role={error ? 'alert' : 'status'} className={`notice ${error ? 'notice--error' : 'notice--ok'}`}>{error || notice}</p>}

      <Section title="Appearance">
        <div className="card row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <span>Theme</span>
          <ThemeSwitch />
        </div>
      </Section>

      {isOwner && (
        <Section title="Household">
          <form action={renameHousehold} className="card row">
            {hidden}
            <input name="name" defaultValue={household.name} required maxLength={80} aria-label="Household name" className="input" />
            <button className={btn('secondary', 'lg')}>Rename</button>
          </form>
        </Section>
      )}

      <Section title="Freezers">
        <div className="card stack">
          {freezers?.map((f) =>
            isOwner ? (
              <div key={f.id} className="row">
                <form action={renameFreezer} className="row" style={{ flex: 1 }}>
                  {hidden}
                  <input type="hidden" name="freezerId" value={f.id} />
                  <input name="name" defaultValue={f.name} required maxLength={60} aria-label={`Name of ${f.name}`} className="input" />
                  <button className={btn('secondary', 'lg')}>Save</button>
                </form>
                {(freezers?.length ?? 0) > 1 && (
                  <details>
                    <summary className={btn('danger', 'lg')}>Delete</summary>
                    <form action={deleteFreezer} className="card stack" style={{ position: 'absolute', right: 16, zIndex: 5, width: 260, boxShadow: 'var(--shadow-md)' }}>
                      {hidden}
                      <input type="hidden" name="freezerId" value={f.id} />
                      <p>Delete {f.name} and everything in it?</p>
                      <button className={btn('danger', 'md', true)}>Delete freezer</button>
                    </form>
                  </details>
                )}
              </div>
            ) : (
              <div key={f.id}>{f.name}</div>
            ),
          )}
          {isOwner && (
            <form action={addFreezer} className="row">
              {hidden}
              <input name="name" required maxLength={60} placeholder="Garage freezer" aria-label="New freezer name" className="input" />
              <button className={btn('secondary', 'lg')}>Add freezer</button>
            </form>
          )}
        </div>
      </Section>

      <Section title="People">
        <ul className="people fb-list">
          {members?.map((m) => (
            <li key={m.user_id}>
              <div className="people__who"><b>{m.email}{m.user_id === user.id ? ' (you)' : ''}</b><span>{m.role === 'owner' ? 'Owner' : 'Member'}</span></div>
              {isOwner && m.user_id !== user.id && (
                <>
                  <form action={setRole}>
                    {hidden}
                    <input type="hidden" name="userId" value={m.user_id} />
                    <input type="hidden" name="role" value={m.role === 'owner' ? 'member' : 'owner'} />
                    <button className={btn('secondary', 'sm')}>{m.role === 'owner' ? 'Make member' : 'Make owner'}</button>
                  </form>
                  <form action={removeMember}>
                    {hidden}
                    <input type="hidden" name="userId" value={m.user_id} />
                    <button className={btn('danger', 'sm')}>Remove</button>
                  </form>
                </>
              )}
            </li>
          ))}
          {invites?.map((inv) => (
            <li key={inv.id}>
              <div className="people__who"><b>{inv.email}</b><span>Invited as {inv.role}, hasn’t joined yet</span></div>
              <form action={cancelInvite}>
                {hidden}
                <input type="hidden" name="inviteId" value={inv.id} />
                <button className={btn('secondary', 'sm')}>Cancel invite</button>
              </form>
            </li>
          ))}
        </ul>
        {isOwner && (
          <form action={inviteMember} className="card stack" style={{ marginTop: 'var(--space-3)' }}>
            {hidden}
            <div className="row" style={{ alignItems: 'flex-end' }}>
              <label className="field"><span>Invite someone</span>
                <input name="email" type="email" required placeholder="name@example.com" className="input" />
              </label>
              <label className="field" style={{ flex: 'none', width: 120 }}><span>Role</span>
                <select name="role" className="input"><option value="member">Member</option><option value="owner">Owner</option></select>
              </label>
            </div>
            <button className={btn('primary', 'lg', true)}>Send invite</button>
            <p className="muted t-caption">Members add and take out food. Owners also manage freezers and people.</p>
          </form>
        )}
      </Section>

      <Section title="Leave or delete">
        <div className="card stack">
          <form action={removeMember}>
            {hidden}
            <input type="hidden" name="userId" value={user.id} />
            <button className={btn('danger', 'lg', true)}>Leave this household</button>
          </form>
          {isOwner && (
            <form action={deleteHousehold} className="row">
              {hidden}
              <input name="confirm" placeholder="Type DELETE" aria-label="Type DELETE to confirm" className="input" />
              <button className={btn('danger', 'lg')}>Delete household</button>
            </form>
          )}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="t-overline muted" style={{ marginBottom: 'var(--space-2)' }}>{title}</h2>
      {children}
    </section>
  );
}

'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireUser, supabaseAdmin } from '@/lib/supabase/server';

const text = (form: FormData, key: string) => String(form.get(key) ?? '').trim();

function back(householdId: string, result: { error?: string; notice?: string }): never {
  const params = new URLSearchParams(result.error ? { error: result.error } : { notice: result.notice ?? '' });
  revalidatePath(`/h/${householdId}`, 'layout');
  redirect(`/h/${householdId}/settings?${params}`);
}

export async function createHousehold(form: FormData) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc('create_household', {
    p_name: text(form, 'name') || 'Home',
    p_freezer_name: text(form, 'freezer') || 'Deep freeze',
  });
  if (error) redirect(`/?error=${encodeURIComponent(error.message)}`);
  redirect(`/h/${data}`);
}

export async function renameHousehold(form: FormData) {
  const { supabase } = await requireUser();
  const id = text(form, 'householdId');
  const { error } = await supabase.from('households').update({ name: text(form, 'name') }).eq('id', id);
  back(id, error ? { error: error.message } : { notice: 'Household renamed.' });
}

export async function addFreezer(form: FormData) {
  const { supabase } = await requireUser();
  const id = text(form, 'householdId');
  const { error } = await supabase.from('freezers').insert({ household_id: id, name: text(form, 'name') });
  back(id, error ? { error: error.message } : { notice: 'Freezer added.' });
}

export async function renameFreezer(form: FormData) {
  const { supabase } = await requireUser();
  const id = text(form, 'householdId');
  const { error } = await supabase.from('freezers').update({ name: text(form, 'name') }).eq('id', text(form, 'freezerId'));
  back(id, error ? { error: error.message } : { notice: 'Freezer renamed.' });
}

export async function deleteFreezer(form: FormData) {
  const { supabase } = await requireUser();
  const id = text(form, 'householdId');
  const { count } = await supabase.from('freezers').select('id', { count: 'exact', head: true }).eq('household_id', id);
  if ((count ?? 0) <= 1) back(id, { error: 'A household needs at least one freezer.' });
  const { error } = await supabase.from('freezers').delete().eq('id', text(form, 'freezerId'));
  back(id, error ? { error: error.message } : { notice: 'Freezer deleted.' });
}

export async function inviteMember(form: FormData) {
  const { supabase } = await requireUser();
  const id = text(form, 'householdId');
  const email = text(form, 'email').toLowerCase();
  const role = text(form, 'role') === 'owner' ? 'owner' : 'member';
  const { error } = await supabase.from('invites').insert({ household_id: id, email, role });
  if (error) back(id, { error: error.code === '23505' ? 'That email is already invited.' : error.message });

  const h = await headers();
  const origin = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host')}`;
  const { error: mailError } = await supabaseAdmin().auth.admin.inviteUserByEmail(email, { redirectTo: `${origin}/login` });
  if (mailError && mailError.code !== 'email_exists') {
    back(id, { error: `Invite saved, but the email failed to send: ${mailError.message}` });
  }
  back(id, {
    notice: mailError
      ? `${email} already has an account. They will see this household next time they open the app.`
      : `Invite sent to ${email}.`,
  });
}

export async function cancelInvite(form: FormData) {
  const { supabase } = await requireUser();
  const id = text(form, 'householdId');
  const { error } = await supabase.from('invites').delete().eq('id', text(form, 'inviteId'));
  back(id, error ? { error: error.message } : { notice: 'Invite cancelled.' });
}

export async function setRole(form: FormData) {
  const { supabase } = await requireUser();
  const id = text(form, 'householdId');
  const role = text(form, 'role') === 'owner' ? 'owner' : 'member';
  const { error } = await supabase.from('memberships').update({ role }).eq('household_id', id).eq('user_id', text(form, 'userId'));
  back(id, error ? { error: error.message } : { notice: 'Role updated.' });
}

export async function removeMember(form: FormData) {
  const { supabase, user } = await requireUser();
  const id = text(form, 'householdId');
  const userId = text(form, 'userId');
  const { error } = await supabase.from('memberships').delete().eq('household_id', id).eq('user_id', userId);
  if (error) back(id, { error: error.message });
  if (userId === user.id) redirect('/');
  back(id, { notice: 'Removed from the household.' });
}

export async function deleteHousehold(form: FormData) {
  const { supabase } = await requireUser();
  const id = text(form, 'householdId');
  if (text(form, 'confirm').toLowerCase() !== 'delete') back(id, { error: 'Type DELETE to confirm.' });
  const { error } = await supabase.from('households').delete().eq('id', id);
  if (error) back(id, { error: error.message });
  redirect('/?all=1');
}

export async function signOut() {
  const { supabase } = await requireUser();
  await supabase.auth.signOut();
  redirect('/login');
}

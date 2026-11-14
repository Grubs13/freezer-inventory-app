import { createClient } from '@supabase/supabase-js';

const email = process.argv[2];
if (!email) {
  console.error('usage: node --env-file=.env.local scripts/invite.mjs you@example.com');
  process.exit(1);
}
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const { error } = await admin.auth.admin.inviteUserByEmail(email.toLowerCase());
if (error) {
  console.error(error.message);
  process.exit(1);
}
console.log(`Invite sent to ${email}.`);

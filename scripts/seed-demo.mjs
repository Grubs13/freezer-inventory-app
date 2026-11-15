import { createClient } from '@supabase/supabase-js';

const email = process.argv[2] ?? 'demo@frostbox.test';
const url = process.env.SUPABASE_INTERNAL_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const user = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });

const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const add = (name, category, unit, quantity, ago) => ({ kind: 'add', name, category, unit, quantity, frozen_on: daysAgo(ago) });

const created = await admin.auth.admin.createUser({ email, email_confirm: true });
if (created.error && created.error.code !== 'email_exists') throw created.error;

const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
if (link.error) throw link.error;
const session = await user.auth.verifyOtp({ type: 'magiclink', token_hash: link.data.properties.hashed_token });
if (session.error) throw session.error;

const existing = await user.from('households').select('id').eq('name', 'Demo home');
if (existing.data?.length) {
  console.log(`${email} already has a Demo home`);
  process.exit(0);
}

const { data: householdId, error } = await user.rpc('create_household', { p_name: 'Demo home', p_freezer_name: 'Deep freeze' });
if (error) throw error;
const { data: deep } = await user.from('freezers').select('id').eq('household_id', householdId).single();
const { data: garage } = await user.from('freezers').insert({ household_id: householdId, name: 'Garage freezer' }).select('id').single();

const run = async (freezer, actions, source = 'manual') => {
  const { error: e } = await user.rpc('apply_actions', { p_freezer_id: freezer, p_actions: actions, p_source: source });
  if (e) throw e;
};

await run(deep.id, [
  add('Chicken thighs', 'poultry', 'pack', 1, 70),
  add('Chicken thighs', 'poultry', 'pack', 1, 30),
  add('Ground beef', 'meat', 'lb', 2, 60),
  add('Ground beef', 'meat', 'lb', 2, 15),
  add('Ground turkey', 'poultry', 'pack', 2, 240),
  add('Ground pork', 'meat', 'pack', 1, 20),
  add('Lasagna (homemade)', 'frozen_meals', 'tray', 1, 110),
  add('Sourdough loaf', 'baked_goods', 'item', 2, 75),
  add('Blueberries', 'fruit', 'bag', 2, 200),
  add('Peas', 'vegetables', 'bag', 3, 40),
  add('Salmon fillets', 'seafood', 'pack', 4, 25),
]);
await run(deep.id, [
  add('Chicken thighs', 'poultry', 'pack', 1, 5),
  add('Frozen pizza', 'frozen_meals', 'item', 3, 10),
  add('Vanilla ice cream', 'desserts', 'container', 1, 12),
], 'voice');
await run(garage.id, [add('Venison', 'meat', 'lb', 5, 150), add('Sweet corn', 'vegetables', 'bag', 2, 90)]);

console.log(`Seeded Demo home for ${email}`);

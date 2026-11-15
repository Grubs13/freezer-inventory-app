begin;
create extension if not exists pgtap with schema extensions;
select plan(34);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test.dev'),
  ('00000000-0000-0000-0000-00000000000b', 'member@test.dev'),
  ('00000000-0000-0000-0000-00000000000c', 'stranger@test.dev');

create function pg_temp.act_as(uid uuid, email text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'email', email, 'role', 'authenticated')::text, true);
$$;

create temp table ctx (key text primary key, id uuid);
grant all on ctx to authenticated;

set local role authenticated;

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'owner@test.dev');
insert into ctx values ('home', public.create_household('Home'));
insert into ctx select 'home_freezer', id from public.freezers where household_id = (select id from ctx where key = 'home');
insert into public.invites (household_id, email) select id, 'member@test.dev' from ctx where key = 'home';

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c', 'stranger@test.dev');
insert into ctx values ('other', public.create_household('Friend house'));

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'member@test.dev');
select is(public.accept_my_invites(), 1, 'invited member joins on sign-in');
select is((select role::text from public.memberships where user_id = auth.uid()), 'member', 'invite grants the member role');
select is((select count(*)::int from public.households), 1, 'member sees only the household they joined');

select lives_ok($$
  select public.apply_actions((select id from ctx where key = 'home_freezer'),
    '[{"kind":"add","name":"Ground turkey","category":"poultry","unit":"pack","quantity":2,"frozen_on":"2026-01-01"},
      {"kind":"add","name":"Frozen pizza","category":"frozen_meals","unit":"item","quantity":1}]', 'voice')
$$, 'member can add food');
select lives_ok($$
  select public.apply_actions((select id from ctx where key = 'home_freezer'),
    '[{"kind":"add","name":"  ground   TURKEY ","category":"poultry","unit":"pack","quantity":3,"frozen_on":"2026-03-01"}]')
$$, 'adding the same food again with different spacing and case');
select is((select count(*)::int from public.items where name_key = 'ground turkey'), 1, 'same name and unit reuses one item');
select is((select sum(quantity) from public.lots l join public.items i on i.id = l.item_id where i.name = 'Ground turkey'), 5.00::numeric, 'packs on different days stay separate and add up');
select lives_ok($$
  select public.apply_actions((select id from ctx where key = 'home_freezer'),
    '[{"kind":"add","name":"Ground turkey","category":"poultry","unit":"pack","quantity":1,"frozen_on":"2026-03-01"}]')
$$, 'adding on a day that already has a pack');
select is((select count(*)::int from public.lots l join public.items i on i.id = l.item_id where i.name = 'Ground turkey'), 2, 'same-day adds go into that day''s pack');
select lives_ok($$
  select public.apply_actions((select id from ctx where key = 'home_freezer'),
    (select jsonb_build_array(jsonb_build_object('kind','remove','item_id',i.id,'lot_id',l.id,'quantity',1))
     from public.lots l join public.items i on i.id = l.item_id where i.name = 'Ground turkey' and l.frozen_on = '2026-03-01'))
$$, 'member can take from one specific pack');
select results_eq(
  $$ select quantity, frozen_on from public.lots l join public.items i on i.id = l.item_id where i.name = 'Ground turkey' order by frozen_on $$,
  $$ values (2.00::numeric(10,2), '2026-01-01'::date), (3.00::numeric(10,2), '2026-03-01'::date) $$,
  'a targeted removal leaves the other packs alone');

create temp table undo_actions as
  select public.apply_actions((select id from ctx where key = 'home_freezer'),
    (select jsonb_build_array(jsonb_build_object('kind','remove','item_id',id,'quantity',3)) from public.items where name = 'Ground turkey'), 'voice') as actions;
select results_eq(
  $$ select quantity, frozen_on from public.lots l join public.items i on i.id = l.item_id where i.name = 'Ground turkey' $$,
  $$ values (2.00::numeric(10,2), '2026-03-01'::date) $$,
  'removal takes the oldest pack first');
select is((select jsonb_array_length(actions) from undo_actions), 2, 'undo lists one restore per pack touched');
select lives_ok($$ select public.apply_actions((select id from ctx where key = 'home_freezer'), (select actions from undo_actions)) $$, 'undo can be applied');
select results_eq(
  $$ select quantity, frozen_on from public.lots l join public.items i on i.id = l.item_id where i.name = 'Ground turkey' order by frozen_on $$,
  $$ values (2.00::numeric(10,2), '2026-01-01'::date), (3.00::numeric(10,2), '2026-03-01'::date) $$,
  'undo puts food back into the packs it came from');
select lives_ok($$
  select public.apply_actions((select id from ctx where key = 'home_freezer'),
    (select jsonb_build_array(jsonb_build_object('kind','remove','item_id',id,'quantity',3)) from public.items where name = 'Ground turkey'))
$$, 'remove again after undo');
select throws_ok($$
  select public.apply_actions((select id from ctx where key = 'home_freezer'),
    (select jsonb_build_array(jsonb_build_object('kind','remove','item_id',id,'quantity',5)) from public.items where name = 'Ground turkey'))
$$, 'P0001', 'Only 2.00 left of that item', 'cannot remove more than is in the freezer');
select is((select count(*)::int from public.movements), 9, 'each add, remove and undo is logged');

select throws_ok($$ insert into public.freezers (household_id, name) select id, 'Garage' from ctx where key = 'home' $$,
  '42501', null, 'members cannot add freezers');
select throws_ok($$ insert into public.invites (household_id, email) select id, 'x@test.dev' from ctx where key = 'home' $$,
  '42501', null, 'members cannot invite people');
update public.memberships set role = 'owner' where user_id = auth.uid();
select is((select role::text from public.memberships where user_id = auth.uid()), 'member', 'members cannot promote themselves');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c', 'stranger@test.dev');
select is((select count(*)::int from public.households), 1, 'stranger sees only their own household');
select is((select count(*)::int from public.freezers where household_id = (select id from ctx where key = 'home')), 0, 'stranger cannot see the other freezers');
select is((select count(*)::int from public.lots where household_id = (select id from ctx where key = 'home')), 0, 'stranger cannot see the other packs');
select is((select count(*)::int from public.movements), 0, 'stranger cannot see the other activity');
select is((select count(*)::int from public.memberships where household_id = (select id from ctx where key = 'home')), 0, 'stranger cannot see the other members');
select throws_ok($$
  select public.apply_actions((select id from ctx where key = 'home_freezer'),
    '[{"kind":"add","name":"Sneaky","quantity":1}]')
$$, 'P0001', 'Freezer not found', 'stranger cannot add to another freezer');
select throws_ok($$
  insert into public.items (household_id, freezer_id, name)
  select (select id from ctx where key = 'other'), id, 'Cross wired' from ctx where key = 'home_freezer'
$$, '23503', null, 'an item cannot point at another household''s freezer');
update public.items set name = 'Hacked';
select is((select count(*)::int from public.items), 0, 'stranger updates touch nothing outside their household');
delete from public.lots;
select is(public.accept_my_invites(), 0, 'stranger has no invites to accept');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'owner@test.dev');
select is((select count(*)::int from public.lots), 2, 'stranger deletes left the other household untouched');
select throws_ok($$ delete from public.memberships where user_id = auth.uid() $$,
  'P0001', 'A household needs at least one owner', 'the last owner cannot leave');
delete from public.memberships where user_id = '00000000-0000-0000-0000-00000000000b';
select is((select count(*)::int from public.memberships), 1, 'owner can remove a member');
delete from public.households where id = (select id from ctx where key = 'home');
select is((select count(*)::int from public.items), 0, 'deleting a household removes everything in it');

select * from finish();
rollback;

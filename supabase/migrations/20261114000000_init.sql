create extension if not exists pg_trgm with schema extensions;

create type public.household_role as enum ('owner', 'member');

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_by uuid not null references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.memberships (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.household_role not null default 'member',
  email text not null,
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index memberships_user_idx on public.memberships (user_id);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and email like '%_@_%'),
  role public.household_role not null default 'member',
  invited_by uuid not null references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  unique (household_id, email)
);
create index invites_email_idx on public.invites (email);

create table public.freezers (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  created_at timestamptz not null default now(),
  unique (id, household_id)
);
create index freezers_household_idx on public.freezers (household_id);

-- household_id is repeated on child tables so every access rule is one membership check.
-- The composite foreign keys make a row pointing into another household's freezer impossible.
create table public.items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  freezer_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  name_key text generated always as (regexp_replace(lower(btrim(name)), '\s+', ' ', 'g')) stored,
  category text not null default 'other' check (category in (
    'meat', 'poultry', 'seafood', 'frozen_meals', 'vegetables', 'fruit', 'baked_goods', 'desserts', 'other'
  )),
  unit text not null default 'item' check (unit in (
    'item', 'pack', 'bag', 'box', 'container', 'tray', 'roll', 'piece', 'lb', 'oz', 'kg', 'g'
  )),
  created_at timestamptz not null default now(),
  unique (id, household_id),
  unique (freezer_id, name_key, unit),
  foreign key (freezer_id, household_id) references public.freezers (id, household_id) on delete cascade
);
create index items_household_idx on public.items (household_id);

create table public.lots (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  item_id uuid not null,
  quantity numeric(10, 2) not null check (quantity > 0),
  frozen_on date not null,
  -- Set by a person to replace the best-by date worked out from the category.
  best_by date check (best_by is null or best_by >= frozen_on),
  source text not null default 'manual' check (source in ('voice', 'manual', 'photo')),
  created_at timestamptz not null default now(),
  unique (item_id, frozen_on),
  foreign key (item_id, household_id) references public.items (id, household_id) on delete cascade
);
create index lots_household_idx on public.lots (household_id);

create table public.movements (
  id bigint generated always as identity primary key,
  household_id uuid not null,
  item_id uuid not null,
  delta numeric(10, 2) not null check (delta <> 0),
  source text not null check (source in ('voice', 'manual', 'photo')),
  user_id uuid not null references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (item_id, household_id) references public.items (id, household_id) on delete cascade
);
create index movements_household_idx on public.movements (household_id, created_at desc);

-- Membership checks run as definer so policies on memberships can call them without recursing.
create function public.is_member(h uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m where m.household_id = h and m.user_id = auth.uid()
  );
$$;

create function public.is_owner(h uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.household_id = h and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;

alter table public.households enable row level security;
alter table public.memberships enable row level security;
alter table public.invites enable row level security;
alter table public.freezers enable row level security;
alter table public.items enable row level security;
alter table public.lots enable row level security;
alter table public.movements enable row level security;

create policy households_select on public.households for select to authenticated using (public.is_member(id));
create policy households_update on public.households for update to authenticated using (public.is_owner(id)) with check (public.is_owner(id));
create policy households_delete on public.households for delete to authenticated using (public.is_owner(id));

create policy memberships_select on public.memberships for select to authenticated using (public.is_member(household_id));
create policy memberships_update on public.memberships for update to authenticated using (public.is_owner(household_id)) with check (public.is_owner(household_id));
create policy memberships_delete on public.memberships for delete to authenticated using (public.is_owner(household_id) or user_id = auth.uid());

create policy invites_select on public.invites for select to authenticated using (public.is_owner(household_id));
create policy invites_insert on public.invites for insert to authenticated with check (public.is_owner(household_id) and invited_by = auth.uid());
create policy invites_delete on public.invites for delete to authenticated using (public.is_owner(household_id));

create policy freezers_select on public.freezers for select to authenticated using (public.is_member(household_id));
create policy freezers_insert on public.freezers for insert to authenticated with check (public.is_owner(household_id));
create policy freezers_update on public.freezers for update to authenticated using (public.is_owner(household_id)) with check (public.is_owner(household_id));
create policy freezers_delete on public.freezers for delete to authenticated using (public.is_owner(household_id));

create policy items_select on public.items for select to authenticated using (public.is_member(household_id));
create policy items_insert on public.items for insert to authenticated with check (public.is_member(household_id));
create policy items_update on public.items for update to authenticated using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy items_delete on public.items for delete to authenticated using (public.is_member(household_id));

create policy lots_select on public.lots for select to authenticated using (public.is_member(household_id));
create policy lots_insert on public.lots for insert to authenticated with check (public.is_member(household_id));
create policy lots_update on public.lots for update to authenticated using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy lots_delete on public.lots for delete to authenticated using (public.is_member(household_id));

create policy movements_select on public.movements for select to authenticated using (public.is_member(household_id));
create policy movements_insert on public.movements for insert to authenticated with check (public.is_member(household_id) and user_id = auth.uid());

create function public.guard_last_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner')
     and exists (select 1 from public.households h where h.id = old.household_id)
     and not exists (
       select 1 from public.memberships m
       where m.household_id = old.household_id and m.role = 'owner' and m.user_id <> old.user_id
     ) then
    raise exception 'A household needs at least one owner';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger memberships_last_owner
before update or delete on public.memberships
for each row execute function public.guard_last_owner();

create function public.create_household(p_name text, p_freezer_name text default 'Deep freeze')
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_household uuid;
  v_email text := auth.jwt() ->> 'email';
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  insert into public.households (name, created_by) values (btrim(p_name), auth.uid()) returning id into v_household;
  insert into public.memberships (household_id, user_id, role, email) values (v_household, auth.uid(), 'owner', coalesce(v_email, ''));
  insert into public.freezers (household_id, name) values (v_household, btrim(p_freezer_name));
  return v_household;
end;
$$;

create function public.accept_my_invites() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(auth.jwt() ->> 'email');
  v_count integer;
begin
  if auth.uid() is null or v_email is null then
    return 0;
  end if;
  insert into public.memberships (household_id, user_id, role, email)
  select i.household_id, auth.uid(), i.role, v_email
  from public.invites i
  where i.email = v_email
  on conflict (household_id, user_id) do nothing;
  delete from public.invites i where i.email = v_email;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Runs as the caller, so every row it touches still passes the policies above.
-- Actions:
--   {"kind":"add", "name","category","unit" | "item_id", "quantity", "frozen_on"?, "best_by"?, "lot_id"?}
--   {"kind":"remove", "item_id", "quantity", "lot_id"?}
-- An add goes into that day's pack; a remove without lot_id takes from the oldest pack first.
-- Returns the actions that undo this call, newest first.
create function public.apply_actions(p_freezer_id uuid, p_actions jsonb, p_source text default 'manual')
returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_household uuid;
  v_action jsonb;
  v_item uuid;
  v_lot_id uuid;
  v_qty numeric(10, 2);
  v_left numeric(10, 2);
  v_have numeric(10, 2);
  v_take numeric(10, 2);
  v_lot record;
  v_undo jsonb := '[]'::jsonb;
begin
  select f.household_id into v_household from public.freezers f where f.id = p_freezer_id;
  if v_household is null then
    raise exception 'Freezer not found';
  end if;
  if jsonb_typeof(p_actions) <> 'array' or jsonb_array_length(p_actions) = 0 then
    raise exception 'Nothing to save';
  end if;

  for v_action in select * from jsonb_array_elements(p_actions) loop
    v_qty := (v_action ->> 'quantity')::numeric;
    if v_qty is null or v_qty <= 0 then
      raise exception 'Quantity must be more than zero';
    end if;
    v_item := null;

    if v_action ? 'item_id' then
      select i.id into v_item from public.items i
      where i.id = (v_action ->> 'item_id')::uuid and i.freezer_id = p_freezer_id;
      if v_item is null then
        raise exception 'That item is not in this freezer';
      end if;
    end if;

    if v_action ->> 'kind' = 'add' then
      if v_item is null then
        insert into public.items (household_id, freezer_id, name, category, unit)
        values (
          v_household, p_freezer_id, btrim(v_action ->> 'name'),
          coalesce(v_action ->> 'category', 'other'), coalesce(v_action ->> 'unit', 'item')
        )
        on conflict (freezer_id, name_key, unit) do update set category = excluded.category
        returning id into v_item;
      end if;

      if v_action ? 'lot_id' then
        update public.lots set quantity = quantity + v_qty
        where id = (v_action ->> 'lot_id')::uuid and item_id = v_item
        returning id into v_lot_id;
        if v_lot_id is null then
          raise exception 'That pack is no longer in the freezer';
        end if;
      else
        insert into public.lots (household_id, item_id, quantity, frozen_on, best_by, source)
        values (v_household, v_item, v_qty, coalesce((v_action ->> 'frozen_on')::date, current_date), (v_action ->> 'best_by')::date, p_source)
        on conflict (item_id, frozen_on) do update
          set quantity = public.lots.quantity + excluded.quantity, best_by = coalesce(excluded.best_by, public.lots.best_by)
        returning id into v_lot_id;
      end if;

      insert into public.movements (household_id, item_id, delta, source) values (v_household, v_item, v_qty, p_source);
      v_undo := jsonb_build_array(jsonb_build_object('kind', 'remove', 'item_id', v_item, 'lot_id', v_lot_id, 'quantity', v_qty)) || v_undo;

    elsif v_action ->> 'kind' = 'remove' then
      if v_item is null then
        raise exception 'That item is not in this freezer';
      end if;

      if v_action ? 'lot_id' then
        select l.id, l.quantity, l.frozen_on into v_lot from public.lots l
        where l.id = (v_action ->> 'lot_id')::uuid and l.item_id = v_item
        for update;
        if v_lot.id is null then
          raise exception 'That pack is no longer in the freezer';
        end if;
        if v_lot.quantity < v_qty then
          raise exception 'Only % left in that pack', v_lot.quantity;
        end if;
        if v_lot.quantity = v_qty then
          delete from public.lots where id = v_lot.id;
        else
          update public.lots set quantity = quantity - v_qty where id = v_lot.id;
        end if;
        v_undo := jsonb_build_array(jsonb_build_object('kind', 'add', 'item_id', v_item, 'quantity', v_qty, 'frozen_on', v_lot.frozen_on)) || v_undo;
      else
        select coalesce(sum(l.quantity), 0) into v_have from public.lots l where l.item_id = v_item;
        if v_have < v_qty then
          raise exception 'Only % left of that item', v_have;
        end if;
        v_left := v_qty;
        for v_lot in
          select l.id, l.quantity, l.frozen_on from public.lots l
          where l.item_id = v_item
          order by l.frozen_on, l.created_at
          for update
        loop
          exit when v_left <= 0;
          v_take := least(v_lot.quantity, v_left);
          if v_take = v_lot.quantity then
            delete from public.lots where id = v_lot.id;
          else
            update public.lots set quantity = quantity - v_take where id = v_lot.id;
          end if;
          v_left := v_left - v_take;
          v_undo := jsonb_build_array(jsonb_build_object('kind', 'add', 'item_id', v_item, 'quantity', v_take, 'frozen_on', v_lot.frozen_on)) || v_undo;
        end loop;
      end if;

      insert into public.movements (household_id, item_id, delta, source) values (v_household, v_item, -v_qty, p_source);
    else
      raise exception 'Unknown action %', v_action ->> 'kind';
    end if;
  end loop;
  return v_undo;
end;
$$;

revoke execute on function public.create_household(text, text) from public, anon;
revoke execute on function public.accept_my_invites() from public, anon;
revoke execute on function public.apply_actions(uuid, jsonb, text) from public, anon;
grant execute on function public.create_household(text, text) to authenticated;
grant execute on function public.accept_my_invites() to authenticated;
grant execute on function public.apply_actions(uuid, jsonb, text) to authenticated;

-- Limit which columns callers may change, so an update cannot move rows between households or users.
revoke update on public.households, public.memberships, public.freezers, public.items, public.lots from authenticated, anon;
grant update (name) on public.households to authenticated;
grant update (role) on public.memberships to authenticated;
grant update (name) on public.freezers to authenticated;
grant update (name, category, unit) on public.items to authenticated;
grant update (quantity, frozen_on, best_by) on public.lots to authenticated;
revoke all on public.movements from anon;
revoke update, delete, truncate on public.movements from authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.movements;
  end if;
end;
$$;

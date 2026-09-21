-- ============================================================
-- Row Level Security + Storage + Realtime (guide §5)
-- Family isolation: every family table is readable/writable only
-- by members of that family.
-- ============================================================

-- Helper: the current user's family id.
create or replace function auth_family_id()
returns uuid language sql stable security definer set search_path = public as $$
  select family_id from profiles where id = auth.uid()
$$;

-- ---- Family tables: identical read/write-your-own-family policy ----
do $$
declare t text;
begin
  foreach t in array array[
    'categories','products','shopping_list_items','receipts',
    'receipt_items','price_history','budgets','family_invites'
  ]
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists family_rw on %I;', t);
    execute format($p$
      create policy family_rw on %I
        for all
        using (family_id = auth_family_id())
        with check (family_id = auth_family_id());
    $p$, t);
  end loop;
end $$;

-- ---- profiles: see yourself + your family; update only yourself ----
alter table profiles enable row level security;
drop policy if exists profiles_read on profiles;
create policy profiles_read on profiles
  for select using (family_id = auth_family_id() or id = auth.uid());
drop policy if exists profiles_update_self on profiles;
create policy profiles_update_self on profiles
  for update using (id = auth.uid());

-- ---- families: members read their own family ----
alter table families enable row level security;
drop policy if exists families_read on families;
create policy families_read on families
  for select using (id = auth_family_id());

-- ============================================================
-- Storage: private "receipts" bucket. Paths are `<family_id>/<receipt_id>/<n>.jpg`
-- The Edge Function uses the service role and bypasses these; the client is
-- constrained to its own family's folder.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

drop policy if exists receipts_family_read on storage.objects;
create policy receipts_family_read on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth_family_id()::text);

drop policy if exists receipts_family_insert on storage.objects;
create policy receipts_family_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth_family_id()::text);

drop policy if exists receipts_family_update on storage.objects;
create policy receipts_family_update on storage.objects
  for update to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth_family_id()::text);

drop policy if exists receipts_family_delete on storage.objects;
create policy receipts_family_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth_family_id()::text);

-- ============================================================
-- Realtime: broadcast row changes for the live-updating tables (guide §8)
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['shopping_list_items','receipts','categories','products'] loop
    begin
      execute format('alter publication supabase_realtime add table %I;', t);
    exception when duplicate_object then
      null; -- already in the publication
    end;
  end loop;
end $$;

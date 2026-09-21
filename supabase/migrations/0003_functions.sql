-- ============================================================
-- Auth trigger + family onboarding RPCs
-- ============================================================

-- Create a profile row automatically for every new auth user.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'display_name')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Create a new family and attach the caller to it.
create or replace function create_family(family_name text)
returns families language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_family families;
begin
  if v_uid is null then
    raise exception 'unauthorized';
  end if;
  if coalesce(trim(family_name), '') = '' then
    raise exception 'family_name_required';
  end if;
  if exists (select 1 from profiles where id = v_uid and family_id is not null) then
    raise exception 'already_in_family';
  end if;

  insert into families (name) values (trim(family_name)) returning * into v_family;
  update profiles set family_id = v_family.id where id = v_uid;
  return v_family;
end $$;

-- Join an existing family via a personal invite token.
create or replace function join_family(invite_token text)
returns families language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_invite family_invites;
  v_family families;
begin
  if v_uid is null then
    raise exception 'unauthorized';
  end if;

  select * into v_invite from family_invites where token = invite_token;
  if not found then
    raise exception 'invalid_token';
  end if;
  if v_invite.used_at is not null then
    raise exception 'invite_used';
  end if;
  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    raise exception 'invite_expired';
  end if;

  update profiles set family_id = v_invite.family_id where id = v_uid;
  update family_invites set used_at = now() where id = v_invite.id;

  select * into v_family from families where id = v_invite.family_id;
  return v_family;
end $$;

-- Expose the RPCs to signed-in users.
grant execute on function create_family(text) to authenticated;
grant execute on function join_family(text) to authenticated;
grant execute on function auth_family_id() to authenticated;

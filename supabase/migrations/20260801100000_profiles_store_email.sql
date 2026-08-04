alter table public.profiles
  add column if not exists email text;

update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id
  and p.email is null;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base_username text;
  final_username text;
  attempt integer := 0;
begin
  base_username := regexp_replace(lower(split_part(coalesce(new.email, 'user'), '@', 1)), '[^a-z0-9-]', '', 'g');
  if length(base_username) < 3 then base_username := 'user' || substr(md5(new.id::text), 1, 6); end if;
  final_username := base_username;
  while exists (select 1 from public.profiles where username = final_username) and attempt < 5 loop
    attempt := attempt + 1;
    final_username := base_username || '-' || substr(md5(random()::text), 1, 4);
  end loop;
  insert into public.profiles (id, username, display_name, email)
  values (
    new.id,
    final_username,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', base_username),
    new.email
  )
  on conflict (id) do update
    set email = excluded.email
    where public.profiles.email is null;
  return new;
end;
$$;

create or replace function public.get_store_creator_avatars(
  target_user_ids uuid[]
)
returns table(
  auth_user_id uuid,
  avatar_url text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.auth_user_id,
    p.avatar_url
  from public.app_profiles p
  where p.auth_user_id = any(target_user_ids)
    and p.status = 'active';
$$;

revoke all
on function public.get_store_creator_avatars(uuid[])
from public;

revoke all
on function public.get_store_creator_avatars(uuid[])
from anon;

grant execute
on function public.get_store_creator_avatars(uuid[])
to authenticated;
create table if not exists public.app_profile_verifications (
  auth_user_id uuid primary key,
  verified_at timestamptz not null default now(),
  badge_type text not null default 'verified',
  constraint app_profile_verifications_badge_type_check
    check (badge_type in ('verified'))
);

alter table public.app_profile_verifications enable row level security;

revoke all on table public.app_profile_verifications from anon, authenticated;
grant select on table public.app_profile_verifications to authenticated;

drop policy if exists app_profile_verifications_select
on public.app_profile_verifications;

create policy app_profile_verifications_select
on public.app_profile_verifications
for select
to authenticated
using (true);

create or replace function public.get_public_profile_v2(target_user_id uuid)
returns table(
  auth_user_id uuid,
  full_name text,
  username text,
  bio text,
  avatar_url text,
  is_verified boolean,
  is_private boolean,
  show_liked_products boolean,
  follower_count bigint,
  following_count bigint,
  like_count bigint,
  is_following boolean,
  can_view_content boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.auth_user_id,
    p.full_name,
    p.username,
    p.bio,
    p.avatar_url,
    exists (
      select 1
      from public.app_profile_verifications v
      where v.auth_user_id = p.auth_user_id
    ) as is_verified,
    p.is_private,
    p.show_liked_products,
    (select count(*) from public.app_profile_follows f where f.following_user_id = p.auth_user_id),
    (select count(*) from public.app_profile_follows f where f.follower_user_id = p.auth_user_id),
    (
      select count(*)
      from public.store_product_likes l
      join public.store_products sp on sp.id = l.product_id
      where sp.creator_user_id = p.auth_user_id
        and sp.status = 'published'
    ),
    exists (
      select 1
      from public.app_profile_follows f
      where f.follower_user_id = auth.uid()
        and f.following_user_id = p.auth_user_id
    ),
    (
      auth.uid() = p.auth_user_id
      or not p.is_private
      or exists (
        select 1
        from public.app_profile_follows f
        where f.follower_user_id = auth.uid()
          and f.following_user_id = p.auth_user_id
      )
    )
  from public.app_profiles p
  where p.auth_user_id = target_user_id
    and p.status = 'active'
  limit 1;
$$;

revoke all on function public.get_public_profile_v2(uuid) from public;
grant execute on function public.get_public_profile_v2(uuid) to authenticated;
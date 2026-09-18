create or replace function public.is_media_asset_owner(target_asset_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.media_assets a
    where a.id = target_asset_id
      and a.owner_user_id = auth.uid()
  );
$$;

revoke all on function public.is_media_asset_owner(uuid) from public;
grant execute on function public.is_media_asset_owner(uuid) to authenticated;

drop policy if exists "store product creators can insert own media links"
on public.store_product_media;

create policy "store product creators can insert own media links"
on public.store_product_media
for insert
to authenticated
with check (
  exists (
    select 1
    from public.store_products p
    where p.id = store_product_media.product_id
      and p.creator_user_id = auth.uid()
  )
  and public.is_media_asset_owner(store_product_media.media_asset_id)
);

drop policy if exists "store product creators can update own media links"
on public.store_product_media;

create policy "store product creators can update own media links"
on public.store_product_media
for update
to authenticated
using (
  exists (
    select 1
    from public.store_products p
    where p.id = store_product_media.product_id
      and p.creator_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.store_products p
    where p.id = store_product_media.product_id
      and p.creator_user_id = auth.uid()
  )
  and public.is_media_asset_owner(store_product_media.media_asset_id)
);

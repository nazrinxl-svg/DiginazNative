drop policy if exists "media asset owners can read own assets"
on public.media_assets;

create policy "media assets readable by product access"
on public.media_assets
for select
to authenticated
using (
  owner_user_id = auth.uid()
  or exists (
    select 1
    from public.store_product_media spm
    join public.store_products p
      on p.id = spm.product_id
    where spm.media_asset_id = media_assets.id
      and (
        p.creator_user_id = auth.uid()
        or (
          p.status = 'published'
          and (
            spm.role = 'thumbnail'
            or (
              spm.role = 'page'
              and spm.sort_order between 1 and 3
            )
            or (
              spm.role in ('preview','original')
              and p.pricing_type = 'free'
            )
          )
        )
        or exists (
          select 1
          from public.store_product_access a
          where a.product_id = p.id
            and a.user_id = auth.uid()
        )
      )
  )
);

drop policy if exists "store product creators can read own media links"
on public.store_product_media;

create policy "store product media readable by preview creator or grantee"
on public.store_product_media
for select
to authenticated
using (
  exists (
    select 1
    from public.store_products p
    where p.id = store_product_media.product_id
      and (
        p.creator_user_id = auth.uid()
        or (
          p.status = 'published'
          and (
            store_product_media.role = 'thumbnail'
            or (
              store_product_media.role = 'page'
              and store_product_media.sort_order between 1 and 3
            )
            or (
              store_product_media.role in ('preview','original')
              and p.pricing_type = 'free'
            )
          )
        )
        or exists (
          select 1
          from public.store_product_access a
          where a.product_id = p.id
            and a.user_id = auth.uid()
        )
      )
  )
);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  bucket text not null,
  storage_path text not null,
  media_kind text not null,
  variant text not null,
  mime_type text not null,
  size_bytes bigint,
  width integer,
  height integer,
  page_count integer,
  status text not null default 'uploading',
  visibility text not null default 'private',
  checksum_sha256 text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint media_assets_bucket_check
    check (char_length(btrim(bucket)) between 1 and 120),

  constraint media_assets_storage_path_check
    check (char_length(btrim(storage_path)) between 1 and 1024),

  constraint media_assets_media_kind_check
    check (media_kind = any (array[
      'image'::text,
      'pdf'::text,
      'video'::text,
      'attachment'::text,
      'avatar'::text
    ])),

  constraint media_assets_variant_check
    check (variant = any (array[
      'original'::text,
      'thumbnail'::text,
      'preview'::text,
      'page'::text,
      'processed'::text
    ])),

  constraint media_assets_mime_type_check
    check (char_length(btrim(mime_type)) between 3 and 180),

  constraint media_assets_size_bytes_check
    check (size_bytes is null or size_bytes >= 0),

  constraint media_assets_width_check
    check (width is null or width > 0),

  constraint media_assets_height_check
    check (height is null or height > 0),

  constraint media_assets_page_count_check
    check (page_count is null or page_count > 0),

  constraint media_assets_status_check
    check (status = any (array[
      'uploading'::text,
      'processing'::text,
      'ready'::text,
      'failed'::text,
      'archived'::text,
      'deleted'::text
    ])),

  constraint media_assets_visibility_check
    check (visibility = any (array[
      'public_preview'::text,
      'private'::text
    ])),

  constraint media_assets_checksum_sha256_check
    check (
      checksum_sha256 is null
      or checksum_sha256 ~ '^[0-9A-Fa-f]{64}$'
    ),

  constraint media_assets_metadata_object_check
    check (jsonb_typeof(metadata) = 'object'),

  constraint media_assets_bucket_storage_path_key
    unique (bucket, storage_path)
);

create index media_assets_owner_user_id_idx
  on public.media_assets (owner_user_id);

create index media_assets_status_idx
  on public.media_assets (status);

create index media_assets_kind_variant_idx
  on public.media_assets (media_kind, variant);

create trigger media_assets_set_updated_at
before update on public.media_assets
for each row
execute function public.set_updated_at();

create table public.store_product_media (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null
    references public.store_products(id) on delete cascade,
  media_asset_id uuid not null
    references public.media_assets(id) on delete restrict,
  role text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),

  constraint store_product_media_role_check
    check (role = any (array[
      'thumbnail'::text,
      'preview'::text,
      'page'::text,
      'original'::text
    ])),

  constraint store_product_media_sort_order_check
    check (sort_order >= 0),

  constraint store_product_media_role_order_key
    unique (product_id, role, sort_order),

  constraint store_product_media_asset_role_key
    unique (product_id, media_asset_id, role)
);

create index store_product_media_asset_id_idx
  on public.store_product_media (media_asset_id);

create index store_product_media_product_role_idx
  on public.store_product_media (product_id, role, sort_order);

alter table public.media_assets enable row level security;
alter table public.store_product_media enable row level security;

grant select, insert, update, delete
on public.media_assets
to authenticated;

grant select, insert, update, delete
on public.store_product_media
to authenticated;

create policy "media asset owners can read own assets"
on public.media_assets
for select
to authenticated
using (owner_user_id = auth.uid());

create policy "media asset owners can insert own assets"
on public.media_assets
for insert
to authenticated
with check (owner_user_id = auth.uid());

create policy "media asset owners can update own assets"
on public.media_assets
for update
to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

create policy "media asset owners can delete own assets"
on public.media_assets
for delete
to authenticated
using (owner_user_id = auth.uid());

create policy "store product creators can read own media links"
on public.store_product_media
for select
to authenticated
using (
  exists (
    select 1
    from public.store_products p
    where p.id = store_product_media.product_id
      and p.creator_user_id = auth.uid()
  )
);

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
  and exists (
    select 1
    from public.media_assets a
    where a.id = store_product_media.media_asset_id
      and a.owner_user_id = auth.uid()
  )
);

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
  and exists (
    select 1
    from public.media_assets a
    where a.id = store_product_media.media_asset_id
      and a.owner_user_id = auth.uid()
  )
);

create policy "store product creators can delete own media links"
on public.store_product_media
for delete
to authenticated
using (
  exists (
    select 1
    from public.store_products p
    where p.id = store_product_media.product_id
      and p.creator_user_id = auth.uid()
  )
);

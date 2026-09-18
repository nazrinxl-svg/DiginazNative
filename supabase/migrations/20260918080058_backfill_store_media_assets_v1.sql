with legacy_candidates as (
  select
    p.id as product_id,
    p.creator_user_id as owner_user_id,
    'thumbnail'::text as source_type,
    false as has_original,
    'store-thumbnails'::text as bucket,
    p.thumbnail_path as storage_path,
    null::text as declared_mime
  from public.store_products p
  where p.thumbnail_path is not null

  union all

  select
    pg.product_id,
    p.creator_user_id,
    'page',
    false,
    'store-product-files',
    pg.storage_path,
    pg.mime_type
  from public.store_product_pages pg
  join public.store_products p
    on p.id = pg.product_id

  union all

  select
    p.id,
    p.creator_user_id,
    'original_file',
    true,
    'store-product-originals',
    p.original_file_path,
    p.original_mime_type
  from public.store_products p
  where p.original_file_path is not null

  union all

  select
    p.id,
    p.creator_user_id,
    'primary_file',
    (p.original_file_path is not null),
    'store-product-files',
    p.file_path,
    null::text
  from public.store_products p
  where p.file_path is not null
    and not exists (
      select 1
      from public.store_product_pages pg
      where pg.product_id = p.id
        and pg.storage_path = p.file_path
    )
),
resolved_candidates as (
  select
    c.*,
    coalesce(
      nullif(o.metadata->>'mimetype',''),
      nullif(c.declared_mime,''),
      'application/octet-stream'
    ) as resolved_mime,
    case
      when (o.metadata->>'size') ~ '^[0-9]+$'
        then (o.metadata->>'size')::bigint
      else null
    end as resolved_size,
    o.created_at as object_created_at,
    o.updated_at as object_updated_at
  from legacy_candidates c
  join storage.objects o
    on o.bucket_id = c.bucket
   and o.name = c.storage_path
),
asset_rows as (
  select distinct on (bucket, storage_path)
    owner_user_id,
    bucket,
    storage_path,
    case
      when source_type in ('thumbnail','page') then 'image'
      when lower(resolved_mime) = 'application/pdf' then 'pdf'
      when lower(resolved_mime) like 'image/%' then 'image'
      when lower(resolved_mime) like 'video/%' then 'video'
      else 'attachment'
    end as media_kind,
    case
      when source_type = 'thumbnail' then 'thumbnail'
      when source_type = 'page' then 'page'
      when source_type = 'original_file' then 'original'
      when source_type = 'primary_file' and has_original then 'preview'
      when source_type = 'primary_file'
        and lower(resolved_mime) = 'application/pdf' then 'original'
      else 'page'
    end as variant,
    resolved_mime as mime_type,
    resolved_size as size_bytes,
    case
      when source_type = 'thumbnail' then 'public_preview'
      else 'private'
    end as visibility,
    product_id,
    source_type,
    object_created_at,
    object_updated_at
  from resolved_candidates
  order by
    bucket,
    storage_path,
    case source_type
      when 'thumbnail' then 1
      when 'page' then 2
      when 'original_file' then 3
      else 4
    end
)
insert into public.media_assets (
  owner_user_id,
  bucket,
  storage_path,
  media_kind,
  variant,
  mime_type,
  size_bytes,
  status,
  visibility,
  metadata,
  created_at,
  updated_at
)
select
  owner_user_id,
  bucket,
  storage_path,
  media_kind,
  variant,
  mime_type,
  size_bytes,
  'ready',
  visibility,
  jsonb_build_object(
    'legacy', true,
    'backfill_batch', 'm1_legacy_20260918',
    'legacy_source', source_type,
    'legacy_product_id', product_id::text
  ),
  coalesce(object_created_at, now()),
  coalesce(object_updated_at, object_created_at, now())
from asset_rows
on conflict (bucket, storage_path) do nothing;

with legacy_links as (
  select
    p.id as product_id,
    'store-thumbnails'::text as bucket,
    p.thumbnail_path as storage_path,
    'thumbnail'::text as role,
    0::int as sort_order
  from public.store_products p
  where p.thumbnail_path is not null

  union all

  select
    pg.product_id,
    'store-product-files',
    pg.storage_path,
    'page',
    pg.page_number
  from public.store_product_pages pg

  union all

  select
    p.id,
    'store-product-originals',
    p.original_file_path,
    'original',
    0
  from public.store_products p
  where p.original_file_path is not null

  union all

  select
    p.id,
    'store-product-files',
    p.file_path,
    case
      when p.original_file_path is not null then 'preview'
      when lower(coalesce(o.metadata->>'mimetype','')) = 'application/pdf'
        then 'original'
      else 'page'
    end,
    case
      when p.original_file_path is not null then 0
      when lower(coalesce(o.metadata->>'mimetype','')) = 'application/pdf'
        then 0
      else 1
    end
  from public.store_products p
  join storage.objects o
    on o.bucket_id = 'store-product-files'
   and o.name = p.file_path
  where p.file_path is not null
    and not exists (
      select 1
      from public.store_product_pages pg
      where pg.product_id = p.id
        and pg.storage_path = p.file_path
    )
)
insert into public.store_product_media (
  product_id,
  media_asset_id,
  role,
  sort_order
)
select
  l.product_id,
  a.id,
  l.role,
  l.sort_order
from legacy_links l
join public.media_assets a
  on a.bucket = l.bucket
 and a.storage_path = l.storage_path
on conflict do nothing;

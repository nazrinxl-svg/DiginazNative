create or replace view public.media_lifecycle_health_v1
with (security_invoker = true)
as
with product_buckets as (
  select unnest(array[
    'store-product-files'::text,
    'store-product-originals'::text,
    'store-thumbnails'::text
  ]) as bucket
),

product_health as (
  select
    'store_product'::text as media_scope,
    b.bucket,

    count(a.id)::bigint
      as tracked_asset_count,

    coalesce(
      sum(a.size_bytes),
      0
    )::bigint
      as tracked_asset_bytes,

    count(a.id) filter (
      where a.status = 'ready'
    )::bigint
      as ready_asset_count,

    count(a.id) filter (
      where a.status <> 'ready'
    )::bigint
      as nonready_asset_count,

    coalesce(
      sum(a.size_bytes) filter (
        where a.status <> 'ready'
      ),
      0
    )::bigint
      as nonready_asset_bytes,

    count(a.id) filter (
      where not exists (
        select 1
        from public.store_product_media spm
        where spm.media_asset_id = a.id
      )
    )::bigint
      as unlinked_asset_count,

    coalesce(
      sum(a.size_bytes) filter (
        where not exists (
          select 1
          from public.store_product_media spm
          where spm.media_asset_id = a.id
        )
      ),
      0
    )::bigint
      as unlinked_asset_bytes,

    (
      select count(*)::bigint
      from storage.objects o
      where o.bucket_id = b.bucket
    ) as storage_object_count,

    (
      select
        coalesce(
          sum(
            (o.metadata ->> 'size')::bigint
          ),
          0
        )::bigint
      from storage.objects o
      where o.bucket_id = b.bucket
    ) as storage_object_bytes,

    (
      select count(*)::bigint
      from storage.objects o
      where o.bucket_id = b.bucket
        and not exists (
          select 1
          from public.media_assets ma
          where ma.bucket = o.bucket_id
            and ma.storage_path = o.name
        )
    ) as orphan_candidate_count,

    (
      select
        coalesce(
          sum(
            (o.metadata ->> 'size')::bigint
          ),
          0
        )::bigint
      from storage.objects o
      where o.bucket_id = b.bucket
        and not exists (
          select 1
          from public.media_assets ma
          where ma.bucket = o.bucket_id
            and ma.storage_path = o.name
        )
    ) as orphan_candidate_bytes

  from product_buckets b
  left join public.media_assets a
    on a.bucket = b.bucket
  group by b.bucket
),

chat_health as (
  select
    'chat_attachment'::text
      as media_scope,

    'store-chat-files'::text
      as bucket,

    0::bigint
      as tracked_asset_count,

    0::bigint
      as tracked_asset_bytes,

    0::bigint
      as ready_asset_count,

    0::bigint
      as nonready_asset_count,

    0::bigint
      as nonready_asset_bytes,

    0::bigint
      as unlinked_asset_count,

    0::bigint
      as unlinked_asset_bytes,

    count(*)::bigint
      as storage_object_count,

    coalesce(
      sum(
        (o.metadata ->> 'size')::bigint
      ),
      0
    )::bigint
      as storage_object_bytes,

    count(*) filter (
      where not exists (
        select 1
        from public.store_messages m
        where m.attachment_path = o.name
      )
    )::bigint
      as orphan_candidate_count,

    coalesce(
      sum(
        (o.metadata ->> 'size')::bigint
      ) filter (
        where not exists (
          select 1
          from public.store_messages m
          where m.attachment_path = o.name
        )
      ),
      0
    )::bigint
      as orphan_candidate_bytes

  from storage.objects o
  where o.bucket_id = 'store-chat-files'
),

avatar_health as (
  select
    'avatar'::text
      as media_scope,

    'profile-avatars'::text
      as bucket,

    0::bigint
      as tracked_asset_count,

    0::bigint
      as tracked_asset_bytes,

    0::bigint
      as ready_asset_count,

    0::bigint
      as nonready_asset_count,

    0::bigint
      as nonready_asset_bytes,

    0::bigint
      as unlinked_asset_count,

    0::bigint
      as unlinked_asset_bytes,

    count(*)::bigint
      as storage_object_count,

    coalesce(
      sum(
        (o.metadata ->> 'size')::bigint
      ),
      0
    )::bigint
      as storage_object_bytes,

    count(*) filter (
      where not exists (
        select 1
        from public.app_profiles p
        where p.avatar_url is not null
          and p.avatar_url like '%' || o.name
      )
    )::bigint
      as orphan_candidate_count,

    coalesce(
      sum(
        (o.metadata ->> 'size')::bigint
      ) filter (
        where not exists (
          select 1
          from public.app_profiles p
          where p.avatar_url is not null
            and p.avatar_url like '%' || o.name
        )
      ),
      0
    )::bigint
      as orphan_candidate_bytes

  from storage.objects o
  where o.bucket_id = 'profile-avatars'
)

select *
from product_health

union all

select *
from chat_health

union all

select *
from avatar_health;


revoke all
on public.media_lifecycle_health_v1
from public;

revoke all
on public.media_lifecycle_health_v1
from anon;

revoke all
on public.media_lifecycle_health_v1
from authenticated;

revoke all
on public.media_lifecycle_health_v1
from service_role;

grant select
on public.media_lifecycle_health_v1
to service_role;

comment on view public.media_lifecycle_health_v1 is
  'Read-only media lifecycle health and orphan-candidate monitoring. This view never deletes Storage objects.';

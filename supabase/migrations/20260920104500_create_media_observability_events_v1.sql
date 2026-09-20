create table public.media_observability_events (
  id uuid primary key default gen_random_uuid(),

  user_id uuid
    default auth.uid()
    references auth.users(id)
    on delete set null,

  product_id uuid
    references public.store_products(id)
    on delete set null,

  event_type text not null,
  media_scope text not null,

  bucket text,
  storage_path text,

  bytes_transferred bigint not null default 0,
  latency_ms integer,

  source text not null default 'mobile',
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  constraint media_observability_events_event_type_check
    check (
      event_type = any (
        array[
          'upload_success'::text,
          'upload_failed'::text,
          'processing_failed'::text,
          'download_success'::text,
          'download_failed'::text,
          'signed_url_failed'::text,
          'cache_hit'::text,
          'cache_miss'::text
        ]
      )
    ),

  constraint media_observability_events_scope_check
    check (
      media_scope = any (
        array[
          'store_product'::text,
          'chat_attachment'::text,
          'avatar'::text
        ]
      )
    ),

  constraint media_observability_events_bucket_check
    check (
      bucket is null
      or char_length(btrim(bucket)) between 1 and 120
    ),

  constraint media_observability_events_storage_path_check
    check (
      storage_path is null
      or char_length(btrim(storage_path)) between 1 and 1024
    ),

  constraint media_observability_events_bytes_check
    check (bytes_transferred >= 0),

  constraint media_observability_events_latency_check
    check (
      latency_ms is null
      or latency_ms >= 0
    ),

  constraint media_observability_events_source_check
    check (
      char_length(btrim(source)) between 1 and 50
    ),

  constraint media_observability_events_metadata_check
    check (jsonb_typeof(metadata) = 'object'),

  constraint media_observability_events_metadata_size_check
    check (octet_length(metadata::text) <= 8192)
);

create index media_observability_events_created_at_idx
  on public.media_observability_events (created_at desc);

create index media_observability_events_type_created_at_idx
  on public.media_observability_events (
    event_type,
    created_at desc
  );

create index media_observability_events_user_created_at_idx
  on public.media_observability_events (
    user_id,
    created_at desc
  );

create index media_observability_events_scope_created_at_idx
  on public.media_observability_events (
    media_scope,
    created_at desc
  );

create index media_observability_events_product_created_at_idx
  on public.media_observability_events (
    product_id,
    created_at desc
  )
  where product_id is not null;

alter table public.media_observability_events
  enable row level security;

revoke all
on public.media_observability_events
from anon;

revoke select, update, delete
on public.media_observability_events
from authenticated;

grant insert
on public.media_observability_events
to authenticated;

create policy "media observability insert own"
on public.media_observability_events
for insert
to authenticated
with check (
  user_id = auth.uid()
);
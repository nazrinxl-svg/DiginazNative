create or replace view public.media_observability_download_daily_v1
with (security_invoker = true)
as
select
  (created_at at time zone 'UTC')::date as day_utc,
  media_scope,
  source,
  coalesce(bucket, 'unspecified') as bucket,

  count(*) filter (
    where event_type = 'download_success'
  )::bigint as download_success_count,

  count(*) filter (
    where event_type = 'download_failed'
  )::bigint as download_failed_count,

  count(*) filter (
    where event_type = 'signed_url_failed'
  )::bigint as signed_url_failed_count,

  coalesce(
    sum(bytes_transferred) filter (
      where event_type in (
        'download_success',
        'download_failed'
      )
    ),
    0
  )::bigint as download_bytes_transferred,

  count(*) filter (
    where event_type = 'download_success'
      and coalesce(
        (metadata ->> 'cache_reused')::boolean,
        false
      ) = true
  )::bigint as cache_reused_success_count,

  count(*) filter (
    where event_type = 'download_success'
      and bytes_transferred > 0
  )::bigint as network_download_success_count

from public.media_observability_events
where event_type in (
  'download_success',
  'download_failed',
  'signed_url_failed'
)
group by
  (created_at at time zone 'UTC')::date,
  media_scope,
  source,
  coalesce(bucket, 'unspecified');

revoke all
on public.media_observability_download_daily_v1
from public;

revoke all
on public.media_observability_download_daily_v1
from anon;

revoke all
on public.media_observability_download_daily_v1
from authenticated;

revoke all
on public.media_observability_download_daily_v1
from service_role;

grant select
on public.media_observability_download_daily_v1
to service_role;
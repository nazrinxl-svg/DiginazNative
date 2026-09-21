create or replace view public.media_observability_upload_daily_v1
with (security_invoker = true)
as
select
  (created_at at time zone 'UTC')::date as day_utc,
  media_scope,
  source,
  coalesce(bucket, 'unspecified') as bucket,

  count(*) filter (
    where event_type = 'upload_success'
  )::bigint as upload_success_count,

  count(*) filter (
    where event_type = 'upload_failed'
  )::bigint as upload_failed_count,

  coalesce(
    sum(bytes_transferred) filter (
      where event_type = 'upload_success'
    ),
    0
  )::bigint as upload_bytes_transferred,

  coalesce(
    sum(bytes_transferred) filter (
      where event_type = 'upload_failed'
    ),
    0
  )::bigint as failed_bytes_transferred

from public.media_observability_events
where event_type in (
  'upload_success',
  'upload_failed'
)
group by
  (created_at at time zone 'UTC')::date,
  media_scope,
  source,
  coalesce(bucket, 'unspecified');

revoke all
on public.media_observability_upload_daily_v1
from public;

revoke all
on public.media_observability_upload_daily_v1
from anon;

revoke all
on public.media_observability_upload_daily_v1
from authenticated;

revoke all
on public.media_observability_upload_daily_v1
from service_role;

grant select
on public.media_observability_upload_daily_v1
to service_role;

comment on view public.media_observability_upload_daily_v1 is
  'Daily UTC successful/failed upload counts and uploaded bytes for server-side media observability.';

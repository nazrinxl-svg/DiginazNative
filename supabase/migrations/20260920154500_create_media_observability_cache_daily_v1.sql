create or replace view public.media_observability_cache_daily_v1
with (security_invoker = true)
as
select
  (created_at at time zone 'UTC')::date as day_utc,
  media_scope,
  source,
  coalesce(
    nullif(metadata ->> 'cache_kind', ''),
    'unspecified'
  ) as cache_kind,
  count(*) filter (
    where event_type = 'cache_hit'
  )::bigint as cache_hit_count,
  count(*) filter (
    where event_type = 'cache_miss'
  )::bigint as cache_miss_count,
  count(*)::bigint as cache_lookup_count,
  round(
    100.0 *
      (
        count(*) filter (
          where event_type = 'cache_hit'
        )
      )::numeric
      /
      nullif(count(*), 0)::numeric,
    2
  ) as cache_hit_rate_pct
from public.media_observability_events
where event_type in (
  'cache_hit',
  'cache_miss'
)
group by
  (created_at at time zone 'UTC')::date,
  media_scope,
  source,
  coalesce(
    nullif(metadata ->> 'cache_kind', ''),
    'unspecified'
  );

revoke all
on public.media_observability_cache_daily_v1
from public;

revoke all
on public.media_observability_cache_daily_v1
from anon;

revoke all
on public.media_observability_cache_daily_v1
from authenticated;

revoke all
on public.media_observability_cache_daily_v1
from service_role;

grant select
on public.media_observability_cache_daily_v1
to service_role;
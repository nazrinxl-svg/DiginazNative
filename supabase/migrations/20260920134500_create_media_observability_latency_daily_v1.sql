create view public.media_observability_latency_daily_v1
with (security_invoker = true)
as
select
  date_trunc('day', created_at) as day_utc,
  event_type,
  media_scope,
  source,
  count(*)::bigint as sample_count,
  round(
    (
      percentile_cont(0.50)
      within group (order by latency_ms)
    )::numeric,
    2
  ) as p50_latency_ms,
  round(
    (
      percentile_cont(0.95)
      within group (order by latency_ms)
    )::numeric,
    2
  ) as p95_latency_ms,
  min(latency_ms) as min_latency_ms,
  max(latency_ms) as max_latency_ms
from public.media_observability_events
where latency_ms is not null
group by
  date_trunc('day', created_at),
  event_type,
  media_scope,
  source;

revoke all privileges
on table public.media_observability_latency_daily_v1
from public;

revoke all privileges
on table public.media_observability_latency_daily_v1
from anon;

revoke all privileges
on table public.media_observability_latency_daily_v1
from authenticated;

grant select
on table public.media_observability_latency_daily_v1
to service_role;

comment on view public.media_observability_latency_daily_v1 is
  'Daily UTC p50/p95 media latency aggregation for server-side observability.';
create or replace view public.media_cost_trend_daily_v1
with (security_invoker = true)
as
with telemetry_bounds as (
  select
    min(
      (created_at at time zone 'UTC')::date
    ) as first_day_utc,

    (
      now() at time zone 'UTC'
    )::date as current_day_utc

  from public.media_observability_events
),

day_spine as (
  select
    gs::date as day_utc

  from telemetry_bounds b

  cross join lateral generate_series(
    b.first_day_utc::timestamp,
    b.current_day_utc::timestamp,
    interval '1 day'
  ) gs

  where b.first_day_utc is not null
),

upload_daily as (
  select
    day_utc,

    sum(
      upload_success_count
    )::bigint as upload_success_count,

    sum(
      upload_failed_count
    )::bigint as upload_failed_count,

    sum(
      upload_bytes_transferred
    )::bigint as upload_bytes_transferred

  from public.media_observability_upload_daily_v1

  group by day_utc
),

download_daily as (
  select
    day_utc,

    sum(
      download_success_count
    )::bigint as download_success_count,

    sum(
      download_failed_count
    )::bigint as download_failed_count,

    sum(
      signed_url_failed_count
    )::bigint as signed_url_failed_count,

    sum(
      download_bytes_transferred
    )::bigint as download_bytes_transferred,

    sum(
      network_download_success_count
    )::bigint as network_download_success_count

  from public.media_observability_download_daily_v1

  group by day_utc
),

storage_created as (
  select
    (
      created_at at time zone 'UTC'
    )::date as day_utc,

    count(*)::bigint
      as surviving_object_count_created,

    coalesce(
      sum(
        (metadata ->> 'size')::bigint
      ),
      0
    )::bigint
      as surviving_object_bytes_created

  from storage.objects

  where bucket_id in (
    'profile-avatars',
    'store-chat-files',
    'store-product-files',
    'store-product-originals',
    'store-thumbnails'
  )

  group by
    (
      created_at at time zone 'UTC'
    )::date
),

daily as (
  select
    d.day_utc,

    coalesce(
      u.upload_success_count,
      0
    )::bigint
      as upload_success_count,

    coalesce(
      u.upload_failed_count,
      0
    )::bigint
      as upload_failed_count,

    coalesce(
      u.upload_bytes_transferred,
      0
    )::bigint
      as upload_bytes_transferred,

    coalesce(
      dl.download_success_count,
      0
    )::bigint
      as download_success_count,

    coalesce(
      dl.download_failed_count,
      0
    )::bigint
      as download_failed_count,

    coalesce(
      dl.signed_url_failed_count,
      0
    )::bigint
      as signed_url_failed_count,

    coalesce(
      dl.download_bytes_transferred,
      0
    )::bigint
      as download_bytes_transferred,

    coalesce(
      dl.network_download_success_count,
      0
    )::bigint
      as network_download_success_count,

    coalesce(
      sc.surviving_object_count_created,
      0
    )::bigint
      as surviving_object_count_created,

    coalesce(
      sc.surviving_object_bytes_created,
      0
    )::bigint
      as surviving_object_bytes_created,

    (
      coalesce(
        u.upload_bytes_transferred,
        0
      )
      +
      coalesce(
        dl.download_bytes_transferred,
        0
      )
    )::bigint
      as transfer_bytes_total,

    (
      coalesce(
        u.upload_failed_count,
        0
      )
      +
      coalesce(
        dl.download_failed_count,
        0
      )
      +
      coalesce(
        dl.signed_url_failed_count,
        0
      )
    )::bigint
      as failure_event_count

  from day_spine d

  left join upload_daily u
    using (day_utc)

  left join download_daily dl
    using (day_utc)

  left join storage_created sc
    using (day_utc)
)

select
  daily.*,

  count(*) over (
    order by day_utc
    rows between 6 preceding
    and current row
  )::integer
    as baseline_window_days,

  (
    count(*) over (
      order by day_utc
      rows between 6 preceding
      and current row
    ) = 7
  ) as baseline_ready,

  round(
    avg(
      transfer_bytes_total::numeric
    ) over (
      order by day_utc
      rows between 6 preceding
      and current row
    ),
    2
  ) as transfer_bytes_avg_7d,

  round(
    avg(
      surviving_object_bytes_created::numeric
    ) over (
      order by day_utc
      rows between 6 preceding
      and current row
    ),
    2
  ) as surviving_object_bytes_created_avg_7d,

  round(
    avg(
      failure_event_count::numeric
    ) over (
      order by day_utc
      rows between 6 preceding
      and current row
    ),
    2
  ) as failure_event_count_avg_7d

from daily;


revoke all
on public.media_cost_trend_daily_v1
from public;

revoke all
on public.media_cost_trend_daily_v1
from anon;

revoke all
on public.media_cost_trend_daily_v1
from authenticated;

revoke all
on public.media_cost_trend_daily_v1
from service_role;

grant select
on public.media_cost_trend_daily_v1
to service_role;

comment on view public.media_cost_trend_daily_v1 is
  'Read-only daily media cost signals and rolling 7-day baseline. Values represent transfer/storage activity signals, not provider billing amounts.';
revoke all privileges
on table public.media_observability_latency_daily_v1
from service_role;

grant select
on table public.media_observability_latency_daily_v1
to service_role;
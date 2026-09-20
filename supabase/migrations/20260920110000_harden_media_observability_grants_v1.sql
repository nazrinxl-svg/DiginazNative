revoke all privileges
on table public.media_observability_events
from anon;

revoke all privileges
on table public.media_observability_events
from authenticated;

revoke all privileges
on table public.media_observability_events
from public;

grant insert
on table public.media_observability_events
to authenticated;

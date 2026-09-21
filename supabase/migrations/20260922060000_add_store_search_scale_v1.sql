create extension if not exists
  pg_trgm
with schema extensions;


create index if not exists
  store_products_published_title_trgm_idx
on public.store_products
using gin (
  lower(
    coalesce(
      title,
      ''
    )
  )
  extensions.gin_trgm_ops
)
where status = 'published';


create index if not exists
  store_products_published_type_trgm_idx
on public.store_products
using gin (
  lower(
    coalesce(
      product_type,
      ''
    )
  )
  extensions.gin_trgm_ops
)
where status = 'published';


create index if not exists
  store_products_published_subject_trgm_idx
on public.store_products
using gin (
  lower(
    coalesce(
      subject,
      ''
    )
  )
  extensions.gin_trgm_ops
)
where status = 'published';


create index if not exists
  store_products_published_level_trgm_idx
on public.store_products
using gin (
  lower(
    coalesce(
      class_level,
      ''
    )
  )
  extensions.gin_trgm_ops
)
where status = 'published';


create index if not exists
  store_products_published_creator_trgm_idx
on public.store_products
using gin (
  lower(
    coalesce(
      creator_name,
      ''
    )
  )
  extensions.gin_trgm_ops
)
where status = 'published';


create or replace function
  public.search_store_products_v1(
    search_query text,
    cursor_created_at timestamptz default null,
    cursor_id uuid default null,
    page_size integer default 20
  )
returns table(
  id uuid,
  creator_user_id uuid,
  creator_name text,
  title text,
  product_type text,
  subject text,
  class_level text,
  pricing_type text,
  price_amount bigint,
  thumbnail_path text,
  download_count bigint,
  created_at timestamptz,
  page_count bigint,
  first_page_storage_path text,
  rating_average numeric,
  review_count bigint
)
language sql
stable
security invoker
set search_path =
  public,
  extensions,
  pg_temp
as $$
  with query_value as (
    select
      lower(
        btrim(
          coalesce(
            search_query,
            ''
          )
        )
      ) as raw_query,

      replace(
        replace(
          replace(
            lower(
              btrim(
                coalesce(
                  search_query,
                  ''
                )
              )
            ),
            chr(92),
            chr(92) || chr(92)
          ),
          '%',
          chr(92) || '%'
        ),
        '_',
        chr(92) || '_'
      ) as escaped_query
  ),

  filtered as (
    select
      p.*

    from public.store_products p

    cross join query_value q

    where
      p.status = 'published'

      and
      q.raw_query <> ''

      and (
        lower(
          coalesce(
            p.title,
            ''
          )
        )
        like
          '%' ||
          q.escaped_query ||
          '%'
        escape E'\\'

        or

        lower(
          coalesce(
            p.product_type,
            ''
          )
        )
        like
          '%' ||
          q.escaped_query ||
          '%'
        escape E'\\'

        or

        lower(
          coalesce(
            p.subject,
            ''
          )
        )
        like
          '%' ||
          q.escaped_query ||
          '%'
        escape E'\\'

        or

        lower(
          coalesce(
            p.class_level,
            ''
          )
        )
        like
          '%' ||
          q.escaped_query ||
          '%'
        escape E'\\'

        or

        lower(
          coalesce(
            p.creator_name,
            ''
          )
        )
        like
          '%' ||
          q.escaped_query ||
          '%'
        escape E'\\'
      )

      and (
        cursor_created_at is null

        or
        p.created_at <
          cursor_created_at

        or (
          p.created_at =
            cursor_created_at

          and
          cursor_id is not null

          and
          p.id <
            cursor_id
        )
      )

    order by
      p.created_at desc,
      p.id desc

    limit least(
      greatest(
        coalesce(
          page_size,
          20
        ),
        1
      ),
      50
    )
  )

  select
    p.id,
    p.creator_user_id,
    p.creator_name,
    p.title,
    p.product_type,
    p.subject,
    p.class_level,
    p.pricing_type,
    p.price_amount,
    p.thumbnail_path,
    p.download_count,
    p.created_at,

    coalesce(
      page_summary.page_count,
      0
    )::bigint as page_count,

    page_summary.first_page_storage_path,

    review_summary.rating_average,

    coalesce(
      review_summary.review_count,
      0
    )::bigint as review_count

  from filtered p

  left join lateral (
    select
      count(*)::bigint
        as page_count,

      max(
        spp.storage_path
      ) filter (
        where
          spp.page_number = 1
      )
        as first_page_storage_path

    from public.store_product_pages spp

    where
      spp.product_id =
        p.id
  ) page_summary
    on true

  left join lateral (
    select
      avg(
        spr.rating::numeric
      )
        as rating_average,

      count(*)::bigint
        as review_count

    from public.store_product_reviews spr

    where
      spr.product_key =
        p.id::text
  ) review_summary
    on true

  order by
    p.created_at desc,
    p.id desc;
$$;


revoke all
on function
  public.search_store_products_v1(
    text,
    timestamptz,
    uuid,
    integer
  )
from public;


revoke all
on function
  public.search_store_products_v1(
    text,
    timestamptz,
    uuid,
    integer
  )
from anon;


grant execute
on function
  public.search_store_products_v1(
    text,
    timestamptz,
    uuid,
    integer
  )
to authenticated;


grant execute
on function
  public.search_store_products_v1(
    text,
    timestamptz,
    uuid,
    integer
  )
to service_role;


comment on function
  public.search_store_products_v1(
    text,
    timestamptz,
    uuid,
    integer
  )
is
  'Server-side Store search with literal substring matching, deterministic cursor pagination, and card summaries.';

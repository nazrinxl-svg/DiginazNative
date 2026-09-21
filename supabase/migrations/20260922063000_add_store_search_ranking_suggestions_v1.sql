create or replace function
  public.search_store_products_v2(
    search_query text,
    cursor_score numeric default null,
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
  rank_score numeric,
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

  candidates as (
    select
      p.*,

      (
        case
          when
            lower(
              coalesce(
                p.title,
                ''
              )
            ) = q.raw_query
            then 1000

          when
            lower(
              coalesce(
                p.title,
                ''
              )
            )
            like
              q.escaped_query ||
              '%'
            escape E'\\'
            then 700

          when
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
            then 450

          else 0
        end

        +

        case
          when
            lower(
              coalesce(
                p.subject,
                ''
              )
            ) = q.raw_query
            then 350

          when
            lower(
              coalesce(
                p.subject,
                ''
              )
            )
            like
              q.escaped_query ||
              '%'
            escape E'\\'
            then 280

          when
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
            then 180

          else 0
        end

        +

        case
          when
            lower(
              coalesce(
                p.product_type,
                ''
              )
            ) = q.raw_query
            then 300

          when
            lower(
              coalesce(
                p.product_type,
                ''
              )
            )
            like
              q.escaped_query ||
              '%'
            escape E'\\'
            then 240

          when
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
            then 160

          else 0
        end

        +

        case
          when
            lower(
              coalesce(
                p.class_level,
                ''
              )
            ) = q.raw_query
            then 250

          when
            lower(
              coalesce(
                p.class_level,
                ''
              )
            )
            like
              q.escaped_query ||
              '%'
            escape E'\\'
            then 200

          when
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
            then 140

          else 0
        end

        +

        case
          when
            lower(
              coalesce(
                p.creator_name,
                ''
              )
            ) = q.raw_query
            then 180

          when
            lower(
              coalesce(
                p.creator_name,
                ''
              )
            )
            like
              q.escaped_query ||
              '%'
            escape E'\\'
            then 140

          when
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
            then 90

          else 0
        end
      )::numeric
        as lexical_score

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
  ),

  scored as (
    select
      c.*,

      review_summary.rating_average,

      coalesce(
        review_summary.review_count,
        0
      )::bigint
        as review_count,

      round(
        (
          c.lexical_score

          +

          coalesce(
            review_summary.rating_average,
            0
          ) * 12

          +

          least(
            coalesce(
              review_summary.review_count,
              0
            ),
            100
          )::numeric * 0.25

          +

          least(
            ln(
              1 +
              greatest(
                coalesce(
                  c.download_count,
                  0
                ),
                0
              )::numeric
            ),
            7::numeric
          ) * 4

          +

          case
            when
              c.created_at >=
              now() -
              interval '30 days'
              then 12

            when
              c.created_at >=
              now() -
              interval '90 days'
              then 6

            when
              c.created_at >=
              now() -
              interval '365 days'
              then 2

            else 0
          end
        )::numeric,
        4
      ) as rank_score

    from candidates c

    left join lateral (
      select
        avg(
          spr.rating::numeric
        ) as rating_average,

        count(*)::bigint
          as review_count

      from public.store_product_reviews spr

      where
        spr.product_key =
          c.id::text
    ) review_summary
      on true
  ),

  paged as (
    select
      s.*

    from scored s

    where
      cursor_score is null

      or
      s.rank_score <
        cursor_score

      or (
        s.rank_score =
          cursor_score

        and
        cursor_created_at is not null

        and
        s.created_at <
          cursor_created_at
      )

      or (
        s.rank_score =
          cursor_score

        and
        cursor_created_at is not null

        and
        s.created_at =
          cursor_created_at

        and
        cursor_id is not null

        and
        s.id <
          cursor_id
      )

    order by
      s.rank_score desc,
      s.created_at desc,
      s.id desc

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
    p.rank_score,

    coalesce(
      page_summary.page_count,
      0
    )::bigint
      as page_count,

    page_summary.first_page_storage_path,

    p.rating_average,

    p.review_count

  from paged p

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

  order by
    p.rank_score desc,
    p.created_at desc,
    p.id desc;
$$;


revoke all
on function
  public.search_store_products_v2(
    text,
    numeric,
    timestamptz,
    uuid,
    integer
  )
from public;


revoke all
on function
  public.search_store_products_v2(
    text,
    numeric,
    timestamptz,
    uuid,
    integer
  )
from anon;


grant execute
on function
  public.search_store_products_v2(
    text,
    numeric,
    timestamptz,
    uuid,
    integer
  )
to authenticated;


grant execute
on function
  public.search_store_products_v2(
    text,
    numeric,
    timestamptz,
    uuid,
    integer
  )
to service_role;


comment on function
  public.search_store_products_v2(
    text,
    numeric,
    timestamptz,
    uuid,
    integer
  )
is
  'Ranks Store search primarily by lexical relevance, then rating, review count, downloads and a small freshness signal; uses deterministic score+created_at+id cursor pagination.';


create or replace function
  public.suggest_store_search_v1(
    search_query text,
    suggestion_limit integer default 8
  )
returns table(
  suggestion text,
  suggestion_kind text,
  rank_score numeric
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

  source_values as (
    select
      p.title
        as suggestion,
      'title'::text
        as suggestion_kind,
      p.download_count,
      140::numeric
        as exact_weight,
      100::numeric
        as prefix_weight,
      70::numeric
        as contains_weight

    from public.store_products p

    where
      p.status = 'published'
      and
      btrim(
        coalesce(
          p.title,
          ''
        )
      ) <> ''

    union all

    select
      p.subject,
      'subject'::text,
      p.download_count,
      125::numeric,
      90::numeric,
      60::numeric

    from public.store_products p

    where
      p.status = 'published'
      and
      btrim(
        coalesce(
          p.subject,
          ''
        )
      ) <> ''

    union all

    select
      p.product_type,
      'type'::text,
      p.download_count,
      115::numeric,
      85::numeric,
      55::numeric

    from public.store_products p

    where
      p.status = 'published'
      and
      btrim(
        coalesce(
          p.product_type,
          ''
        )
      ) <> ''

    union all

    select
      p.class_level,
      'level'::text,
      p.download_count,
      105::numeric,
      80::numeric,
      50::numeric

    from public.store_products p

    where
      p.status = 'published'
      and
      btrim(
        coalesce(
          p.class_level,
          ''
        )
      ) <> ''

    union all

    select
      p.creator_name,
      'creator'::text,
      p.download_count,
      95::numeric,
      70::numeric,
      45::numeric

    from public.store_products p

    where
      p.status = 'published'
      and
      btrim(
        coalesce(
          p.creator_name,
          ''
        )
      ) <> ''
  ),

  scored as (
    select
      btrim(
        s.suggestion
      ) as suggestion,

      s.suggestion_kind,

      max(
        (
          case
            when
              lower(
                btrim(
                  s.suggestion
                )
              ) =
              q.raw_query
              then s.exact_weight

            when
              lower(
                btrim(
                  s.suggestion
                )
              )
              like
                q.escaped_query ||
                '%'
              escape E'\\'
              then s.prefix_weight

            else
              s.contains_weight
          end

          +

          least(
            ln(
              1 +
              greatest(
                coalesce(
                  s.download_count,
                  0
                ),
                0
              )::numeric
            ),
            7::numeric
          ) * 2
        )::numeric
      ) as rank_score

    from source_values s

    cross join query_value q

    where
      length(
        q.raw_query
      ) >= 2

      and
      lower(
        btrim(
          s.suggestion
        )
      )
      like
        '%' ||
        q.escaped_query ||
        '%'
      escape E'\\'

    group by
      btrim(
        s.suggestion
      ),
      s.suggestion_kind
  )

  select
    s.suggestion,
    s.suggestion_kind,
    s.rank_score

  from scored s

  order by
    s.rank_score desc,
    length(
      s.suggestion
    ) asc,
    s.suggestion asc

  limit least(
    greatest(
      coalesce(
        suggestion_limit,
        8
      ),
      1
    ),
    12
  );
$$;


revoke all
on function
  public.suggest_store_search_v1(
    text,
    integer
  )
from public;


revoke all
on function
  public.suggest_store_search_v1(
    text,
    integer
  )
from anon;


grant execute
on function
  public.suggest_store_search_v1(
    text,
    integer
  )
to authenticated;


grant execute
on function
  public.suggest_store_search_v1(
    text,
    integer
  )
to service_role;


comment on function
  public.suggest_store_search_v1(
    text,
    integer
  )
is
  'Returns ranked Store search suggestions from product titles, subjects, product types, class levels and creator names.';

create or replace function
  public.get_store_product_card_summaries(
    target_product_ids uuid[]
  )
returns table(
  product_id uuid,
  page_count bigint,
  first_page_storage_path text,
  rating_average numeric,
  review_count bigint
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    p.id as product_id,

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

  from public.store_products p

  left join lateral (
    select
      count(*)::bigint as page_count,

      max(
        spp.storage_path
      ) filter (
        where
          spp.page_number = 1
      ) as first_page_storage_path

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
      ) as rating_average,

      count(*)::bigint as review_count

    from public.store_product_reviews spr

    where
      spr.product_key =
      p.id
  ) review_summary
    on true

  where
    p.id = any(
      target_product_ids
    );
$$;


revoke all
on function
  public.get_store_product_card_summaries(uuid[])
from public;


revoke all
on function
  public.get_store_product_card_summaries(uuid[])
from anon;


grant execute
on function
  public.get_store_product_card_summaries(uuid[])
to authenticated;


grant execute
on function
  public.get_store_product_card_summaries(uuid[])
to service_role;


comment on function
  public.get_store_product_card_summaries(uuid[])
is
  'RLS-respecting summary for Store cards without transferring all page and review rows.';

create index if not exists
  store_products_published_cursor_idx
on public.store_products (
  created_at desc,
  id desc
)
where status = 'published';

comment on index
  public.store_products_published_cursor_idx
is
  'Supports deterministic published Store cursor pagination by created_at DESC, id DESC.';

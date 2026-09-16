-- Diginaz Store
-- Allow authenticated users to read the original file of a
-- published free product.
--
-- Product images remain in store_product_pages.
-- Original PDF remains in store_products.file_path.
-- Paid products remain protected by the existing access policy.

drop policy if exists
  "store published free product files readable"
on storage.objects;

create policy
  "store published free product files readable"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'store-product-files'
  and exists (
    select 1
    from public.store_products p
    where p.file_path = objects.name
      and p.status = 'published'
      and p.pricing_type = 'free'
  )
);
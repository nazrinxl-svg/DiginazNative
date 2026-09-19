create or replace function public.sync_store_product_image_pages_v1(
  p_product_id uuid,
  p_title text,
  p_product_type text,
  p_subject text,
  p_class_level text,
  p_pricing_type text,
  p_price_amount bigint,
  p_description text,
  p_thumbnail_path text,
  p_pages jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_product public.store_products%rowtype;

  v_page jsonb;
  v_page_index integer;
  v_storage_path text;
  v_mime_type text;
  v_original_name text;
  v_size_bytes bigint;
  v_width integer;
  v_height integer;
  v_asset_id uuid;

  v_desired_paths text[] :=
    array[]::text[];

  v_previous_page_paths text[] :=
    array[]::text[];

  v_previous_media jsonb :=
    '[]'::jsonb;

  v_previous_asset_ids uuid[] :=
    array[]::uuid[];

  v_stale_storage jsonb :=
    '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_product_id is null then
    raise exception 'PRODUCT_ID_REQUIRED';
  end if;

  if p_pages is null
     or jsonb_typeof(p_pages) <> 'array'
     or jsonb_array_length(p_pages) < 1
  then
    raise exception 'IMAGE_PAGE_REQUIRED';
  end if;

  if jsonb_array_length(p_pages) > 15 then
    raise exception 'IMAGE_PAGE_LIMIT_EXCEEDED';
  end if;

  select product.*
  into v_product
  from public.store_products as product
  where product.id = p_product_id
  for update;

  if not found then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  if v_product.creator_user_id <> v_user_id then
    raise exception 'PRODUCT_FORBIDDEN';
  end if;

  /*
   * Validasi desired state terlebih dahulu.
   * Belum ada mutation.
   */
  for v_page_index in
    0 .. jsonb_array_length(p_pages) - 1
  loop
    v_page :=
      p_pages -> v_page_index;

    if jsonb_typeof(v_page) <> 'object' then
      raise exception 'INVALID_IMAGE_PAGE';
    end if;

    v_storage_path :=
      btrim(
        coalesce(
          v_page ->> 'storage_path',
          ''
        )
      );

    if v_storage_path = '' then
      raise exception
        'IMAGE_PAGE_PATH_REQUIRED';
    end if;

    /*
     * Object hanya boleh berada dalam
     * namespace user + produk ini.
     */
    if v_storage_path not like (
      v_user_id::text ||
      '/' ||
      p_product_id::text ||
      '/%'
    ) then
      raise exception
        'INVALID_IMAGE_PAGE_PATH';
    end if;

    if v_storage_path =
      any(v_desired_paths)
    then
      raise exception
        'DUPLICATE_IMAGE_PAGE_PATH';
    end if;

    v_desired_paths :=
      array_append(
        v_desired_paths,
        v_storage_path
      );
  end loop;

  /*
   * Snapshot legacy page path sebelum
   * rekonsiliasi.
   */
  select
    coalesce(
      array_agg(
        page.storage_path
        order by page.page_number
      ),
      array[]::text[]
    )
  into v_previous_page_paths
  from public.store_product_pages
    as page
  where page.product_id =
    p_product_id;

  /*
   * Snapshot metadata media lama:
   * page, preview dan original.
   */
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'asset_id',
          asset.id,
          'bucket',
          asset.bucket,
          'storage_path',
          asset.storage_path,
          'role',
          link.role,
          'sort_order',
          link.sort_order
        )
        order by
          link.role,
          link.sort_order
      ),
      '[]'::jsonb
    ),
    coalesce(
      array_agg(
        distinct asset.id
      ),
      array[]::uuid[]
    )
  into
    v_previous_media,
    v_previous_asset_ids
  from public.store_product_media
    as link
  join public.media_assets
    as asset
    on asset.id =
      link.media_asset_id
  where link.product_id =
      p_product_id
    and link.role in (
      'page',
      'preview',
      'original'
    );

  /*
   * Buang mapping lama terlebih dahulu.
   * Seluruh fungsi berjalan dalam satu
   * transaksi PostgreSQL.
   */
  delete from public.store_product_media
  where product_id =
      p_product_id
    and role in (
      'page',
      'preview',
      'original'
    );

  delete from public.store_product_pages
  where product_id =
    p_product_id;

  /*
   * Rebuild halaman menurut desired state.
   *
   * Existing asset:
   * reuse berdasarkan bucket + storage_path.
   *
   * New upload:
   * buat media_assets baru.
   */
  for v_page_index in
    0 .. jsonb_array_length(p_pages) - 1
  loop
    v_page :=
      p_pages -> v_page_index;

    v_storage_path :=
      btrim(
        v_page ->> 'storage_path'
      );

    v_mime_type :=
      nullif(
        btrim(
          coalesce(
            v_page ->> 'mime_type',
            ''
          )
        ),
        ''
      );

    if v_mime_type is null then
      v_mime_type :=
        'image/jpeg';
    else
      v_mime_type :=
        lower(v_mime_type);
    end if;

    if v_mime_type in (
      'image/jpg',
      'image/pjpeg'
    ) then
      v_mime_type :=
        'image/jpeg';
    elsif v_mime_type =
      'image/x-png'
    then
      v_mime_type :=
        'image/png';
    end if;

    if v_mime_type not in (
      'image/jpeg',
      'image/png',
      'image/webp'
    ) then
      raise exception
        'INVALID_IMAGE_PAGE_MIME';
    end if;

    v_original_name :=
      nullif(
        btrim(
          coalesce(
            v_page ->> 'original_name',
            ''
          )
        ),
        ''
      );

    v_size_bytes :=
      case
        when jsonb_typeof(
          v_page -> 'size_bytes'
        ) = 'number'
        then greatest(
          0,
          (
            v_page ->>
            'size_bytes'
          )::bigint
        )
        else null
      end;

    v_width :=
      case
        when jsonb_typeof(
          v_page -> 'width'
        ) = 'number'
        then least(
          2147483647::numeric,
          greatest(
            1::numeric,
            (
              v_page ->>
              'width'
            )::numeric
          )
        )::integer
        else null
      end;

    v_height :=
      case
        when jsonb_typeof(
          v_page -> 'height'
        ) = 'number'
        then least(
          2147483647::numeric,
          greatest(
            1::numeric,
            (
              v_page ->>
              'height'
            )::numeric
          )
        )::integer
        else null
      end;

    select asset.id
    into v_asset_id
    from public.media_assets
      as asset
    where asset.bucket =
        'store-product-files'
      and asset.storage_path =
        v_storage_path
    for update;

    if found then
      /*
       * Jangan pernah mengambil asset
       * milik user lain.
       */
      if not exists (
        select 1
        from public.media_assets
          as owned
        where owned.id =
            v_asset_id
          and owned.owner_user_id =
            v_user_id
      ) then
        raise exception
          'IMAGE_ASSET_FORBIDDEN';
      end if;

      /*
       * Path produk ini tidak semestinya
       * dipakai produk lain.
       */
      if exists (
        select 1
        from public.store_product_media
          as foreign_link
        where
          foreign_link.media_asset_id =
            v_asset_id
          and foreign_link.product_id <>
            p_product_id
      ) then
        raise exception
          'IMAGE_ASSET_LINK_CONFLICT';
      end if;

      update public.media_assets
      set
        media_kind =
          'image',
        variant =
          'page',
        mime_type =
          v_mime_type,
        size_bytes =
          coalesce(
            v_size_bytes,
            size_bytes
          ),
        width =
          coalesce(
            v_width,
            width
          ),
        height =
          coalesce(
            v_height,
            height
          ),
        status =
          'ready',
        visibility =
          'private',
        metadata =
          coalesce(
            metadata,
            '{}'::jsonb
          ) ||
          jsonb_build_object(
            'source',
            'product_edit',
            'page_number',
            v_page_index + 1
          ),
        updated_at =
          now()
      where id =
        v_asset_id;
    else
      insert into public.media_assets (
        owner_user_id,
        bucket,
        storage_path,
        media_kind,
        variant,
        mime_type,
        size_bytes,
        width,
        height,
        status,
        visibility,
        metadata
      )
      values (
        v_user_id,
        'store-product-files',
        v_storage_path,
        'image',
        'page',
        v_mime_type,
        v_size_bytes,
        v_width,
        v_height,
        'ready',
        'private',
        jsonb_build_object(
          'source',
          'product_edit',
          'page_number',
          v_page_index + 1
        )
      )
      returning id
      into v_asset_id;
    end if;

    insert into
      public.store_product_pages (
        product_id,
        page_number,
        storage_path,
        mime_type,
        original_name
      )
    values (
      p_product_id,
      v_page_index + 1,
      v_storage_path,
      v_mime_type,
      v_original_name
    );

    insert into
      public.store_product_media (
        product_id,
        media_asset_id,
        role,
        sort_order
      )
    values (
      p_product_id,
      v_asset_id,
      'page',
      v_page_index + 1
    );
  end loop;

  /*
   * Update produk dalam transaksi yang
   * sama dengan page reconciliation.
   */
  update public.store_products
  set
    title =
      btrim(p_title),
    product_type =
      p_product_type,
    subject =
      p_subject,
    class_level =
      p_class_level,
    pricing_type =
      p_pricing_type,
    price_amount =
      p_price_amount,
    original_price_amount =
      null,
    description =
      coalesce(
        p_description,
        ''
      ),
    thumbnail_path =
      p_thumbnail_path,
    file_path =
      v_desired_paths[1],
    original_file_path =
      null,
    original_file_name =
      null,
    original_mime_type =
      null,
    status =
      'published'
  where id =
      p_product_id
    and creator_user_id =
      v_user_id;

  if not found then
    raise exception
      'PRODUCT_UPDATE_FAILED';
  end if;

  /*
   * Hapus metadata asset lama hanya bila
   * asset sudah tidak mempunyai link.
   *
   * Retained pages tetap aman karena sudah
   * dilink ulang di atas.
   */
  delete from public.media_assets
    as asset
  where asset.id =
      any(v_previous_asset_ids)
    and not exists (
      select 1
      from public.store_product_media
        as remaining_link
      where
        remaining_link.media_asset_id =
          asset.id
    );

  /*
   * Storage tidak dihapus di RPC.
   * Kita hanya mengembalikan kandidat object
   * yang benar-benar sudah tidak direferensikan.
   *
   * Client membersihkan Storage setelah RPC
   * selesai/commit.
   */
  with candidate_storage as (
    select
      'store-product-files'::text
        as bucket,
      old_path
        as storage_path
    from unnest(
      v_previous_page_paths
    ) as old_path
    where old_path <>
      all(v_desired_paths)

    union

    select
      media_row ->> 'bucket',
      media_row ->> 'storage_path'
    from jsonb_array_elements(
      v_previous_media
    ) as media_row
    where (
      media_row ->> 'role'
    ) in (
      'original',
      'preview'
    )
    or (
      (
        media_row ->> 'role'
      ) = 'page'
      and (
        media_row ->>
        'storage_path'
      ) <> all(v_desired_paths)
    )

    union

    select
      'store-product-files',
      v_product.file_path
    where
      v_product.file_path
        is not null
      and v_product.file_path <>
        all(v_desired_paths)

    union

    select
      'store-product-originals',
      v_product.original_file_path
    where
      v_product.original_file_path
        is not null
  ),
  safe_stale as (
    select distinct
      candidate.bucket,
      candidate.storage_path
    from candidate_storage
      as candidate
    where
      candidate.storage_path
        is not null
      and btrim(
        candidate.storage_path
      ) <> ''
      and not exists (
        select 1
        from public.media_assets
          as active_asset
        where
          active_asset.bucket =
            candidate.bucket
          and active_asset.storage_path =
            candidate.storage_path
      )
      and not exists (
        select 1
        from public.store_product_pages
          as active_page
        where
          candidate.bucket =
            'store-product-files'
          and active_page.storage_path =
            candidate.storage_path
      )
      and not exists (
        select 1
        from public.store_products
          as active_product
        where
          (
            candidate.bucket =
              'store-product-files'
            and active_product.file_path =
              candidate.storage_path
          )
          or (
            candidate.bucket =
              'store-product-originals'
            and active_product.original_file_path =
              candidate.storage_path
          )
      )
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'bucket',
          safe.bucket,
          'storage_path',
          safe.storage_path
        )
        order by
          safe.bucket,
          safe.storage_path
      ),
      '[]'::jsonb
    )
  into v_stale_storage
  from safe_stale
    as safe;

  return jsonb_build_object(
    'product_id',
    p_product_id,
    'first_storage_path',
    v_desired_paths[1],
    'page_count',
    array_length(
      v_desired_paths,
      1
    ),
    'stale_storage',
    v_stale_storage
  );
end;
$function$;

revoke all
on function
  public.sync_store_product_image_pages_v1(
    uuid,
    text,
    text,
    text,
    text,
    text,
    bigint,
    text,
    text,
    jsonb
  )
from public;

revoke all
on function
  public.sync_store_product_image_pages_v1(
    uuid,
    text,
    text,
    text,
    text,
    text,
    bigint,
    text,
    text,
    jsonb
  )
from anon;

grant execute
on function
  public.sync_store_product_image_pages_v1(
    uuid,
    text,
    text,
    text,
    text,
    text,
    bigint,
    text,
    text,
    jsonb
  )
to authenticated;
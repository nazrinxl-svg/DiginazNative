import { supabase } from "./supabase";
import { logA4 } from "./storeProductPreview";

export type StoreFirstPage = {
  id: string;
  firstPageStoragePath: string | null;
};

export type StoreProductCardItem = {
  id: string;
  creatorUserId: string;
  type: string;
  subject: string;
  level: string;
  title: string;
  author: string;
  rating: string;
  reviewCount: number;
  price: string;
  thumbnailUrl: string | null;

  /*
   * Path halaman A4 pertama.
   * Path saja, bukan signed URL,
   * sehingga aman disimpan di cache Store.
   */
  firstPageStoragePath?: string | null;

  pageCount: number;
  downloadCount: number;
};

export type StoreProductRow = {
  id: string;
  creator_user_id: string;
  creator_name: string;
  title: string;
  product_type: string;
  subject: string;
  class_level: string;
  pricing_type: string;
  price_amount: number | null;
  thumbnail_path: string | null;
  download_count: number | null;
  created_at: string;

  store_product_pages?: Array<{
    page_number: number;
    storage_path: string;
  }> | null;
};

type StoreReviewRow = {
  product_key: string;
  rating: number;
};

export function formatRupiah(
  value: number | null
) {
  const amount = Math.max(
    0,
    Number(value ?? 0)
  );

  const formatted =
    Math.round(amount)
      .toString()
      .replace(
        /\B(?=(\d{3})+(?!\d))/g,
        "."
      );

  return `Rp${formatted}`;
}

export async function fetchPublishedStoreProducts(
  onFirstPagesReady?: (pages: StoreFirstPage[]) => void
): Promise<StoreProductCardItem[]> {
  const productsStarted = Date.now();

  const {
    data: productData,
    error: productError,
  } =
    await supabase
      .from("store_products")
      .select(
        "id,creator_user_id,creator_name,title,product_type,subject,class_level,pricing_type,price_amount,thumbnail_path,download_count,created_at,store_product_pages(page_number,storage_path)"
      )
      .eq(
        "status",
        "published"
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      );

  if (productError) {
    throw productError;
  }

  const rows =
    (productData ?? []) as unknown as
      StoreProductRow[];

  logA4("STORE_PRODUCTS_DONE", "store", {
    ms: Date.now() - productsStarted,
    count: rows.length,
  });
  onFirstPagesReady?.(rows.map(row => ({
    id: row.id,
    firstPageStoragePath: row.store_product_pages
      ?.find(page => page.page_number === 1)?.storage_path ?? null,
  })));

  const productIds =
    rows.map(
      (row) => row.id
    );

  const reviewsStarted = Date.now();
  let reviewRows:
    StoreReviewRow[] = [];

  if (
    productIds.length > 0
  ) {

    const {
      data: reviewData,
      error: reviewError,
    } =
      await supabase
        .from(
          "store_product_reviews"
        )
        .select(
          "product_key,rating"
        )
        .in(
          "product_key",
          productIds
        );

    if (reviewError) {
      throw reviewError;
    }

    reviewRows =
      (reviewData ?? []) as unknown as
        StoreReviewRow[];
  }

  logA4("STORE_REVIEWS_DONE", "store", { ms: Date.now() - reviewsStarted });

  const ratingMap =
    new Map<
      string,
      {
        sum: number;
        count: number;
      }
    >();

  for (
    const review of reviewRows
  ) {

    const current =
      ratingMap.get(
        review.product_key
      ) ?? {
        sum: 0,
        count: 0,
      };

    current.sum +=
      Number(
        review.rating
      );

    current.count += 1;

    ratingMap.set(
      review.product_key,
      current
    );
  }

  return rows.map(
    (row) => {

      const rating =
        ratingMap.get(
          row.id
        );

      const firstPageStoragePath =
        row.store_product_pages
          ?.find(
            page =>
              page.page_number === 1
          )
          ?.storage_path ??
        null;

      let thumbnailUrl:
        string | null = null;

      if (
        row.thumbnail_path
      ) {

        const { data } =
          supabase.storage
            .from(
              "store-thumbnails"
            )
            .getPublicUrl(
              row.thumbnail_path
            );

        thumbnailUrl =
          data.publicUrl || null;
      }

      return {
        id:
          row.id,

        creatorUserId:
          row.creator_user_id,

        type:
          row.product_type,

        subject:
          row.subject,

        level:
          row.class_level,

        title:
          row.title,

        author:
          row.creator_name,

        rating:
          rating &&
          rating.count > 0
            ? (
                rating.sum /
                rating.count
              ).toFixed(1)
            : "0.0",

        reviewCount:
          rating?.count ?? 0,

        price:
          row.pricing_type ===
          "free"
            ? "Gratis"
            : formatRupiah(
                row.price_amount
              ),

        thumbnailUrl,

        firstPageStoragePath,

    pageCount:
      row.store_product_pages?.length ?? 0,
        downloadCount:
          Number(
            row.download_count ??
            0
          ),
      };
    }
  );
}

export async function fetchPublishedStoreProductById(
  productId: string
): Promise<StoreProductCardItem> {

  const {
    data,
    error,
  } =
    await supabase
      .from("store_products")
      .select(
        "id,creator_user_id,creator_name,title,product_type,subject,class_level,pricing_type,price_amount,thumbnail_path,download_count,created_at,store_product_pages(page_number,storage_path)"
      )
      .eq(
        "id",
        productId
      )
      .eq(
        "status",
        "published"
      )
      .single();

  if (error) {
    throw error;
  }

  const row =
    data as unknown as StoreProductRow;

  const {
    data: reviewData,
    error: reviewError,
  } =
    await supabase
      .from(
        "store_product_reviews"
      )
      .select("rating")
      .eq(
        "product_key",
        productId
      );

  if (reviewError) {
    throw reviewError;
  }

  const ratings =
    (reviewData ?? [])
      .map(
        (item) =>
          Number(
            item.rating
          )
      )
      .filter(
        (value) =>
          Number.isFinite(
            value
          )
      );

  const rating =
    ratings.length > 0
      ? (
          ratings.reduce(
            (
              total,
              value
            ) =>
              total + value,
            0
          ) /
          ratings.length
        ).toFixed(1)
      : "0.0";

  const firstPageStoragePath =
    row.store_product_pages
      ?.find(
        page =>
          page.page_number === 1
      )
      ?.storage_path ??
    null;

  let thumbnailUrl:
    string | null = null;

  if (
    row.thumbnail_path
  ) {

    const {
      data: thumbnailData,
    } =
      supabase.storage
        .from(
          "store-thumbnails"
        )
        .getPublicUrl(
          row.thumbnail_path
        );

    thumbnailUrl =
      thumbnailData
        .publicUrl || null;
  }

  return {
    id:
      row.id,

    creatorUserId:
      row.creator_user_id,

    type:
      row.product_type,

    subject:
      row.subject,

    level:
      row.class_level,

    title:
      row.title,

    author:
      row.creator_name,

    rating,

    reviewCount:
      ratings.length,

    price:
      row.pricing_type ===
      "free"
        ? "Gratis"
        : formatRupiah(
            row.price_amount
          ),

    thumbnailUrl,

    firstPageStoragePath,

    pageCount:
      row.store_product_pages?.length ?? 0,
    downloadCount:
      Number(
        row.download_count ??
          0
      ),
  };
}

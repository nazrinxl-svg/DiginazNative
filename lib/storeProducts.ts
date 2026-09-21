import { Image } from "react-native";
import ReactNativeBlobUtil from "react-native-blob-util";

import { supabase } from "./supabase";
import {
  getPublicStoreMediaUrl,
  STORE_MEDIA_BUCKETS,
} from "./storeMedia";
import { logA4 } from "./storeProductPreview";

export type StoreFirstPage = {
  id: string;
  firstPageStoragePath: string | null;
};

export type StoreProductCardItem = {
  id: string;
  creatorUserId: string;
  creatorAvatarUrl?: string | null;
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

type StoreProductCardSummaryRow = {
  product_id: string;
  page_count: number | string | null;
  first_page_storage_path: string | null;
  rating_average: number | string | null;
  review_count: number | string | null;
};


type StoreSearchRow = {
  id: string;
  creator_user_id: string;
  creator_name: string;
  title: string;
  product_type: string;
  subject: string;
  class_level: string;
  pricing_type: string;
  price_amount: number | string | null;
  thumbnail_path: string | null;
  download_count: number | string | null;
  created_at: string;
  page_count: number | string | null;
  first_page_storage_path: string | null;
  rating_average: number | string | null;
  review_count: number | string | null;
};


type StoreProductCardSummary = {
  pageCount: number;
  firstPageStoragePath: string | null;
  rating: string;
  reviewCount: number;
};


type StoreCreatorAvatarRow = {
  auth_user_id: string;
  avatar_url: string | null;
};


async function fetchStoreProductCardSummaryMap(
  productIds: string[]
): Promise<
  Map<string, StoreProductCardSummary>
> {

  if (
    productIds.length === 0
  ) {
    return new Map();
  }


  const {
    data,
    error,
  } =
    await supabase
      .rpc(
        "get_store_product_card_summaries",
        {
          target_product_ids:
            productIds,
        }
      );


  if (error) {
    throw error;
  }


  const rows =
    (data ?? []) as unknown as
      StoreProductCardSummaryRow[];


  return new Map(
    rows.map(
      row => {

        const ratingValue =
          Number(
            row.rating_average ??
              0
          );


        return [
          row.product_id,
          {
            pageCount:
              Math.max(
                0,
                Number(
                  row.page_count ??
                    0
                )
              ),

            firstPageStoragePath:
              String(
                row.first_page_storage_path ??
                  ""
              ).trim() ||
              null,

            rating:
              Number.isFinite(
                ratingValue
              )
                ? ratingValue.toFixed(
                    1
                  )
                : "0.0",

            reviewCount:
              Math.max(
                0,
                Number(
                  row.review_count ??
                    0
                )
              ),
          },
        ] as const;
      }
    )
  );
}


async function fetchStoreCreatorAvatarMap(
  creatorUserIds: string[]
): Promise<
  Map<string, string | null>
> {

  const uniqueIds =
    Array.from(
      new Set(
        creatorUserIds.filter(
          Boolean
        )
      )
    );


  if (
    uniqueIds.length === 0
  ) {
    return new Map();
  }


  const {
    data,
    error,
  } =
    await supabase
      .rpc(
        "get_store_creator_avatars",
        {
          target_user_ids:
            uniqueIds,
        }
      );


  if (error) {
    console.warn(
      "Avatar creator Store gagal dimuat:",
      error
    );

    return new Map();
  }


  const rows =
    (data ?? []) as unknown as
      StoreCreatorAvatarRow[];


  return new Map(
    rows.map(
      row => [
        row.auth_user_id,
        String(
          row.avatar_url ?? ""
        ).trim() || null,
      ] as const
    )
  );
}

/*
 * CREATOR_AVATAR_LOCAL_FILE_V8
 *
 * Product Detail harus menerima file lokal,
 * bukan URL network.
 */
async function cacheCreatorAvatarLocally(
  creatorUserId: string,
  avatarUrl: string | null
): Promise<string | null> {

  if (!avatarUrl) {
    return null;
  }


  try {
    const rawName =
      avatarUrl
        .split("/")
        .pop()
        ?.split("?")[0] ??
      "avatar.jpg";


    const safeName =
      rawName.replace(
        /[^a-zA-Z0-9._-]/g,
        "_"
      );


    const safeUserId =
      creatorUserId.replace(
        /[^a-zA-Z0-9_-]/g,
        "_"
      );


    const localPath =
      ReactNativeBlobUtil.fs.dirs.CacheDir +
      "/diginaz-creator-" +
      safeUserId +
      "-" +
      safeName;


    const exists =
      await ReactNativeBlobUtil.fs.exists(
        localPath
      );


    if (!exists) {
      await ReactNativeBlobUtil
        .config({
          path:
            localPath,
          fileCache:
            true,
        })
        .fetch(
          "GET",
          avatarUrl
        );
    }


    return (
      "file://" +
      localPath
    );

  } catch (error) {
    console.warn(
      "Avatar creator gagal dicache lokal:",
      error
    );

    /*
     * Fallback:
     * URL network tetap dapat dipakai.
     */
    return avatarUrl;
  }
}


async function buildCreatorAvatarDisplayMap(
  remoteMap: Map<
    string,
    string | null
  >
): Promise<
  Map<string, string | null>
> {

  const result =
    new Map<
      string,
      string | null
    >();


  await Promise.all(
    Array.from(
      remoteMap.entries()
    ).map(
      async (
        [
          creatorUserId,
          avatarUrl,
        ]
      ) => {

        const displayUri =
          await cacheCreatorAvatarLocally(
            creatorUserId,
            avatarUrl
          );


        result.set(
          creatorUserId,
          displayUri
        );
      }
    )
  );


  return result;
}


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

export const STORE_PRODUCTS_PAGE_SIZE =
  20;

export type StoreProductsCursor = {
  createdAt: string;
  id: string;
};


export type StoreProductsPage = {
  items: StoreProductCardItem[];
  nextCursor: StoreProductsCursor | null;
  hasMore: boolean;
};


export async function fetchPublishedStoreProducts(
  cursor: StoreProductsCursor | null = null,
  onFirstPagesReady?: (pages: StoreFirstPage[]) => void
): Promise<StoreProductsPage> {
  const productsStarted = Date.now();

  /*
   * TRACK_P_TRUE_INCREMENTAL_V1
   *
   * Satu pemanggilan = maksimal satu page.
   * App yang menentukan kapan page berikutnya
   * perlu diminta.
   */
  let pageQuery =
    supabase
      .from(
        "store_products"
      )
      .select(
        "id,creator_user_id,creator_name,title,product_type,subject,class_level,pricing_type,price_amount,thumbnail_path,download_count,created_at"
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
      )
      .order(
        "id",
        {
          ascending: false,
        }
      )
      .limit(
        STORE_PRODUCTS_PAGE_SIZE
      );


  if (cursor) {
    pageQuery =
      pageQuery.or(
        `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`
      );
  }


  const {
    data: pageData,
    error: pageError,
  } =
    await pageQuery;


  if (pageError) {
    throw pageError;
  }


  const rows =
    (pageData ?? []) as unknown as
      StoreProductRow[];


  logA4(
    "STORE_PRODUCTS_PAGE_DONE",
    "store",
    {
      count:
        rows.length,

      cursor:
        Boolean(cursor),
    }
  );


  logA4("STORE_PRODUCTS_DONE", "store", {
    ms: Date.now() - productsStarted,
    count: rows.length,
  });


  const productIds =
    rows.map(
      row =>
        row.id
    );


  /*
   * TRACK_P_CARD_SUMMARY_V1
   *
   * Mobile menerima satu summary row per produk,
   * bukan seluruh page rows + review rows.
   */
  const cardSummaryMapPromise =
    fetchStoreProductCardSummaryMap(
      productIds
    );


  const creatorAvatarMapPromise =
    fetchStoreCreatorAvatarMap(
      rows.map(
        row =>
          row.creator_user_id
      )
    );


  const cardSummaryMap =
    await cardSummaryMapPromise;


  onFirstPagesReady?.(
    rows.map(
      row => ({
        id:
          row.id,

        firstPageStoragePath:
          cardSummaryMap.get(
            row.id
          )
            ?.firstPageStoragePath ??
          null,
      })
    )
  );


  const creatorAvatarMap =
    await creatorAvatarMapPromise;


  const creatorAvatarDisplayMap =
    await buildCreatorAvatarDisplayMap(
      creatorAvatarMap
    );


  const items =
    rows.map(
    (row) => {

      const summary =
        cardSummaryMap.get(
          row.id
        );

      const firstPageStoragePath =
        summary
          ?.firstPageStoragePath ??
        null;

      const thumbnailUrl =
        row.thumbnail_path
          ? getPublicStoreMediaUrl(
              STORE_MEDIA_BUCKETS.thumbnails,
              row.thumbnail_path
            )
          : null;

      return {
        id:
          row.id,

        creatorUserId:
          row.creator_user_id,

        creatorAvatarUrl:
          creatorAvatarDisplayMap.get(
            row.creator_user_id
          ) ?? null,

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
          summary?.rating ??
          "0.0",

        reviewCount:
          summary
            ?.reviewCount ??
          0,

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
          summary
            ?.pageCount ??
          0,
        downloadCount:
          Number(
            row.download_count ??
            0
          ),
      };
    }
  );

  const lastRow =
    rows.length > 0
      ? rows[
          rows.length - 1
        ]
      : null;


  const hasMore =
    rows.length ===
    STORE_PRODUCTS_PAGE_SIZE;


  return {
    items,

    nextCursor:
      hasMore &&
      lastRow
        ? {
            createdAt:
              lastRow.created_at,

            id:
              lastRow.id,
          }
        : null,

    hasMore,
  };
}


export async function searchPublishedStoreProducts(
  searchQuery: string,
  cursor: StoreProductsCursor | null = null,
  onFirstPagesReady?: (pages: StoreFirstPage[]) => void
): Promise<StoreProductsPage> {

  const normalizedQuery =
    searchQuery.trim();


  if (!normalizedQuery) {
    return {
      items: [],
      nextCursor: null,
      hasMore: false,
    };
  }


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "search_store_products_v1",
      {
        search_query:
          normalizedQuery,

        cursor_created_at:
          cursor?.createdAt ??
          null,

        cursor_id:
          cursor?.id ??
          null,

        page_size:
          STORE_PRODUCTS_PAGE_SIZE,
      }
    );


  if (error) {
    throw error;
  }


  const rows =
    (data ?? []) as unknown as
      StoreSearchRow[];


  logA4(
    "STORE_SEARCH_PAGE_DONE",
    "store",
    {
      query:
        normalizedQuery,

      count:
        rows.length,

      cursor:
        Boolean(cursor),
    }
  );


  onFirstPagesReady?.(
    rows.map(
      row => ({
        id:
          row.id,

        firstPageStoragePath:
          String(
            row.first_page_storage_path ??
              ""
          ).trim() ||
          null,
      })
    )
  );


  const creatorAvatarMap =
    await fetchStoreCreatorAvatarMap(
      rows.map(
        row =>
          row.creator_user_id
      )
    );


  const creatorAvatarDisplayMap =
    await buildCreatorAvatarDisplayMap(
      creatorAvatarMap
    );


  const items =
    rows.map(
      row => {

        const ratingValue =
          Number(
            row.rating_average ??
              0
          );


        const thumbnailUrl =
          row.thumbnail_path
            ? getPublicStoreMediaUrl(
                STORE_MEDIA_BUCKETS.thumbnails,
                row.thumbnail_path
              )
            : null;


        return {
          id:
            row.id,

          creatorUserId:
            row.creator_user_id,

          creatorAvatarUrl:
            creatorAvatarDisplayMap.get(
              row.creator_user_id
            ) ?? null,

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
            Number.isFinite(
              ratingValue
            )
              ? ratingValue.toFixed(
                  1
                )
              : "0.0",

          reviewCount:
            Math.max(
              0,
              Number(
                row.review_count ??
                  0
              )
            ),

          price:
            row.pricing_type ===
            "free"
              ? "Gratis"
              : formatRupiah(
                  Number(
                    row.price_amount ??
                      0
                  )
                ),

          thumbnailUrl,

          firstPageStoragePath:
            String(
              row.first_page_storage_path ??
                ""
            ).trim() ||
            null,

          pageCount:
            Math.max(
              0,
              Number(
                row.page_count ??
                  0
              )
            ),

          downloadCount:
            Math.max(
              0,
              Number(
                row.download_count ??
                  0
              )
            ),
        };
      }
    );


  const lastRow =
    rows.length > 0
      ? rows[
          rows.length - 1
        ]
      : null;


  const hasMore =
    rows.length ===
    STORE_PRODUCTS_PAGE_SIZE;


  return {
    items,

    nextCursor:
      hasMore &&
      lastRow
        ? {
            createdAt:
              lastRow.created_at,

            id:
              lastRow.id,
          }
        : null,

    hasMore,
  };
}


export async function fetchAllPublishedStoreProducts(
  onFirstPagesReady?: (pages: StoreFirstPage[]) => void
): Promise<StoreProductCardItem[]> {

  const allProducts:
    StoreProductCardItem[] = [];

  let cursor:
    StoreProductsCursor | null =
      null;


  while (true) {
    const page =
      await fetchPublishedStoreProducts(
        cursor,
        onFirstPagesReady
      );


    allProducts.push(
      ...page.items
    );


    if (
      !page.hasMore ||
      !page.nextCursor
    ) {
      break;
    }


    cursor =
      page.nextCursor;
  }


  return allProducts;
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

  const thumbnailUrl =
    row.thumbnail_path
      ? getPublicStoreMediaUrl(
          STORE_MEDIA_BUCKETS.thumbnails,
          row.thumbnail_path
        )
      : null;



  const creatorAvatarMap =
    await fetchStoreCreatorAvatarMap(
      [
        row.creator_user_id,
      ]
    );

  const creatorAvatarRemoteUrl =
    creatorAvatarMap.get(
      row.creator_user_id
    ) ?? null;


  const creatorAvatarUrl =
    await cacheCreatorAvatarLocally(
      row.creator_user_id,
      creatorAvatarRemoteUrl
    );

  return {
    id:
      row.id,

    creatorUserId:
      row.creator_user_id,

    creatorAvatarUrl,

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

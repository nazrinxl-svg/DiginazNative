import { supabase } from "./supabase";

export const STORE_MEDIA_BUCKETS = {
  thumbnails: "store-thumbnails",
  productFiles: "store-product-files",
  productOriginals: "store-product-originals",
  chatFiles: "store-chat-files",
  profileAvatars: "profile-avatars",
} as const;

export type StoreMediaBucket =
  typeof STORE_MEDIA_BUCKETS[
    keyof typeof STORE_MEDIA_BUCKETS
  ];

export type StorePublicMediaBucket =
  | typeof STORE_MEDIA_BUCKETS.thumbnails
  | typeof STORE_MEDIA_BUCKETS.profileAvatars;

export type StorePrivateMediaBucket =
  | typeof STORE_MEDIA_BUCKETS.productFiles
  | typeof STORE_MEDIA_BUCKETS.productOriginals
  | typeof STORE_MEDIA_BUCKETS.chatFiles;

export type StoreMediaKind =
  | "image"
  | "pdf"
  | "video"
  | "attachment"
  | "avatar";

export type StoreMediaVariant =
  | "original"
  | "thumbnail"
  | "preview"
  | "page"
  | "processed";

export type StoreMediaStatus =
  | "uploading"
  | "processing"
  | "ready"
  | "failed"
  | "archived"
  | "deleted";

export type StoreMediaVisibility =
  | "public_preview"
  | "private";

export type StoreProductMediaRole =
  | "thumbnail"
  | "preview"
  | "page"
  | "original";

export const STORE_MEDIA_SIGNED_URL_TTL = {
  previewSeconds: 3600,
  pdfViewerSeconds: 300,
  downloadSeconds: 300,
  chatSeconds: 3600,
} as const;

function safeStorageSegment(
  value: string
) {
  return value
    .trim()
    .replace(
      /[^a-zA-Z0-9._-]/g,
      "-"
    )
    .replace(
      /-+/g,
      "-"
    );
}

export function safeStoreMediaFileName(
  value: string
) {
  return value
    .replace(
      /[^a-zA-Z0-9._-]/g,
      "-"
    )
    .replace(
      /-+/g,
      "-"
    );
}

function safeExtension(
  value: string,
  fallback: string
) {
  const clean =
    value
      .trim()
      .toLowerCase()
      .replace(
        /[^a-z0-9]/g,
        ""
      );

  return (
    clean ||
    fallback
  );
}

export function buildStoreThumbnailPath(
  userId: string,
  productId: string,
  extension: string,
  timestamp = Date.now()
) {
  return (
    `${safeStorageSegment(userId)}/` +
    `${safeStorageSegment(productId)}/` +
    `thumbnail-${timestamp}.` +
    safeExtension(
      extension,
      "jpg"
    )
  );
}

export function buildStoreProductFilePath(
  userId: string,
  productId: string,
  fileName: string,
  timestamp = Date.now()
) {
  return (
    `${safeStorageSegment(userId)}/` +
    `${safeStorageSegment(productId)}/` +
    `file-${timestamp}-` +
    safeStoreMediaFileName(
      fileName
    )
  );
}

export function buildStoreProductOriginalPath(
  userId: string,
  productId: string,
  fileName: string,
  batchId = Date.now()
) {
  return (
    `${safeStorageSegment(userId)}/` +
    `${safeStorageSegment(productId)}/` +
    `original-${batchId}-` +
    safeStoreMediaFileName(
      fileName
    )
  );
}

export function buildStoreProductPagePath(
  userId: string,
  productId: string,
  pageNumber: number,
  batchId: number,
  fileName: string
) {
  const safePageNumber =
    Math.max(
      1,
      Math.trunc(
        pageNumber
      )
    );

  return (
    `${safeStorageSegment(userId)}/` +
    `${safeStorageSegment(productId)}/pages/` +
    `page-${String(
      safePageNumber
    ).padStart(
      3,
      "0"
    )}-${batchId}-` +
    safeStoreMediaFileName(
      fileName
    )
  );
}

export function getPublicStoreMediaUrl(
  bucket: StorePublicMediaBucket,
  storagePath: string
): string | null {
  const cleanPath =
    storagePath.trim();

  if (!cleanPath) {
    return null;
  }

  const { data } =
    supabase.storage
      .from(bucket)
      .getPublicUrl(
        cleanPath
      );

  return (
    data.publicUrl ||
    null
  );
}

export async function createPrivateStoreMediaSignedUrl(
  bucket: StorePrivateMediaBucket,
  storagePath: string,
  expiresInSeconds: number
): Promise<string | null> {
  const cleanPath =
    storagePath.trim();

  if (!cleanPath) {
    return null;
  }

  const ttl =
    Math.max(
      1,
      Math.trunc(
        expiresInSeconds
      )
    );

  const {
    data,
    error,
  } =
    await supabase.storage
      .from(bucket)
      .createSignedUrl(
        cleanPath,
        ttl
      );

  if (error) {
    throw error;
  }

  return (
    data?.signedUrl ||
    null
  );
}
export type RegisterStoreProductMediaAssetInput = {
  ownerUserId: string;
  productId: string;
  bucket: StoreMediaBucket;
  storagePath: string;
  mediaKind: StoreMediaKind;
  variant: StoreMediaVariant;
  mimeType: string;
  sizeBytes?: number | null;
  visibility: StoreMediaVisibility;
  role: StoreProductMediaRole;
  sortOrder?: number;
  metadata?: Record<string, unknown>;
};

export async function registerStoreProductMediaAsset(
  input: RegisterStoreProductMediaAssetInput
): Promise<string> {
  const {
    data: asset,
    error: assetError,
  } = await supabase
    .from("media_assets")
    .insert({
      owner_user_id:
        input.ownerUserId,
      bucket:
        input.bucket,
      storage_path:
        input.storagePath,
      media_kind:
        input.mediaKind,
      variant:
        input.variant,
      mime_type:
        input.mimeType.trim() ||
        "application/octet-stream",
      size_bytes:
        input.sizeBytes == null
          ? null
          : Math.max(
              0,
              Math.trunc(
                input.sizeBytes
              )
            ),
      status:
        "ready",
      visibility:
        input.visibility,
      metadata:
        input.metadata ?? {},
    })
    .select("id")
    .single();

  if (assetError) {
    throw assetError;
  }

  const assetId =
    String(
      asset?.id ?? ""
    );

  if (!assetId) {
    throw new Error(
      "Media asset ID tidak tersedia."
    );
  }

  const {
    error: linkError,
  } = await supabase
    .from("store_product_media")
    .insert({
      product_id:
        input.productId,
      media_asset_id:
        assetId,
      role:
        input.role,
      sort_order:
        Math.max(
          0,
          Math.trunc(
            input.sortOrder ?? 0
          )
        ),
    });

  if (linkError) {
    const {
      error: rollbackError,
    } = await supabase
      .from("media_assets")
      .delete()
      .eq(
        "id",
        assetId
      );

    if (rollbackError) {
      console.warn(
        "Rollback media asset gagal:",
        rollbackError
      );
    }

    throw linkError;
  }

  return assetId;
}

export async function rollbackStoreProductMediaAssets(
  productId: string,
  mediaAssetIds: string[]
): Promise<void> {
  const cleanIds =
    Array.from(
      new Set(
        mediaAssetIds
          .map(id => id.trim())
          .filter(Boolean)
      )
    );

  if (cleanIds.length === 0) {
    return;
  }

  const {
    error: linkDeleteError,
  } = await supabase
    .from("store_product_media")
    .delete()
    .eq(
      "product_id",
      productId
    )
    .in(
      "media_asset_id",
      cleanIds
    );

  if (linkDeleteError) {
    throw linkDeleteError;
  }

  const {
    error: assetDeleteError,
  } = await supabase
    .from("media_assets")
    .delete()
    .in(
      "id",
      cleanIds
    );

  if (assetDeleteError) {
    throw assetDeleteError;
  }
}
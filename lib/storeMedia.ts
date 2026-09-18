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

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

export const STORE_MEDIA_UPLOAD_LIMITS = {
  maxImagePages: 15,
  thumbnailBytes: 2 * 1024 * 1024,
  productFileBytes: 50 * 1024 * 1024,
  productOriginalBytes: 50 * 1024 * 1024,
} as const;

export type StoreMediaUploadSizeLimitKey =
  | "thumbnailBytes"
  | "productFileBytes"
  | "productOriginalBytes";

export function assertStoreMediaUploadSize(
  sizeBytes: number,
  limitKey: StoreMediaUploadSizeLimitKey,
  label: string
) {
  const safeSizeBytes =
    Math.max(
      0,
      Math.trunc(sizeBytes)
    );

  const limitBytes =
    STORE_MEDIA_UPLOAD_LIMITS[
      limitKey
    ];

  if (
    safeSizeBytes >
    limitBytes
  ) {
    const limitMb =
      Math.round(
        limitBytes /
          (1024 * 1024)
      );

    throw new Error(
      `${label} maksimal ${limitMb} MB.`
    );
  }
}

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

export type StagedStoreProductMediaChange = {
  productId: string;
  role: StoreProductMediaRole;
  sortOrder: number;
  newMediaAssetId: string | null;
  previousMediaAssetId: string | null;
  linkId: string | null;
};

export async function stageStoreProductMediaReplacement(
  input: RegisterStoreProductMediaAssetInput
): Promise<StagedStoreProductMediaChange> {
  const sortOrder =
    Math.max(
      0,
      Math.trunc(
        input.sortOrder ?? 0
      )
    );

  const {
    data: currentLink,
    error: currentLinkError,
  } = await supabase
    .from("store_product_media")
    .select(
      "id,media_asset_id"
    )
    .eq(
      "product_id",
      input.productId
    )
    .eq(
      "role",
      input.role
    )
    .eq(
      "sort_order",
      sortOrder
    )
    .maybeSingle();

  if (currentLinkError) {
    throw currentLinkError;
  }

  const previousMediaAssetId =
    currentLink?.media_asset_id
      ? String(
          currentLink.media_asset_id
        )
      : null;

  const {
    data: newAsset,
    error: newAssetError,
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

  if (newAssetError) {
    throw newAssetError;
  }

  const newMediaAssetId =
    String(
      newAsset?.id ?? ""
    );

  if (!newMediaAssetId) {
    throw new Error(
      "Media asset replacement ID tidak tersedia."
    );
  }

  let linkId =
    currentLink?.id
      ? String(
          currentLink.id
        )
      : "";

  try {
    if (linkId) {
      const {
        data: updatedLink,
        error: updateLinkError,
      } = await supabase
        .from("store_product_media")
        .update({
          media_asset_id:
            newMediaAssetId,
        })
        .eq(
          "id",
          linkId
        )
        .eq(
          "product_id",
          input.productId
        )
        .select("id")
        .single();

      if (updateLinkError) {
        throw updateLinkError;
      }

      linkId =
        String(
          updatedLink?.id ?? ""
        );
    } else {
      const {
        data: insertedLink,
        error: insertLinkError,
      } = await supabase
        .from("store_product_media")
        .insert({
          product_id:
            input.productId,
          media_asset_id:
            newMediaAssetId,
          role:
            input.role,
          sort_order:
            sortOrder,
        })
        .select("id")
        .single();

      if (insertLinkError) {
        throw insertLinkError;
      }

      linkId =
        String(
          insertedLink?.id ?? ""
        );
    }

    if (!linkId) {
      throw new Error(
        "Media link replacement ID tidak tersedia."
      );
    }
  }
  catch (error) {
    const {
      error: cleanupAssetError,
    } = await supabase
      .from("media_assets")
      .delete()
      .eq(
        "id",
        newMediaAssetId
      );

    if (cleanupAssetError) {
      console.warn(
        "Cleanup replacement asset gagal:",
        cleanupAssetError
      );
    }

    throw error;
  }

  return {
    productId:
      input.productId,
    role:
      input.role,
    sortOrder,
    newMediaAssetId,
    previousMediaAssetId,
    linkId,
  };
}

export async function stageStoreProductMediaRemoval(
  productId: string,
  role: StoreProductMediaRole,
  sortOrder = 0
): Promise<StagedStoreProductMediaChange | null> {
  const safeSortOrder =
    Math.max(
      0,
      Math.trunc(
        sortOrder
      )
    );

  const {
    data: currentLink,
    error: currentLinkError,
  } = await supabase
    .from("store_product_media")
    .select(
      "id,media_asset_id"
    )
    .eq(
      "product_id",
      productId
    )
    .eq(
      "role",
      role
    )
    .eq(
      "sort_order",
      safeSortOrder
    )
    .maybeSingle();

  if (currentLinkError) {
    throw currentLinkError;
  }

  if (
    !currentLink?.id ||
    !currentLink?.media_asset_id
  ) {
    return null;
  }

  const previousMediaAssetId =
    String(
      currentLink.media_asset_id
    );

  const {
    error: deleteLinkError,
  } = await supabase
    .from("store_product_media")
    .delete()
    .eq(
      "id",
      String(
        currentLink.id
      )
    )
    .eq(
      "product_id",
      productId
    );

  if (deleteLinkError) {
    throw deleteLinkError;
  }

  return {
    productId,
    role,
    sortOrder:
      safeSortOrder,
    newMediaAssetId:
      null,
    previousMediaAssetId,
    linkId:
      null,
  };
}

export async function rollbackStagedStoreProductMediaChange(
  change: StagedStoreProductMediaChange
): Promise<void> {
  if (
    change.newMediaAssetId &&
    change.previousMediaAssetId &&
    change.linkId
  ) {
    const {
      error: restoreLinkError,
    } = await supabase
      .from("store_product_media")
      .update({
        media_asset_id:
          change.previousMediaAssetId,
      })
      .eq(
        "id",
        change.linkId
      )
      .eq(
        "product_id",
        change.productId
      );

    if (restoreLinkError) {
      throw restoreLinkError;
    }
  } else if (
    change.newMediaAssetId &&
    change.linkId
  ) {
    const {
      error: deleteLinkError,
    } = await supabase
      .from("store_product_media")
      .delete()
      .eq(
        "id",
        change.linkId
      )
      .eq(
        "product_id",
        change.productId
      );

    if (deleteLinkError) {
      throw deleteLinkError;
    }
  } else if (
    change.previousMediaAssetId
  ) {
    const {
      error: restoreRemovedLinkError,
    } = await supabase
      .from("store_product_media")
      .insert({
        product_id:
          change.productId,
        media_asset_id:
          change.previousMediaAssetId,
        role:
          change.role,
        sort_order:
          change.sortOrder,
      });

    if (restoreRemovedLinkError) {
      throw restoreRemovedLinkError;
    }
  }

  if (change.newMediaAssetId) {
    const {
      error: deleteNewAssetError,
    } = await supabase
      .from("media_assets")
      .delete()
      .eq(
        "id",
        change.newMediaAssetId
      );

    if (deleteNewAssetError) {
      throw deleteNewAssetError;
    }
  }
}

export async function finalizeStagedStoreProductMediaChange(
  change: StagedStoreProductMediaChange
): Promise<void> {
  const previousMediaAssetId =
    change.previousMediaAssetId;

  if (
    !previousMediaAssetId ||
    previousMediaAssetId ===
      change.newMediaAssetId
  ) {
    return;
  }

  const {
    data: remainingLinks,
    error: remainingLinksError,
  } = await supabase
    .from("store_product_media")
    .select("id")
    .eq(
      "media_asset_id",
      previousMediaAssetId
    )
    .limit(1);

  if (remainingLinksError) {
    throw remainingLinksError;
  }

  if (
    (remainingLinks ?? [])
      .length > 0
  ) {
    return;
  }

  const {
    error: deleteOldAssetError,
  } = await supabase
    .from("media_assets")
    .delete()
    .eq(
      "id",
      previousMediaAssetId
    );

  if (deleteOldAssetError) {
    throw deleteOldAssetError;
  }
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
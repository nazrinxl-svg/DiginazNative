import { supabase } from "./supabase";

export type MediaObservabilityEventType =
  | "upload_success"
  | "upload_failed"
  | "processing_failed"
  | "download_success"
  | "download_failed"
  | "signed_url_failed"
  | "cache_hit"
  | "cache_miss";

export type MediaObservabilityScope =
  | "store_product"
  | "chat_attachment"
  | "avatar";

type TrackMediaObservabilityEventInput = {
  eventType: MediaObservabilityEventType;
  mediaScope: MediaObservabilityScope;
  productId?: string | null;
  bucket?: string | null;
  storagePath?: string | null;
  bytesTransferred?: number;
  latencyMs?: number | null;
  source?: string;
  metadata?: Record<string, unknown>;
};

function normalizeNonNegativeInteger(
  value: number | null | undefined
) {
  const numeric =
    Number(value ?? 0);

  if (
    !Number.isFinite(numeric) ||
    numeric <= 0
  ) {
    return 0;
  }

  return Math.trunc(numeric);
}

export async function trackMediaObservabilityEvent(
  input: TrackMediaObservabilityEventInput
) {
  try {
    const {
      error,
    } = await supabase
      .from("media_observability_events")
      .insert({
        product_id:
          input.productId ?? null,
        event_type:
          input.eventType,
        media_scope:
          input.mediaScope,
        bucket:
          input.bucket?.trim() || null,
        storage_path:
          input.storagePath?.trim() || null,
        bytes_transferred:
          normalizeNonNegativeInteger(
            input.bytesTransferred
          ),
        latency_ms:
          input.latencyMs == null
            ? null
            : Math.min(
                2147483647,
                normalizeNonNegativeInteger(
                  input.latencyMs
                )
              ),
        source:
          (
            input.source?.trim() ||
            "mobile"
          ).slice(0, 50),
        metadata:
          input.metadata ?? {},
      });

    if (error) {
      console.warn(
        "[MEDIA_OBSERVABILITY][INSERT_FAILED]",
        input.eventType,
        error
      );
    }
  } catch (error) {
    console.warn(
      "[MEDIA_OBSERVABILITY][TRACK_FAILED]",
      input.eventType,
      error
    );
  }
}

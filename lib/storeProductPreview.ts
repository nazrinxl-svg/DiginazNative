import { Image } from "react-native";
import { supabase } from "./supabase";

export function logA4(
  event: string,
  productId: string,
  fields: Record<string, string | number | boolean> = {}
) {
  if (__DEV__) {
    console.log("[A4]", JSON.stringify({
      event, productId, at: Date.now(), ...fields,
    }));
  }
}

type PageUrlEntry = {
  url: string | null;
  expiresAt: number;
  pending: Promise<string | null> | null;
  warm: Promise<void> | null;
};

/*
 * One instance per StoreHome (already keyed by authenticated user ID).
 * Keep signed URLs in memory only; App and Detail share pending requests.
 * The storage path is part of the key so an edited page gets a new entry.
 */
export function createStoreProductPreviewSession() {
  const entries = new Map<string, PageUrlEntry>();
  const lifetimeSeconds = 3600;

  function key(productId: string, path: string) {
    return JSON.stringify([productId, path]);
  }

  function peek(productId: string, path?: string | null) {
    if (!path) return null;
    const entry = entries.get(key(productId, path));
    return entry && entry.expiresAt > Date.now() ? entry.url : null;
  }

  function getUrl(
    productId: string,
    path: string,
    pageNumber = 1
  ): Promise<string | null> {
    const cacheKey = key(productId, path);
    const current = entries.get(cacheKey);
    if (current?.pending) {
      logA4("SIGN_JOIN", productId, { page: pageNumber });
      return current.pending;
    }
    const cached = peek(productId, path);
    if (cached) {
      logA4("URL_CACHE_HIT", productId, { page: pageNumber });
      return Promise.resolve(cached);
    }

    const entry: PageUrlEntry = {
      url: null, expiresAt: 0, pending: null, warm: null,
    };
    entries.set(cacheKey, entry);
    // Defer execution one microtask so every caller sees the same promise.
    entry.pending = Promise.resolve().then(async () => {
      const started = Date.now();
      logA4("SIGN_START", productId, { page: pageNumber });
      try {
        const { data, error } = await supabase.storage
          .from("store-product-files")
          .createSignedUrl(path, lifetimeSeconds);
        if (error || !data?.signedUrl) {
          logA4("SIGN_ERROR", productId, {
            page: pageNumber, ms: Date.now() - started,
          });
          return null;
        }
        entry.url = data.signedUrl;
        // Start at request time and leave a minute for clock/network margin.
        entry.expiresAt = started + (lifetimeSeconds - 60) * 1000;
        logA4("URL_READY", productId, {
          page: pageNumber, ms: Date.now() - started,
        });
        return entry.url;
      } catch {
        logA4("SIGN_ERROR", productId, {
          page: pageNumber, ms: Date.now() - started,
        });
        return null;
      } finally {
        entry.pending = null;
        // A failed attempt must not permanently block a later retry.
        if (!entry.url && entries.get(cacheKey) === entry) {
          entries.delete(cacheKey);
        }
      }
    });
    return entry.pending;
  }

  async function warm(productId: string, path: string) {
    const url = await getUrl(productId, path);
    if (!url) return;
    const entry = entries.get(key(productId, path));
    if (!entry || entry.url !== url) return;
    if (entry.warm) return entry.warm;
    entry.warm = Promise.resolve().then(async () => {
      const started = Date.now();
      logA4("PREFETCH_START", productId, { page: 1 });
      try {
        const ok = await Image.prefetch(url);
        logA4(ok ? "PREFETCH_DONE" : "PREFETCH_ERROR", productId, {
          page: 1, ms: Date.now() - started,
        });
        if (!ok) entry.warm = null;
      } catch {
        entry.warm = null;
        logA4("PREFETCH_ERROR", productId, {
          page: 1, ms: Date.now() - started,
        });
      }
    });
    return entry.warm;
  }

  return { peek, getUrl, warm };
}

export type StoreProductPreviewSession =
  ReturnType<typeof createStoreProductPreviewSession>;

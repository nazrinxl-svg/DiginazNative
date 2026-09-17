import {
  Image,
} from "react-native";

import {
  supabase,
} from "./supabase";


type PublicCreatorProfile = {
  avatar_url:
    string | null;
};


const avatarUrlCache =
  new Map<
    string,
    string | null
  >();


const avatarRequestCache =
  new Map<
    string,
    Promise<string | null>
  >();


const warmedUrls =
  new Set<string>();


export function peekCreatorAvatar(
  userId: string
) {
  const key =
    userId.trim();

  if (!key) {
    return null;
  }

  return (
    avatarUrlCache.get(
      key
    ) ??
    null
  );
}


export async function getCreatorAvatarUrl(
  userId: string
): Promise<string | null> {

  const key =
    userId.trim();

  if (!key) {
    return null;
  }


  if (
    avatarUrlCache.has(
      key
    )
  ) {
    return (
      avatarUrlCache.get(
        key
      ) ??
      null
    );
  }


  const pending =
    avatarRequestCache.get(
      key
    );

  if (pending) {
    return pending;
  }


  const request =
    (async () => {

      const {
        data,
        error,
      } =
        await supabase
          .rpc(
            "get_public_profile",
            {
              target_user_id:
                key,
            }
          )
          .maybeSingle();


      if (error) {
        throw error;
      }


      const profile =
        data as unknown as
          PublicCreatorProfile |
          null;


      const avatarUrl =
        String(
          profile?.avatar_url ??
          ""
        ).trim() ||
        null;


      avatarUrlCache.set(
        key,
        avatarUrl
      );


      return avatarUrl;
    })();


  avatarRequestCache.set(
    key,
    request
  );


  try {
    return await request;
  }
  finally {
    avatarRequestCache.delete(
      key
    );
  }
}


export async function warmCreatorAvatar(
  userId: string
) {
  const avatarUrl =
    await getCreatorAvatarUrl(
      userId
    );


  if (
    !avatarUrl ||
    warmedUrls.has(
      avatarUrl
    )
  ) {
    return avatarUrl;
  }


  try {
    await Image.prefetch(
      avatarUrl
    );

    warmedUrls.add(
      avatarUrl
    );
  }
  catch {
    /*
     * URL tetap disimpan.
     * Kegagalan prefetch tidak boleh
     * memblokir tampilan produk.
     */
  }


  return avatarUrl;
}
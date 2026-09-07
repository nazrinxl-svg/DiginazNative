import { useEffect, useState } from "react";

import { getLocalUser } from "./localAuth";
import { supabase } from "./supabase";

export function useUnreadNotificationCount() {
  const [
    unreadNotificationCount,
    setUnreadNotificationCount,
  ] = useState(0);

  useEffect(() => {
    let active = true;

    let channel:
      ReturnType<
        typeof supabase.channel
      > | null = null;

    async function startNotificationCount() {
      const {
        data: userData,
        error: userError,
      } =
        await getLocalUser();

      if (
        userError ||
        !userData.user?.id ||
        !active
      ) {
        return;
      }

      const userId =
        userData.user.id;

      async function refreshCount() {
        const {
          count,
          error,
        } =
          await supabase
            .from(
              "store_notifications"
            )
            .select(
              "id",
              {
                count: "exact",
                head: true,
              }
            )
            .eq(
              "recipient_user_id",
              userId
            )
            .is(
              "read_at",
              null
            );

        if (
          !error &&
          active
        ) {
          setUnreadNotificationCount(
            count ?? 0
          );
        }
      }

      await refreshCount();

      if (!active) {
        return;
      }

      channel =
        supabase
          .channel(
            `store-notification-count-${userId}`
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table:
                "store_notifications",
              filter:
                `recipient_user_id=eq.${userId}`,
            },
            () => {
              void refreshCount();
            }
          )
          .subscribe();
    }

    void startNotificationCount();

    return () => {
      active = false;

      if (channel) {
        void supabase.removeChannel(
          channel
        );
      }
    };
  }, []);

  return [
    unreadNotificationCount,
    setUnreadNotificationCount,
  ] as const;
}
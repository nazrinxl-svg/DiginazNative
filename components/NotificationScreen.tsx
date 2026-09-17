import React, {
  useEffect,
  useState,
} from "react";

import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  ArrowLeft,
  Bell,
  CheckCheck,
  MessageCircle,
  Star,
} from "lucide-react-native";

import {
  SafeAreaView,
} from "react-native-safe-area-context";

import {
  supabase,
} from "../lib/supabase";

type NotificationRow = {
  id: string;
  recipient_user_id: string;
  notification_type:
    | "review"
    | "review_reply"
    | "chat_message";
  product_key: string | null;
  conversation_id: string | null;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

type Props = {
  onBack: () => void;
  onOpenChat: (
    conversationId: string
  ) => void;
  onOpenProduct: (
    productId: string
  ) => void;
  onUnreadChanged: (
    count: number
  ) => void;
};

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat(
      "id-ID",
      {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }
    ).format(new Date(value));
  } catch {
    return "";
  }
}

export default function NotificationScreen({
  onBack,
  onOpenChat,
  onOpenProduct,
  onUnreadChanged,
}: Props) {
  const [
    notifications,
    setNotifications,
  ] =
    useState<NotificationRow[]>([]);

  const [
    userId,
    setUserId,
  ] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false);

  const [
    markingAll,
    setMarkingAll,
  ] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  async function loadNotifications(
    refresh = false
  ) {
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setErrorMessage("");

    try {
      const {
        data: userData,
        error: userError,
      } =
        await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      const id =
        userData.user?.id;

      if (!id) {
        throw new Error(
          "Session pengguna tidak ditemukan."
        );
      }

      setUserId(id);

      const {
        data,
        error,
      } =
        await supabase
          .from("store_notifications")
          .select(
            "id,recipient_user_id,notification_type,product_key,conversation_id,title,body,read_at,created_at"
          )
          .eq(
            "recipient_user_id",
            id
          )
          .order(
            "created_at",
            {
              ascending: false,
            }
          )
          .limit(100);

      if (error) {
        throw error;
      }

      const rows =
        (data ??
          []) as unknown as NotificationRow[];

      setNotifications(rows);

      onUnreadChanged(
        rows.filter(
          (item) =>
            !item.read_at
        ).length
      );
    } catch (error) {
      console.error(
        "Gagal memuat notifikasi:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Notifikasi belum dapat dimuat."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadNotifications();
  }, []);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const channel =
      supabase
        .channel(
          `mobile-notifications-${userId}`
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
            void loadNotifications();
          }
        )
        .subscribe();

    return () => {
      void supabase.removeChannel(
        channel
      );
    };
  }, [userId]);

  async function markRead(
    item: NotificationRow
  ) {
    if (
      item.read_at ||
      !userId
    ) {
      return;
    }

    const readAt =
      new Date().toISOString();

    const {
      error,
    } =
      await supabase
        .from("store_notifications")
        .update({
          read_at: readAt,
        })
        .eq("id", item.id)
        .eq(
          "recipient_user_id",
          userId
        );

    if (error) {
      throw error;
    }

    const next =
      notifications.map(
        (current) =>
          current.id === item.id
            ? {
                ...current,
                read_at: readAt,
              }
            : current
      );

    setNotifications(next);

    onUnreadChanged(
      next.filter(
        (current) =>
          !current.read_at
      ).length
    );
  }

  function handlePress(
    item: NotificationRow
  ) {
    /*
     * Navigasi harus langsung merespons tap.
     * Update read_at berjalan di belakang.
     */
    void markRead(item).catch(
      error => {
        console.warn(
          "Tandai dibaca gagal:",
          error
        );
      }
    );

    if (item.conversation_id) {
      onOpenChat(
        item.conversation_id
      );
      return;
    }

    if (item.product_key) {
      onOpenProduct(
        item.product_key
      );
    }
  }

  async function markAllRead() {
    if (
      !userId ||
      markingAll
    ) {
      return;
    }

    const unread =
      notifications.some(
        (item) =>
          !item.read_at
      );

    if (!unread) {
      return;
    }

    setMarkingAll(true);

    try {
      const readAt =
        new Date().toISOString();

      const {
        error,
      } =
        await supabase
          .from("store_notifications")
          .update({
            read_at: readAt,
          })
          .eq(
            "recipient_user_id",
            userId
          )
          .is(
            "read_at",
            null
          );

      if (error) {
        throw error;
      }

      setNotifications(
        (current) =>
          current.map(
            (item) => ({
              ...item,
              read_at:
                item.read_at ??
                readAt,
            })
          )
      );

      onUnreadChanged(0);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Gagal memperbarui notifikasi."
      );
    } finally {
      setMarkingAll(false);
    }
  }

  const unreadCount =
    notifications.filter(
      (item) =>
        !item.read_at
    ).length;

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={["top"]}
    >
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#FFFFFF"
      />

      <View style={styles.header}>
        <Pressable
          onPress={onBack}
          style={styles.headerButton}
          hitSlop={8}
        >
          <ArrowLeft
            size={20}
            color="#0F172A"
          />
        </Pressable>

        <View style={styles.headerText}>
          <Text style={styles.title}>
            Notifikasi
          </Text>

          <Text style={styles.subtitle}>
            {unreadCount > 0
              ? `${unreadCount} belum dibaca`
              : "Semua sudah dibaca"}
          </Text>
        </View>

        <Pressable
          onPress={() =>
            void markAllRead()
          }
          hitSlop={8}
          disabled={
            unreadCount === 0 ||
            markingAll
          }
          style={[
            styles.headerButton,
            (
              unreadCount === 0 ||
              markingAll
            ) &&
              styles.disabled,
          ]}
        >
          {markingAll ? (
            <ActivityIndicator
              size="small"
              color="#2563EB"
            />
          ) : (
            <CheckCheck
              size={20}
              color="#2563EB"
            />
          )}
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator
            size="small"
            color="#2563EB"
          />
          <Text style={styles.stateText}>
            Memuat notifikasi...
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={
            styles.content
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() =>
                void loadNotifications(
                  true
                )
              }
            />
          }
        >
          {errorMessage ? (
            <Text
              style={styles.errorText}
            >
              {errorMessage}
            </Text>
          ) : null}

          {notifications.length ===
          0 ? (
            <View style={styles.empty}>
              <Bell
                size={32}
                color="#2563EB"
              />

              <Text
                style={styles.emptyTitle}
              >
                Belum ada notifikasi
              </Text>

              <Text
                style={styles.emptyText}
              >
                Pesan, ulasan, dan
                balasan baru akan muncul
                di sini.
              </Text>
            </View>
          ) : (
            notifications.map(
              (item) => (
                <Pressable
                  key={item.id}
                  onPress={() =>
                    void handlePress(
                      item
                    )
                  }
                  style={[
                    styles.item,
                    !item.read_at &&
                      styles.itemUnread,
                  ]}
                >
                  <View
                    style={
                      styles.itemIcon
                    }
                  >
                    {item.notification_type ===
                    "chat_message" ? (
                      <MessageCircle
                        size={19}
                        color="#2563EB"
                      />
                    ) : (
                      <Star
                        size={19}
                        color="#2563EB"
                      />
                    )}
                  </View>

                  <View
                    style={
                      styles.itemContent
                    }
                  >
                    <View
                      style={
                        styles.itemTop
                      }
                    >
                      <Text
                        style={
                          styles.itemTitle
                        }
                      >
                        {item.title}
                      </Text>

                      {!item.read_at ? (
                        <View
                          style={
                            styles.unreadDot
                          }
                        />
                      ) : null}
                    </View>

                    {item.body ? (
                      <Text
                        style={
                          styles.itemBody
                        }
                        numberOfLines={3}
                      >
                        {item.body}
                      </Text>
                    ) : null}

                    <Text
                      style={
                        styles.itemDate
                      }
                    >
                      {formatDate(
                        item.created_at
                      )}
                    </Text>
                  </View>
                </Pressable>
              )
            )
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  header: {
    minHeight: 66,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },

  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },

  disabled: {
    opacity: 0.4,
  },

  headerText: {
    flex: 1,
  },

  title: {
    fontFamily:
      "PlusJakartaSans_700Bold",
    fontSize: 14,
    color: "#0F172A",
  },

  subtitle: {
    marginTop: 2,
    fontFamily:
      "PlusJakartaSans_400Regular",
    fontSize: 12,
    color: "#64748B",
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },

  stateText: {
    fontFamily:
      "PlusJakartaSans_400Regular",
    fontSize: 12,
    color: "#64748B",
  },

  content: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 40,
    backgroundColor: "#FFFFFF",
  },

  errorText: {
    marginBottom: 12,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#FEF2F2",
    color: "#B91C1C",
    fontSize: 12,
  },

  empty: {
    marginTop: 90,
    alignItems: "center",
    gap: 8,
  },

  emptyTitle: {
    marginTop: 6,
    fontFamily:
      "PlusJakartaSans_700Bold",
    fontSize: 13,
    color: "#0F172A",
  },

  emptyText: {
    maxWidth: 240,
    textAlign: "center",
    fontFamily:
      "PlusJakartaSans_400Regular",
    fontSize: 12,
    lineHeight: 16,
    color: "#64748B",
  },

  item: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 0,
    paddingVertical: 14,
    paddingHorizontal: 0,
    borderRadius: 0,
    borderWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
    backgroundColor: "#FFFFFF",
  },

  itemUnread: {
    backgroundColor: "#F8FBFF",
  },

  itemIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EFF6FF",
  },

  itemContent: {
    flex: 1,
  },

  itemTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },

  itemTitle: {
    flex: 1,
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    lineHeight: 18,
    color: "#0F172A",
  },

  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginTop: 4,
    backgroundColor: "#2563EB",
  },

  itemBody: {
    marginTop: 3,
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    lineHeight: 18,
    color: "#64748B",
  },

  itemDate: {
    marginTop: 4,
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    color: "#94A3B8",
  },
});


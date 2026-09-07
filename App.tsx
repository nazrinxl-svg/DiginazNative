import { useUnreadNotificationCount } from "./lib/useUnreadNotificationCount";
import React, { useEffect, useState } from "react";
import {
  BackHandler,
  ActivityIndicator,
  Dimensions,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import {
  Bell,
  BookOpen,
  Home,
  MessageCircle,
  Plus,
  Search,
  Star,
  UserRound,
} from "lucide-react-native";

import type { Session } from "@supabase/supabase-js";
import AuthScreen from "./components/AuthScreen";
import ProductDetailScreen from "./components/ProductDetailScreen";
import ChatScreen from "./components/ChatScreen";
import ChatInboxScreen from "./components/ChatInboxScreen";
import NotificationScreen from "./components/NotificationScreen";
import ProfileScreen from "./components/ProfileScreen";
import UploadProductScreen from "./components/UploadProductScreen";
import { supabase } from "./lib/supabase";
import {
  fetchPublishedStoreProductById,
  fetchPublishedStoreProducts,
  type StoreProductCardItem,
} from "./lib/storeProducts";
import {
  readStoreProductsCache,
  writeStoreProductsCache,
} from "./lib/storeProductCache";

const SCREEN_WIDTH = Dimensions.get("window").width;
const HORIZONTAL_PADDING = 16;
const CARD_GAP = 12;
const CARD_WIDTH =
  (SCREEN_WIDTH - HORIZONTAL_PADDING * 2 - CARD_GAP) / 2;

function ProductCard({
  product,
  onPress,
}: {
  product: StoreProductCardItem;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={styles.productCard}
      onPress={onPress}
    >
      <View style={styles.thumbnail}>
        {product.thumbnailUrl ? (
          <Image
            source={{ uri: product.thumbnailUrl }}
            style={styles.thumbnailImage}
            resizeMode="cover"
          />
        ) : (
          <BookOpen
            size={34}
            color="#8FA8D8"
            strokeWidth={1.4}
          />
        )}

        <View style={styles.thumbnailBadge}>
          <Text style={styles.thumbnailBadgeText}>
            {product.type}
          </Text>
        </View>
      </View>

      <View style={styles.productContent}>
        <Text
          style={styles.productMeta}
          numberOfLines={1}
        >
          {product.subject} ? {product.level}
        </Text>

        <Text
          style={styles.productTitle}
          numberOfLines={2}
        >
          {product.title}
        </Text>

        <Text
          style={styles.productAuthor}
          numberOfLines={1}
        >
          Oleh {product.author}
        </Text>

        <View style={styles.productFooter}>
          <View style={styles.ratingRow}>
            <Star
              size={12}
              color="#F3B63F"
              fill="#F3B63F"
              strokeWidth={1.5}
            />

            <Text style={styles.ratingText}>
              {product.reviewCount > 0
                ? product.rating
                : "Baru"}
            </Text>
          </View>

          <Text
            style={[
              styles.price,
              product.price === "Gratis" &&
                styles.freePrice,
            ]}
          >
            {product.price}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function BottomNavigation({
  onChatPress,
  onUploadPress,
  onNotificationPress,
  onProfilePress,
  unreadNotificationCount,
}: {
  onChatPress: () => void;
  onUploadPress: () => void;
  onNotificationPress: () => void;
  onProfilePress: () => void;
  unreadNotificationCount: number;
}) {
  return (
    <View style={styles.bottomNav}>
      <Pressable style={styles.navItem}>
        <Home
          size={21}
          color="#2563EB"
          strokeWidth={2}
        />
        <Text
          style={[
            styles.navLabel,
            styles.navLabelActive,
          ]}
        >
          Store
        </Text>
      </Pressable>

      <Pressable
        style={styles.navItem}
        onPress={onChatPress}
      >
        <MessageCircle
          size={21}
          color="#94A3B8"
          strokeWidth={1.8}
        />
        <Text style={styles.navLabel}>Chat</Text>
      </Pressable>

      <Pressable
        style={styles.navItem}
        onPress={onUploadPress}
      >
        <Plus
          size={21}
          color="#94A3B8"
          strokeWidth={1.8}
        />
        <Text style={styles.navLabel}>
          Upload
        </Text>
      </Pressable>

      <Pressable
        style={styles.navItem}
        onPress={
          onNotificationPress
        }
      >
        <View
          style={
            styles.navIconWrap
          }
        >
          <Bell
            size={21}
            color="#94A3B8"
            strokeWidth={1.8}
          />

          {unreadNotificationCount >
          0 ? (
            <View
              style={styles.navBadge}
            >
              <Text
                style={
                  styles.navBadgeText
                }
              >
                {unreadNotificationCount >
                9
                  ? "9+"
                  : unreadNotificationCount}
              </Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.navLabel}>Notifikasi</Text>
      </Pressable>

      <Pressable
        style={styles.navItem}
        onPress={onProfilePress}
      >
        <UserRound
          size={21}
          color="#94A3B8"
          strokeWidth={1.8}
        />
        <Text style={styles.navLabel}>
          Profil
        </Text>
      </Pressable>
    </View>
  );
}

function StoreHome() {
  const [products, setProducts] =
    useState<StoreProductCardItem[]>([]);

  const [searchQuery, setSearchQuery] =
    useState("");

  const [loadingProducts, setLoadingProducts] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [storeError, setStoreError] =
    useState("");

  const [showUpload, setShowUpload] =
    useState(false);

  const [
    editingProductId,
    setEditingProductId,
  ] = useState<string | null>(null);

  const [showProfile, setShowProfile] =
    useState(false);

  const [
    showChatInbox,
    setShowChatInbox,
  ] = useState(false);

  const [
    showNotifications,
    setShowNotifications,
  ] = useState(false);

  const [
    unreadNotificationCount,
    setUnreadNotificationCount,
  ] = useUnreadNotificationCount();

  const [selectedProduct, setSelectedProduct] =
    useState<StoreProductCardItem | null>(null);

  const [selectedConversationId, setSelectedConversationId] =
    useState<string | null>(null);
  // ANDROID_SYSTEM_BACK_NAV
  useEffect(() => {
    const subscription =
      BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
        if (selectedConversationId) {
          setSelectedConversationId(null);
          return true;
        }
        if (editingProductId) {
          setEditingProductId(null);
          return true;
        }
        if (selectedProduct) {
          setSelectedProduct(null);
          return true;
        }
        if (showChatInbox) {
          setShowChatInbox(false);
          return true;
        }
        if (showNotifications) {
          setShowNotifications(false);
          return true;
        }
        if (showProfile) {
          setShowProfile(false);
          return true;
        }
        if (showUpload) {
          setShowUpload(false);
          return true;
        }
          return true;
        }
      );

    return () => {
      subscription.remove();
    };
  }, [selectedConversationId, editingProductId, selectedProduct, showChatInbox, showNotifications, showProfile, showUpload]);


  async function loadProducts(
    isRefresh = false
  ) {
    let hasCachedProducts = false;

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoadingProducts(true);

      const cachedProducts =
        await readStoreProductsCache();

      if (
        cachedProducts &&
        cachedProducts.length > 0
      ) {
        hasCachedProducts = true;

        setProducts(
          cachedProducts
        );

        setLoadingProducts(false);
      }
    }

    setStoreError("");

    try {
      const mappedProducts =
        await fetchPublishedStoreProducts();

      setProducts(
        mappedProducts
      );

      await writeStoreProductsCache(
        mappedProducts
      );
    } catch (error) {
      console.error(
        "Gagal memuat produk Store:",
        error
      );

      if (!hasCachedProducts) {
        setStoreError(
          error instanceof Error
            ? error.message
            : "Gagal memuat produk."
        );
      }
    } finally {
      setLoadingProducts(false);
      setRefreshing(false);
    }
  }
  useEffect(() => {
    loadProducts(false);
  }, []);

  const normalizedQuery =
    searchQuery.trim().toLowerCase();

  const visibleProducts =
    normalizedQuery.length === 0
      ? products
      : products.filter((product) =>
          [
            product.title,
            product.type,
            product.subject,
            product.level,
            product.author,
          ].some((value) =>
            value
              .toLowerCase()
              .includes(normalizedQuery)
          )
        );

  async function openNotificationProduct(
    productId: string
  ) {
    const cached =
      products.find(
        (item) =>
          item.id === productId
      );

    if (cached) {
      setSelectedProduct(
        cached
      );
      return;
    }

    try {
      const product =
        await fetchPublishedStoreProductById(
          productId
        );

      setSelectedProduct(
        product
      );
    } catch (error) {
      console.error(
        "Produk dari notifikasi gagal dibuka:",
        error
      );

      setStoreError(
        "Produk dari notifikasi tidak tersedia."
      );
    }
  }
  if (showProfile) {
    return (
      <ProfileScreen
        onBack={() =>
          setShowProfile(false)
        }
      />
    );
  }

  if (selectedConversationId) {
    return (
      <ChatScreen
        conversationId={
          selectedConversationId
        }
        onBack={() =>
          setSelectedConversationId(
            null
          )
        }
      />
    );
  }

  if (showChatInbox) {
    return (
      <ChatInboxScreen
        onBack={() =>
          setShowChatInbox(false)
        }
        onOpenChat={(
          conversationId
        ) =>
          setSelectedConversationId(
            conversationId
          )
        }
      />
    );
  }

  if (showNotifications) {
    return (
      <NotificationScreen
        onBack={() =>
          setShowNotifications(
            false
          )
        }
        onUnreadChanged={
          setUnreadNotificationCount
        }
        onOpenChat={(
          conversationId
        ) => {
          setShowNotifications(
            false
          );

          setSelectedConversationId(
            conversationId
          );
        }}
        onOpenProduct={(
          productId
        ) => {
          setShowNotifications(
            false
          );

          void openNotificationProduct(
            productId
          );
        }}
      />
    );
  }

  if (selectedProduct) {
    return (
      <ProductDetailScreen
        product={selectedProduct}
        onBack={() =>
          setSelectedProduct(null)
        }
        onEditProduct={() => {
          setEditingProductId(
            selectedProduct.id
          );
          setSelectedProduct(null);
        }}
        onProductChanged={() => {
          setSelectedProduct(null);
          void loadProducts(false);
        }}
        onOpenChat={(
          conversationId
        ) =>
          setSelectedConversationId(
            conversationId
          )
        }
      />
    );
  }

  if (editingProductId) {
    return (
      <UploadProductScreen
        editProductId={
          editingProductId
        }
        onClose={() =>
          setEditingProductId(null)
        }
        onUploaded={() => {
          setEditingProductId(null);
          void loadProducts(false);
        }}
      />
    );
  }

  if (showUpload) {
    return (
      <UploadProductScreen
        onClose={() =>
          setShowUpload(false)
        }
        onUploaded={() => {
          setShowUpload(false);
          loadProducts(false);
        }}
      />
    );
  }

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={["top"]}
    >
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#F8FAFC"
      />

      <View style={styles.screen}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={
            styles.scrollContent
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() =>
                loadProducts(true)
              }
            />
          }
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.brand}>
                Diginaz Store
              </Text>

              <Text style={styles.brandSubtitle}>
                Media pembelajaran dari guru untuk guru
              </Text>
            </View>

            <View style={styles.headerActions}>
              <Pressable style={styles.iconButton}
                onPress={() =>
                  setShowNotifications(
                    true
                  )
                }>
                <Bell
                  size={19}
                  color="#334155"
                  strokeWidth={1.8}
                />

                {unreadNotificationCount >
                0 ? (
                  <View
                    style={
                      styles.notificationDot
                    }
                  />
                ) : null}
              </Pressable>

              <Pressable style={styles.avatarButton}>
                <Text style={styles.avatarText}>
                  N
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.searchBox}>
            <Search
              size={18}
              color="#94A3B8"
              strokeWidth={1.8}
            />

            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Cari produk Diginaz... LIVE"
              placeholderTextColor="#94A3B8"
              returnKeyType="search"
              autoCorrect={false}
            />
          </View>

          {loadingProducts ? (
            <View style={styles.storeStatus}>
              <ActivityIndicator
                size="small"
                color="#2563EB"
              />

              <Text style={styles.storeStatusText}>
                Memuat produk...
              </Text>
            </View>
          ) : storeError ? (
            <View style={styles.storeStatus}>
              <Text style={styles.storeErrorText}>
                Produk belum dapat dimuat.
              </Text>

              <Pressable
                style={styles.retryButton}
                onPress={() =>
                  loadProducts(false)
                }
              >
                <Text
                  style={styles.retryButtonText}
                >
                  Coba lagi
                </Text>
              </Pressable>
            </View>
          ) : visibleProducts.length === 0 ? (
            <View style={styles.storeStatus}>
              <Text style={styles.storeStatusText}>
                {searchQuery.trim()
                  ? "Produk tidak ditemukan."
                  : "Belum ada produk."}
              </Text>
            </View>
          ) : (
            <View style={styles.productGrid}>
              {visibleProducts.map(
                (product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onPress={() =>
                      setSelectedProduct(product)
                    }
                  />
                )
              )}
            </View>
          )}
        </ScrollView>

        <BottomNavigation
          onChatPress={() =>
            setShowChatInbox(true)
          }
          onNotificationPress={() =>
            setShowNotifications(true)
          }
          unreadNotificationCount={
            unreadNotificationCount
          }
          onUploadPress={() =>
            setShowUpload(true)
          }
          onProfilePress={() =>
            setShowProfile(true)
          }
        />
      </View>
    </SafeAreaView>
  );
}

export default function App() {

  const [session, setSession] =
    useState<Session | null>(null);

  const [authReady, setAuthReady] =
    useState(false);

  useEffect(() => {
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;

        if (error) {
          console.warn(
            "Gagal membaca session:",
            error.message
          );
        }

        setSession(data.session ?? null);
        setAuthReady(true);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (!active) return;

        setSession(nextSession);
        setAuthReady(true);
      }
    );

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  if (!authReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      {session ? <StoreHome /> : <AuthScreen />}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  scrollContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 8,
    paddingBottom: 104,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  brand: {
    fontSize: 20,
    fontFamily: "PlusJakartaSans_700Bold",
    color: "#0F172A",
    letterSpacing: -0.4,
  },

  brandSubtitle: {
    marginTop: 3,
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 10.5,
    color: "#94A3B8",
  },

  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  notificationDot: {
    position: "absolute",
    right: 8,
    top: 7,
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#2563EB",
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },

  avatarButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
  },

  avatarText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_700Bold",
    color: "#1D4ED8",
  },

  searchBox: {
    marginTop: 18,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  searchInput: {
    flex: 1,
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    color: "#0F172A",
    paddingVertical: 0,
  },

  productGrid: {
    marginTop: 18,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: CARD_GAP,
  },

  productCard: {
    width: CARD_WIDTH,
    overflow: "hidden",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },

  thumbnail: {
    width: "100%",
    aspectRatio: 4 / 5,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },

  thumbnailBadge: {
    position: "absolute",
    left: 9,
    top: 9,
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 4,
    backgroundColor: "rgba(255,255,255,0.9)",
  },

  thumbnailBadgeText: {
    fontSize: 8.5,
    fontFamily: "PlusJakartaSans_700Bold",
    color: "#2563EB",
  },

  productContent: {
    padding: 10,
  },

  productMeta: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 8.5,
    color: "#94A3B8",
  },

  productTitle: {
    marginTop: 4,
    minHeight: 34,
    fontSize: 11.5,
    lineHeight: 17,
    fontFamily: "PlusJakartaSans_700Bold",
    color: "#0F172A",
  },

  productAuthor: {
    marginTop: 4,
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 8.5,
    color: "#64748B",
  },

  productFooter: {
    marginTop: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },

  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },

  ratingText: {
    fontSize: 9,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: "#64748B",
  },

  price: {
    flexShrink: 1,
    textAlign: "right",
    fontSize: 9.5,
    fontFamily: "PlusJakartaSans_700Bold",
    color: "#0F172A",
  },

  freePrice: {
    color: "#16A34A",
  },

  thumbnailImage: {
    width: "100%",
    height: "100%",
  },

  storeStatus: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 10,
  },

  storeStatusText: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 10.5,
    color: "#64748B",
    textAlign: "center",
  },

  storeErrorText: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 10.5,
    color: "#B91C1C",
    textAlign: "center",
  },

  retryButton: {
    minHeight: 34,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EFF6FF",
  },

  retryButtonText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 9.5,
    color: "#2563EB",
  },

  bottomNav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 76,
    paddingTop: 8,
    paddingBottom: 9,
    paddingHorizontal: 18,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },

  navItem: {
    minWidth: 56,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },


  navLabel: {
    fontSize: 8.5,
    fontFamily: "PlusJakartaSans_500Medium",
    color: "#94A3B8",
  },

  navLabelActive: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: "#2563EB",
  },
  navIconWrap: {
    position: "relative",
  },

  navBadge: {
    position: "absolute",
    top: -7,
    right: -11,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DC2626",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },

  navBadgeText: {
    fontFamily:
      "PlusJakartaSans_700Bold",
    fontSize: 7.5,
    lineHeight: 10,
    color: "#FFFFFF",
  },

});

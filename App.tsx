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
  Share,
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
  Bookmark,
  Heart,
  Forward as ShareIcon,
} from "lucide-react-native";

import type { Session } from "@supabase/supabase-js";
import AuthScreen from "./components/AuthScreen";
import ProductDetailScreen from "./components/ProductDetailScreen";
import ChatScreen from "./components/ChatScreen";
import ChatInboxScreen from "./components/ChatInboxScreen";
import NotificationScreen from "./components/NotificationScreen";
import ProfileScreen from "./components/ProfileScreen";
import PublicProfileScreen from "./components/PublicProfileScreen";
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

const SCREEN_WIDTH =
  Dimensions.get("window").width;

const SCREEN_HEIGHT =
  Dimensions.get("window").height;

const IS_SHORT_SCREEN =
  SCREEN_HEIGHT < 700;

const HORIZONTAL_PADDING =
  SCREEN_WIDTH <= 360 ? 12 : 16;

const CARD_GAP =
  SCREEN_WIDTH <= 360 ? 8 : 10;

const WIDTH_BASED_CARD =
  (
    SCREEN_WIDTH -
    HORIZONTAL_PADDING * 2 -
    CARD_GAP
  ) / 2;

/*
 * Menjaga dua baris thumbnail 4:5
 * tetap masuk lebih baik pada HP pendek.
 */
const HEIGHT_BASED_CARD =
  Math.max(
    92,
    (SCREEN_HEIGHT - 250) / 2.5
  );

const CARD_WIDTH =
  Math.min(
    WIDTH_BASED_CARD,
    HEIGHT_BASED_CARD
  );

function ProductCard({
  product,
  onPress,
}: {
  product: StoreProductCardItem;
  onPress: () => void;
}) {
  // CARD_LOVE_SAVE_SHARE

  const [
    currentUserId,
    setCurrentUserId,
  ] =
    useState<string | null>(
      null
    );

  const [
    isLoved,
    setIsLoved,
  ] =
    useState(false);

  const [
    loveCount,
    setLoveCount,
  ] =
    useState(0);

  const [
    isSaved,
    setIsSaved,
  ] =
    useState(false);

  const [
    loveLoading,
    setLoveLoading,
  ] =
    useState(false);

  const [
    saveLoading,
    setSaveLoading,
  ] =
    useState(false);


  const isOwner =
    currentUserId ===
    product.creatorUserId;


  useEffect(() => {
    let active = true;

    async function loadActions() {
      try {
        const {
          data: authData,
          error: authError,
        } =
          await supabase.auth
            .getUser();

        if (authError) {
          throw authError;
        }

        const userId =
          authData.user?.id ??
          null;

        if (!active) {
          return;
        }

        setCurrentUserId(
          userId
        );

        if (!userId) {
          return;
        }


        const [
          countResult,
          loveResult,
          saveResult,
        ] =
          await Promise.all([
            supabase
              .from(
                "store_product_likes"
              )
              .select(
                "product_id",
                {
                  count: "exact",
                  head: true,
                }
              )
              .eq(
                "product_id",
                product.id
              ),

            supabase
              .from(
                "store_product_likes"
              )
              .select(
                "product_id"
              )
              .eq(
                "user_id",
                userId
              )
              .eq(
                "product_id",
                product.id
              )
              .maybeSingle(),

            supabase
              .from(
                "store_product_saves"
              )
              .select(
                "product_id"
              )
              .eq(
                "user_id",
                userId
              )
              .eq(
                "product_id",
                product.id
              )
              .maybeSingle(),
          ]);


        if (
          countResult.error
        ) {
          throw countResult.error;
        }

        if (
          loveResult.error
        ) {
          throw loveResult.error;
        }

        if (
          saveResult.error
        ) {
          throw saveResult.error;
        }

        if (!active) {
          return;
        }


        setLoveCount(
          countResult.count ??
            0
        );

        setIsLoved(
          Boolean(
            loveResult.data
          )
        );

        setIsSaved(
          Boolean(
            saveResult.data
          )
        );

      } catch (error) {
        console.warn(
          "Aksi kartu produk gagal dimuat:",
          error
        );
      }
    }


    void loadActions();

    return () => {
      active = false;
    };
  }, [
    product.id,
  ]);


  async function handleLove() {
    if (
      !currentUserId ||
      isOwner ||
      loveLoading
    ) {
      return;
    }


    const previousLoved =
      isLoved;

    const previousCount =
      loveCount;

    const nextLoved =
      !previousLoved;


    setLoveLoading(true);
    setIsLoved(
      nextLoved
    );

    setLoveCount(
      Math.max(
        0,
        previousCount +
          (
            nextLoved
              ? 1
              : -1
          )
      )
    );


    try {
      if (nextLoved) {
        const {
          error,
        } =
          await supabase
            .from(
              "store_product_likes"
            )
            .insert({
              user_id:
                currentUserId,

              product_id:
                product.id,
            });

        if (error) {
          throw error;
        }

      } else {
        const {
          error,
        } =
          await supabase
            .from(
              "store_product_likes"
            )
            .delete()
            .eq(
              "user_id",
              currentUserId
            )
            .eq(
              "product_id",
              product.id
            );

        if (error) {
          throw error;
        }
      }

    } catch (error) {
      setIsLoved(
        previousLoved
      );

      setLoveCount(
        previousCount
      );

      console.warn(
        "Love kartu gagal:",
        error
      );

    } finally {
      setLoveLoading(false);
    }
  }


  async function handleSave() {
    if (
      !currentUserId ||
      saveLoading
    ) {
      return;
    }


    const previousSaved =
      isSaved;

    const nextSaved =
      !previousSaved;


    setSaveLoading(true);
    setIsSaved(
      nextSaved
    );


    try {
      if (nextSaved) {
        const {
          error,
        } =
          await supabase
            .from(
              "store_product_saves"
            )
            .insert({
              user_id:
                currentUserId,

              product_id:
                product.id,
            });

        if (error) {
          throw error;
        }

      } else {
        const {
          error,
        } =
          await supabase
            .from(
              "store_product_saves"
            )
            .delete()
            .eq(
              "user_id",
              currentUserId
            )
            .eq(
              "product_id",
              product.id
            );

        if (error) {
          throw error;
        }
      }

    } catch (error) {
      setIsSaved(
        previousSaved
      );

      console.warn(
        "Save kartu gagal:",
        error
      );

    } finally {
      setSaveLoading(false);
    }
  }


  async function handleShareCard() {
    try {
      await Share.share({
        message:
          product.title +
          "\n" +
          product.subject +
          " Â· " +
          product.level +
          "\n" +
          "Oleh " +
          product.author +
          "\n" +
          product.price +
          "\n\n" +
          "Tersedia di Diginaz Store.",
      });

    } catch (error) {
      console.warn(
        "Share kartu gagal:",
        error
      );
    }
  }


  return (
    <Pressable
      style={
        styles.productCard
      }
      onPress={
        onPress
      }
    >
      <View
        style={
          styles.thumbnail
        }
      >
        {product.thumbnailUrl ? (
          <Image
            source={{
              uri:
                product.thumbnailUrl,
            }}
            style={
              styles.thumbnailImage
            }
            resizeMode="cover"
          />
        ) : (
          <BookOpen
            size={34}
            color="#8FA8D8"
            strokeWidth={1.4}
          />
        )}


        <View
          style={
            styles.thumbnailBadge
          }
        >
          <Text
            style={
              styles.thumbnailBadgeText
            }
          >
            {product.type}
          </Text>
        </View>
      </View>


      <View
        style={
          styles.productContent
        }
      >
        <Text
          style={
            styles.productTitle
          }
          numberOfLines={2}
        >
          {product.title}
        </Text>


        <Text
          style={
            styles.productAuthor
          }
          numberOfLines={1}
        >
          Oleh {product.author}
        </Text>


        <View
          style={
            styles.productFooter
          }
        >
          <Text
            style={[
              styles.price,

              product.price ===
                "Gratis" &&
                styles.freePrice,
            ]}
          >
            {product.price}
          </Text>
        </View>


        <View
          style={
            styles.cardActions
          }
        >
          <View
            style={
              styles.cardRating
            }
          >
            <Star
              size={12}
              color="#F3B63F"
              fill="#F3B63F"
              strokeWidth={1.5}
            />

            <Text
              style={
                styles.ratingText
              }
            >
              {product.reviewCount > 0
                ? product.rating
                : "Baru"}
            </Text>
          </View>


          <View
            style={
              styles.cardActionIcons
            }
          >
            <Pressable
              style={
                styles.cardIconButton
              }
              onPress={event => {
                event.stopPropagation();

                if (!isOwner) {
                  void handleLove();
                }
              }}
              accessibilityLabel="Love produk"
            >
              {loveLoading ? (
                <ActivityIndicator
                  size="small"
                  color="#E11D48"
                />
              ) : (
                <Heart
                  size={18}
                  color={
                    isLoved
                      ? "#E11D48"
                      : "#64748B"
                  }
                  fill={
                    isLoved
                      ? "#E11D48"
                      : "none"
                  }
                  strokeWidth={1.8}
                />
              )}
            </Pressable>


            <Pressable
              style={
                styles.cardIconButton
              }
              onPress={event => {
                event.stopPropagation();
                void handleSave();
              }}
              accessibilityLabel="Save produk"
            >
              {saveLoading ? (
                <ActivityIndicator
                  size="small"
                  color="#2563EB"
                />
              ) : (
                <Bookmark
                  size={18}
                  color={
                    isSaved
                      ? "#2563EB"
                      : "#64748B"
                  }
                  fill={
                    isSaved
                      ? "#2563EB"
                      : "none"
                  }
                  strokeWidth={1.8}
                />
              )}
            </Pressable>


            <Pressable
              style={
                styles.cardIconButton
              }
              onPress={event => {
                event.stopPropagation();
                void handleShareCard();
              }}
              accessibilityLabel="Share produk"
            >
              <ShareIcon
                size={18}
                color="#64748B"
                strokeWidth={1.8}
              />
            </Pressable>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

type MainTab =
  | "store"
  | "chat"
  | "upload"
  | "notifications"
  | "profile";


function BottomNavigation({
  activeTab,
  onStorePress,
  onChatPress,
  onUploadPress,
  onNotificationPress,
  onProfilePress,
  unreadNotificationCount,
}: {
  activeTab: MainTab;
  onStorePress: () => void;
  onChatPress: () => void;
  onUploadPress: () => void;
  onNotificationPress: () => void;
  onProfilePress: () => void;
  unreadNotificationCount: number;
}) {
  const activeColor =
    "#2563EB";

  const inactiveColor =
    "#94A3B8";

  function colorFor(
    tab: MainTab
  ) {
    return activeTab === tab
      ? activeColor
      : inactiveColor;
  }

  function strokeFor(
    tab: MainTab
  ) {
    return activeTab === tab
      ? 2
      : 1.8;
  }

  function labelFor(
    tab: MainTab
  ) {
    return activeTab === tab
      ? [
          styles.navLabel,
          styles.navLabelActive,
        ]
      : styles.navLabel;
  }

  return (
    <View style={styles.bottomNav}>

      <Pressable
        style={styles.navItem}
        onPress={onStorePress}
      >
        <Home
          size={21}
          color={colorFor("store")}
          strokeWidth={
            strokeFor("store")
          }
        />

        <Text
          style={labelFor("store")}
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
          color={colorFor("chat")}
          strokeWidth={
            strokeFor("chat")
          }
        />

        <Text
          style={labelFor("chat")}
        >
          Chat
        </Text>
      </Pressable>


      <Pressable
        style={styles.navItem}
        onPress={onUploadPress}
      >
        <Plus
          size={21}
          color={colorFor("upload")}
          strokeWidth={
            strokeFor("upload")
          }
        />

        <Text
          style={labelFor("upload")}
        >
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
            color={
              colorFor(
                "notifications"
              )
            }
            strokeWidth={
              strokeFor(
                "notifications"
              )
            }
          />

          {unreadNotificationCount >
          0 ? (
            <View
              style={
                styles.navBadge
              }
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

        <Text
          style={
            labelFor(
              "notifications"
            )
          }
        >
          Notifikasi
        </Text>
      </Pressable>


      <Pressable
        style={styles.navItem}
        onPress={onProfilePress}
      >
        <UserRound
          size={21}
          color={
            colorFor("profile")
          }
          strokeWidth={
            strokeFor("profile")
          }
        />

        <Text
          style={
            labelFor("profile")
          }
        >
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
    selectedProfileUserId,
    setSelectedProfileUserId,
  ] =
    useState<string | null>(
      null
    );

  const [
    profileReturnProduct,
    setProfileReturnProduct,
  ] =
    useState<StoreProductCardItem | null>(
      null
    );

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
  const [
    productOpenedFromProfile,
    setProductOpenedFromProfile,
  ] = useState(false);

  const [selectedConversationId, setSelectedConversationId] =
    useState<string | null>(null);


  function openMainTab(
    tab: MainTab
  ) {
    setShowChatInbox(
      tab === "chat"
    );

    setShowUpload(
      tab === "upload"
    );

    setShowNotifications(
      tab === "notifications"
    );

    setShowProfile(
      tab === "profile"
    );

    setSelectedProfileUserId(
      null
    );

    setProfileReturnProduct(
      null
    );

    setSelectedConversationId(
      null
    );

    setSelectedProduct(
      null
    );

    setEditingProductId(
      null
    );

    setProductOpenedFromProfile(
      false
    );
  }


  function renderBottomNavigation(
    activeTab: MainTab
  ) {
    return (
      <BottomNavigation
        activeTab={activeTab}

        onStorePress={() =>
          openMainTab("store")
        }

        onChatPress={() =>
          openMainTab("chat")
        }

        onUploadPress={() =>
          openMainTab("upload")
        }

        onNotificationPress={() =>
          openMainTab(
            "notifications"
          )
        }

        onProfilePress={() =>
          openMainTab("profile")
        }

        unreadNotificationCount={
          unreadNotificationCount
        }
      />
    );
  }


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

          if (
            productOpenedFromProfile
          ) {
            setProductOpenedFromProfile(
              false
            );
            setShowProfile(true);
          }

          return true;
        }
        if (
          selectedProfileUserId
        ) {
          setSelectedProfileUserId(
            null
          );

          if (
            profileReturnProduct
          ) {
            setSelectedProduct(
              profileReturnProduct
            );

            setProfileReturnProduct(
              null
            );
          }

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
  }, [selectedConversationId, editingProductId, selectedProduct, selectedProfileUserId, profileReturnProduct, productOpenedFromProfile, showChatInbox, showNotifications, showProfile, showUpload]);


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
      <View style={styles.screen}>
        <View
          style={
            styles.mainTabContent
          }
        >
          <ProfileScreen
            products={products}
            onBack={() =>
              setShowProfile(false)
            }
            onOpenProduct={(
              product
            ) => {
              setProductOpenedFromProfile(
                true
              );
              setShowProfile(false);
              setSelectedProduct(
                product
              );
            }}
          />
        </View>

        {renderBottomNavigation(
          "profile"
        )}
      </View>
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
      <View style={styles.screen}>
        <View
          style={
            styles.mainTabContent
          }
        >
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
        </View>

        {renderBottomNavigation(
          "chat"
        )}
      </View>
    );
  }

  if (showNotifications) {
    return (
      <View style={styles.screen}>
        <View
          style={
            styles.mainTabContent
          }
        >
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
        </View>

        {renderBottomNavigation(
          "notifications"
        )}
      </View>
    );
  }

  if (selectedProduct) {
    return (
      <ProductDetailScreen
        product={selectedProduct}

        onOpenCreatorProfile={(
          creatorUserId
        ) => {
          setProfileReturnProduct(
            selectedProduct
          );

          setSelectedProfileUserId(
            creatorUserId
          );

          setSelectedProduct(
            null
          );
        }}
        onBack={() => {
          setSelectedProduct(
            null
          );

          if (
            productOpenedFromProfile
          ) {
            setProductOpenedFromProfile(
              false
            );
            setShowProfile(true);
          }
        }}
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


  if (selectedProfileUserId) {
    return (
      <PublicProfileScreen
        profileUserId={
          selectedProfileUserId
        }

        products={products}

        onBack={() => {
          setSelectedProfileUserId(
            null
          );

          if (
            profileReturnProduct
          ) {
            setSelectedProduct(
              profileReturnProduct
            );

            setProfileReturnProduct(
              null
            );
          }
        }}

        onOpenProduct={(
          product
        ) => {
          setSelectedProduct(
            product
          );
        }}
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
      <View style={styles.screen}>
        <View
          style={
            styles.mainTabContent
          }
        >
          <UploadProductScreen
            onClose={() =>
              setShowUpload(false)
            }
            onUploaded={() => {
              setShowUpload(false);
              loadProducts(false);
            }}
          />
        </View>

        {renderBottomNavigation(
          "upload"
        )}
      </View>
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
                Diginaz
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

        {renderBottomNavigation(
          "store"
        )}
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

  mainTabContent: {
    flex: 1,
    paddingBottom: 76,
  },

  scrollContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 4,
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
    marginTop: 1,
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
    marginTop: IS_SHORT_SCREEN ? 6 : 8,
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
    marginTop: IS_SHORT_SCREEN ? 6 : 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: CARD_GAP,
    justifyContent: "space-between",
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
    paddingHorizontal: 10,
    paddingTop: 7,
    paddingBottom: 5,
  },

  productMeta: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 8.5,
    color: "#94A3B8",
  },

  productTitle: {
    marginTop: 0,
    minHeight: 16,
    fontSize: 11.5,
    lineHeight: 16,
    fontFamily: "PlusJakartaSans_700Bold",
    color: "#0F172A",
  },

  productAuthor: {
    marginTop: 0,
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 8.5,
    color: "#64748B",
  },

  productFooter: {
    marginTop: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
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

  cardActions: {
    marginTop: 2,
    paddingTop: 3,
    borderTopWidth:
      StyleSheet.hairlineWidth,
    borderTopColor:
      "#E2E8F0",
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  cardRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },

  cardActionIcons: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 0,
  },

  cardIconButton: {
    width: 25,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },

  cardActionDisabled: {
    opacity: 0.35,
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

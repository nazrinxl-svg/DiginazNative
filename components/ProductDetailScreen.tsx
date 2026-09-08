import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,

  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  ArrowLeft,
  BookOpen,
  Bookmark,
  Heart,
  MessageCircle,
  Pencil,

  ShieldCheck,
  Trash2,
  Star,
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../lib/supabase";
import ProductReviewsSection from "./ProductReviewsSection";

type ProductSummary = {
  id: string;
  creatorUserId: string;
  type: string;
  subject: string;
  level: string;
  title: string;
  author: string;
  rating: string;
  reviewCount: number;
  price: string;
  thumbnailUrl: string | null;
  downloadCount: number;
};

type ProductDetailRow = {
  id: string;
  creator_user_id: string;
  creator_name: string;
  title: string;
  product_type: string;
  subject: string;
  class_level: string;
  pricing_type: string;
  price_amount: number | null;
  original_price_amount: number | null;
  description: string | null;
  thumbnail_path: string | null;
  download_count: number | null;
};

type Props = {
  product: ProductSummary;
  onBack: () => void;
  onEditProduct: () => void;
  onProductChanged: () => void;
  onOpenChat: (
    conversationId: string
  ) => void;

  onOpenCreatorProfile: (
    creatorUserId: string
  ) => void;
};

export default function ProductDetailScreen({
  product,
  onBack,
  onEditProduct,
  onProductChanged,
  onOpenChat,
  onOpenCreatorProfile,
}: Props) {
  const [detail, setDetail] =
    useState<ProductDetailRow | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [currentUserId, setCurrentUserId] =
    useState<string | null>(null);

  const [contactLoading, setContactLoading] =
    useState(false);

  const [contactError, setContactError] =
    useState("");

  const [deleteLoading, setDeleteLoading] =
    useState(false);

  const [
    deleteConfirmVisible,
    setDeleteConfirmVisible,
  ] = useState(false);

  const [
    isLoved,
    setIsLoved,
  ] = useState(false);

  const [
    loveCount,
    setLoveCount,
  ] = useState(0);

  const [
    loveLoading,
    setLoveLoading,
  ] = useState(false);

  const [
    isSaved,
    setIsSaved,
  ] = useState(false);

  const [
    saveLoading,
    setSaveLoading,
  ] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadDetail() {
      setLoading(true);
      setErrorMessage("");

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!active) return;

        setCurrentUserId(user?.id ?? null);

        const {
          data,
          error,
        } = await supabase
          .from("store_products")
          .select(
            "id,creator_user_id,creator_name,title,product_type,subject,class_level,pricing_type,price_amount,original_price_amount,description,thumbnail_path,download_count"
          )
          .eq("id", product.id)
          .single();

        if (error) {
          throw error;
        }

        if (!active) return;

        setDetail(
          data as unknown as ProductDetailRow
        );
      } catch (error) {
        if (!active) return;

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Detail produk gagal dimuat."
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadDetail();

    return () => {
      active = false;
    };
  }, [product.id]);

  const isOwner =
    currentUserId === product.creatorUserId;


  useEffect(() => {
    let active = true;

    async function loadProductActions() {
      if (!currentUserId) {
        if (active) {
          setIsLoved(false);
          setLoveCount(0);
          setIsSaved(false);
        }

        return;
      }

      try {
        const [
          loveCountResult,
          ownLoveResult,
          ownSaveResult,
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
                currentUserId
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
                currentUserId
              )
              .eq(
                "product_id",
                product.id
              )
              .maybeSingle(),
          ]);

        if (
          loveCountResult.error
        ) {
          throw loveCountResult.error;
        }

        if (
          ownLoveResult.error
        ) {
          throw ownLoveResult.error;
        }

        if (
          ownSaveResult.error
        ) {
          throw ownSaveResult.error;
        }

        if (!active) {
          return;
        }

        setLoveCount(
          loveCountResult.count ??
            0
        );

        setIsLoved(
          Boolean(
            ownLoveResult.data
          )
        );

        setIsSaved(
          Boolean(
            ownSaveResult.data
          )
        );

      } catch (error) {
        console.warn(
          "Status Love/Save gagal dimuat:",
          error
        );
      }
    }

    void loadProductActions();

    return () => {
      active = false;
    };
  }, [
    currentUserId,
    product.id,
  ]);


  async function handleLoveToggle() {
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
    setIsLoved(nextLoved);

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

      console.error(
        "Love produk gagal:",
        error
      );

      Alert.alert(
        "Belum tersimpan",
        "Love produk belum dapat diperbarui."
      );

    } finally {
      setLoveLoading(false);
    }
  }


  async function handleSaveToggle() {
    if (
      !currentUserId ||
      isOwner ||
      saveLoading
    ) {
      return;
    }

    const previousSaved =
      isSaved;

    const nextSaved =
      !previousSaved;

    setSaveLoading(true);
    setIsSaved(nextSaved);

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

      console.error(
        "Save produk gagal:",
        error
      );

      Alert.alert(
        "Belum tersimpan",
        "Produk belum dapat disimpan."
      );

    } finally {
      setSaveLoading(false);
    }
  }


  async function handleContactCreator() {
    if (
      !currentUserId ||
      isOwner ||
      contactLoading
    ) {
      return;
    }

    setContactLoading(true);
    setContactError("");

    try {
      const {
        data: existing,
        error: existingError,
      } =
        await supabase
          .from("store_conversations")
          .select("id")
          .eq(
            "product_key",
            product.id
          )
          .eq(
            "buyer_user_id",
            currentUserId
          )
          .eq(
            "creator_user_id",
            product.creatorUserId
          )
          .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      let conversationId =
        existing?.id ?? null;

      if (!conversationId) {
        const {
          data: authData,
        } =
          await supabase.auth.getUser();

        const buyerName =
          String(
            authData.user
              ?.user_metadata
              ?.full_name ||
            authData.user?.email ||
            "Pengguna Diginaz"
          ).trim();

        const {
          data: created,
          error: createError,
        } =
          await supabase
            .from("store_conversations")
            .insert({
              product_key:
                product.id,
              product_title:
                product.title,
              product_type:
                product.type,
              buyer_user_id:
                currentUserId,
              buyer_name:
                buyerName,
              creator_user_id:
                product.creatorUserId,
              creator_name:
                product.author,
            })
            .select("id")
            .single();

        if (createError) {
          if (
            createError.code ===
            "23505"
          ) {
            const {
              data: raced,
              error: raceError,
            } =
              await supabase
                .from(
                  "store_conversations"
                )
                .select("id")
                .eq(
                  "product_key",
                  product.id
                )
                .eq(
                  "buyer_user_id",
                  currentUserId
                )
                .eq(
                  "creator_user_id",
                  product.creatorUserId
                )
                .single();

            if (raceError) {
              throw raceError;
            }

            conversationId =
              raced.id;
          } else {
            throw createError;
          }
        } else {
          conversationId =
            created.id;
        }
      }

      if (!conversationId) {
        throw new Error(
          "Percakapan belum dapat dibuat."
        );
      }

      const {
        error: trackingError,
      } =
        await supabase
          .from(
            "store_product_events"
          )
          .insert({
            product_id:
              product.id,
            user_id:
              currentUserId,
            event_type:
              "contact_creator",
            source:
              "mobile",
            metadata: {
              conversation_id:
                conversationId,
            },
          });

      if (trackingError) {
        console.warn(
          "Tracking contact_creator gagal:",
          trackingError
        );
      }

      onOpenChat(
        conversationId
      );
    } catch (error) {
      console.error(
        "Gagal membuka chat:",
        error
      );

      setContactError(
        error instanceof Error
          ? error.message
          : "Chat belum dapat dibuka."
      );
    } finally {
      setContactLoading(false);
    }
  }

  async function archiveProduct() {
    if (
      !isOwner ||
      deleteLoading
    ) {
      return;
    }

    setDeleteLoading(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error(
          "Sesi login tidak ditemukan."
        );
      }

      const {
        data,
        error,
      } = await supabase
        .from("store_products")
        .update({
          status: "archived",
        })
        .eq("id", product.id)
        .eq(
          "creator_user_id",
          user.id
        )
        .select("id")
        .single();

      if (error) {
        throw error;
      }

      if (!data?.id) {
        throw new Error(
          "Produk tidak berhasil dihapus dari Store."
        );
      }

      onProductChanged();
    } catch (error) {
      console.error(
        "Hapus produk dari Store gagal:",
        error
      );

      Alert.alert(
        "Belum dapat menghapus produk",
        error instanceof Error
          ? error.message
          : "Silakan coba lagi."
      );
    } finally {
      setDeleteLoading(false);
    }
  }

  function confirmArchiveProduct() {
    if (
      !isOwner ||
      deleteLoading
    ) {
      return;
    }

    setDeleteConfirmVisible(true);
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

      <View style={styles.header}>
        <Pressable
          style={styles.headerButton}
          onPress={onBack}
        >
          <ArrowLeft
            size={20}
            color="#0F172A"
          />
        </Pressable>

        <Text style={styles.headerTitle}>
          Detail Produk
        </Text>

        {isOwner ? (
          <View
            style={
              styles.headerOwnerActions
            }
          >
            <Pressable
              style={
                styles.headerOwnerIconButton
              }
              onPress={onEditProduct}
              disabled={deleteLoading}
              hitSlop={6}
              accessibilityLabel="Edit produk"
            >
              <Pencil
                size={18}
                color="#2563EB"
                strokeWidth={1.8}
              />
            </Pressable>

            <Pressable
              style={
                styles.headerOwnerIconButton
              }
              onPress={
                confirmArchiveProduct
              }
              disabled={deleteLoading}
              hitSlop={6}
              accessibilityLabel="Hapus produk"
            >
              {deleteLoading ? (
                <ActivityIndicator
                  size="small"
                  color="#DC2626"
                />
              ) : (
                <Trash2
                  size={18}
                  color="#DC2626"
                  strokeWidth={1.8}
                />
              )}
            </Pressable>
          </View>
        ) : null}


      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator
            size="small"
            color="#2563EB"
          />

          <Text style={styles.stateText}>
            Memuat detail produk...
          </Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.centerState}>
          <Text style={styles.errorText}>
            Detail produk belum dapat dimuat.
          </Text>

          <Pressable
            style={styles.backToStoreButton}
            onPress={onBack}
          >
            <Text
              style={styles.backToStoreText}
            >
              Kembali ke Store
            </Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={
            styles.content
          }
        >
          <View style={styles.thumbnail}>
            {product.thumbnailUrl ? (
              <Image
                source={{
                  uri: product.thumbnailUrl,
                }}
                style={styles.thumbnailImage}
                resizeMode="cover"
              />
            ) : (
              <BookOpen
                size={48}
                color="#8FA8D8"
                strokeWidth={1.4}
              />
            )}

            <View style={styles.typeBadge}>
              <Text
                style={styles.typeBadgeText}
              >
                {product.type}
              </Text>
            </View>
          </View>

          <View style={styles.mainInfo}>

            <Text style={styles.title}>
              {product.title}
            </Text>

            <Pressable
              disabled={isOwner}
              onPress={() =>
                onOpenCreatorProfile(
                  product.creatorUserId
                )
              }
            >
              <Text
                style={styles.creator}
              >
                Oleh {product.author}
              </Text>
            </Pressable>

            <View style={styles.summaryRow}>
              <View style={styles.rating}>
                <Star
                  size={15}
                  color="#F3B63F"
                  fill="#F3B63F"
                />

                <Text
                  style={styles.ratingText}
                >
                  {product.reviewCount > 0
                    ? `${product.rating} (${product.reviewCount})`
                    : "Belum ada ulasan"}
                </Text>
              </View>

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
          </View>


          <View
            style={[
              styles.productActions,
              isOwner &&
                styles.ownerProductActionsHidden,
            ]}
          >
            {!isOwner ? (
              <>
                <Pressable
                  style={
                    styles.productAction
                  }
                  onPress={() =>
                    void handleLoveToggle()
                  }
                  disabled={
                    loveLoading
                  }
                  accessibilityLabel="Love produk"
                >
                  {loveLoading ? (
                    <ActivityIndicator
                      size="small"
                      color="#E11D48"
                    />
                  ) : (
                    <Heart
                      size={21}
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

                  <Text
                    style={[
                      styles.productActionText,

                      isLoved &&
                        styles.loveActionText,
                    ]}
                  >
                    Love{
                      loveCount > 0
                        ? ` ${loveCount}`
                        : ""
                    }
                  </Text>
                </Pressable>


                <Pressable
                  style={
                    styles.productAction
                  }
                  onPress={() =>
                    void handleSaveToggle()
                  }
                  disabled={
                    saveLoading
                  }
                  accessibilityLabel="Save produk"
                >
                  {saveLoading ? (
                    <ActivityIndicator
                      size="small"
                      color="#2563EB"
                    />
                  ) : (
                    <Bookmark
                      size={21}
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

                  <Text
                    style={[
                      styles.productActionText,

                      isSaved &&
                        styles.saveActionText,
                    ]}
                  >
                    Save
                  </Text>
                </Pressable>
              </>
            ) : null}



          </View>


          {!isOwner ? (
            <>
              <Pressable
                onPress={
                  handleContactCreator
                }
                disabled={
                  contactLoading
                }
                style={[
                  styles.contactButton,
                  contactLoading &&
                    styles.contactButtonDisabled,
                ]}
              >
                {contactLoading ? (
                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />
                ) : (
                  <>
                    <MessageCircle
                      size={18}
                      color="#FFFFFF"
                    />

                    <Text
                      style={
                        styles.contactButtonText
                      }
                    >
                      Hubungi Kreator
                    </Text>
                  </>
                )}
              </Pressable>

              {contactError ? (
                <Text
                  style={
                    styles.contactError
                  }
                >
                  {contactError}
                </Text>
              ) : null}

              <View style={styles.safetyBox}>
              <View style={styles.safetyIcon}>
                <ShieldCheck
                  size={20}
                  color="#2563EB"
                />
              </View>

              <View style={styles.safetyContent}>
                <Text
                  style={styles.safetyTitle}
                >
                  Tetap berhati-hati saat
                  bertransaksi
                </Text>

                <Text
                  style={styles.safetyText}
                >
                  Transaksi dilakukan langsung
                  antara pembeli dan kreator.
                  Diginaz tidak memproses atau
                  menyimpan pembayaran. Periksa
                  detail produk dan kreator sebelum
                  melakukan pembayaran.
                </Text>
              </View>
            </View>
            </>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Deskripsi
            </Text>

            <Text
              style={styles.description}
            >
              {detail?.description?.trim() ||
                "Kreator belum menambahkan deskripsi produk."}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Informasi Produk
            </Text>

            <View style={styles.infoRows}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>
                  Jenis
                </Text>

                <Text style={styles.infoValue}>
                  {product.type}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>
                  Mata pelajaran
                </Text>

                <Text style={styles.infoValue}>
                  {product.subject}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>
                  Kelas
                </Text>

                <Text style={styles.infoValue}>
                  {product.level}
                </Text>
              </View>

              <Pressable
                style={styles.infoRow}
                disabled={isOwner}
                onPress={() =>
                  onOpenCreatorProfile(
                    product.creatorUserId
                  )
                }
              >
                <Text style={styles.infoLabel}>
                  Kreator
                </Text>

                <Text style={styles.infoValue}>
                  {product.author}
                </Text>
              </Pressable>
            </View>
          </View>

          <ProductReviewsSection
            productId={product.id}
            creatorUserId={
              product.creatorUserId
            }
          />

        </ScrollView>
      )}

      <Modal
        visible={deleteConfirmVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {
          if (!deleteLoading) {
            setDeleteConfirmVisible(false);
          }
        }}
      >
        <View style={styles.deleteModalRoot}>
          <Pressable
            style={styles.deleteModalBackdrop}
            disabled={deleteLoading}
            onPress={() =>
              setDeleteConfirmVisible(false)
            }
          />

          <View style={styles.deleteModalCard}>
            <View style={styles.deleteModalIcon}>
              <Trash2
                size={23}
                color="#DC2626"
                strokeWidth={1.8}
              />
            </View>

            <Text style={styles.deleteModalTitle}>
              Hapus produk?
            </Text>

            <Text
              style={styles.deleteModalDescription}
            >
              Produk akan dihapus dari Store dan
              tidak lagi tampil di katalog. Riwayat
              chat dan ulasan tetap disimpan.
            </Text>

            <View
              style={styles.deleteModalProduct}
            >
              <Text
                style={
                  styles.deleteModalProductLabel
                }
              >
                PRODUK
              </Text>

              <Text
                style={
                  styles.deleteModalProductTitle
                }
                numberOfLines={2}
              >
                {product.title}
              </Text>
            </View>

            <View
              style={styles.deleteModalActions}
            >
              <Pressable
                style={
                  styles.deleteModalCancelButton
                }
                disabled={deleteLoading}
                onPress={() =>
                  setDeleteConfirmVisible(false)
                }
              >
                <Text
                  style={
                    styles.deleteModalCancelText
                  }
                >
                  Batal
                </Text>
              </Pressable>

              <Pressable
                style={
                  styles.deleteModalDeleteButton
                }
                disabled={deleteLoading}
                onPress={() => {
                  setDeleteConfirmVisible(false);
                  void archiveProduct();
                }}
              >
                <Trash2
                  size={16}
                  color="#FFFFFF"
                  strokeWidth={1.9}
                />

                <Text
                  style={
                    styles.deleteModalDeleteText
                  }
                >
                  Hapus Produk
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  header: {
    height: 62,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },

  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },

  headerTitle: {
    fontFamily:
      "PlusJakartaSans_700Bold",
    fontSize: 13,
    color: "#0F172A",    position: "absolute",
    left: 84,
    right: 84,
    textAlign: "center",
  },

  headerOwnerActions: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  headerOwnerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  ownerProductActionsHidden: {
    display: "none",
  },

  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 24,
  },

  stateText: {
    fontFamily:
      "PlusJakartaSans_400Regular",
    fontSize: 10.5,
    color: "#64748B",
  },

  errorText: {
    fontFamily:
      "PlusJakartaSans_500Medium",
    fontSize: 10.5,
    color: "#B91C1C",
  },

  backToStoreButton: {
    minHeight: 38,
    paddingHorizontal: 16,
    borderRadius: 11,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },

  backToStoreText: {
    fontFamily:
      "PlusJakartaSans_600SemiBold",
    fontSize: 9.5,
    color: "#2563EB",
  },

  content: {
    paddingBottom: 40,
  },

  thumbnail: {
    width: "100%",
    aspectRatio: 4 / 5,
    maxHeight: 430,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },

  thumbnailImage: {
    width: "100%",
    height: "100%",
  },

  typeBadge: {
    position: "absolute",
    top: 14,
    left: 14,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor:
      "rgba(255,255,255,0.93)",
  },

  typeBadgeText: {
    fontFamily:
      "PlusJakartaSans_700Bold",
    fontSize: 9,
    color: "#2563EB",
  },

  mainInfo: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },


  title: {
    marginTop: 4,
    fontFamily:
      "PlusJakartaSans_700Bold",
    fontSize: 23,
    lineHeight: 29,
    color: "#0F172A",
  },

  creator: {
    marginTop: 4,
    fontFamily:
      "PlusJakartaSans_400Regular",
    fontSize: 12.5,
    lineHeight: 18,
    color: "#64748B",
  },

  summaryRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  rating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  ratingText: {
    fontFamily:
      "PlusJakartaSans_500Medium",
    fontSize: 12,
    color: "#64748B",
  },

  price: {
    fontFamily:
      "PlusJakartaSans_700Bold",
    fontSize: 18,
    color: "#0F172A",
  },

  freePrice: {
    color: "#16A34A",
  },

  productActions: {
    marginHorizontal: 16,
    marginTop: 14,
    minHeight: 54,
    borderTopWidth:
      StyleSheet.hairlineWidth,
    borderBottomWidth:
      StyleSheet.hairlineWidth,
    borderColor: "#E2E8F0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },

  productAction: {
    minWidth: 76,
    minHeight: 48,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  productActionText: {
    fontFamily:
      "PlusJakartaSans_600SemiBold",
    fontSize: 11.5,
    color: "#64748B",
  },

  loveActionText: {
    color: "#E11D48",
  },

  saveActionText: {
    color: "#2563EB",
  },

  contactButton: {
    minHeight: 44,
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 12,
    backgroundColor: "#2563EB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  contactButtonDisabled: {
    opacity: 0.6,
  },

  contactButtonText: {
    fontFamily:
      "PlusJakartaSans_600SemiBold",
    fontSize: 11.5,
    color: "#FFFFFF",
  },

  contactError: {
    marginHorizontal: 16,
    marginTop: 6,
    fontFamily:
      "PlusJakartaSans_400Regular",
    fontSize: 9.5,
    lineHeight: 14,
    color: "#DC2626",
  },

  safetyBox: {
    marginHorizontal: 16,
    marginTop: 20,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    flexDirection: "row",
    gap: 11,
  },

  safetyIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  safetyContent: {
    flex: 1,
  },

  safetyTitle: {
    fontFamily:
      "PlusJakartaSans_700Bold",
    fontSize: 10,
    color: "#1E3A8A",
  },

  safetyText: {
    marginTop: 5,
    fontFamily:
      "PlusJakartaSans_400Regular",
    fontSize: 9,
    lineHeight: 15,
    color: "#475569",
  },

  section: {
    marginHorizontal: 16,
    marginTop: 14,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },

  sectionTitle: {
    fontFamily:
      "PlusJakartaSans_700Bold",
    fontSize: 14,
    color: "#0F172A",
  },

  description: {
    marginTop: 5,
    fontFamily:
      "PlusJakartaSans_400Regular",
    fontSize: 12,
    lineHeight: 17,
    color: "#475569",
  },

  infoRows: {
    marginTop: 6,
    gap: 5,
  },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
  },

  infoLabel: {
    fontFamily:
      "PlusJakartaSans_400Regular",
    fontSize: 11.5,
    color: "#94A3B8",
  },

  infoValue: {
    flex: 1,
    textAlign: "right",
    fontFamily:
      "PlusJakartaSans_600SemiBold",
    fontSize: 11.5,
    color: "#334155",
  },
  ownerActions: {
    marginHorizontal: 16,
    marginTop: 14,
    gap: 9,
  },

  editProductButton: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  editProductButtonText: {
    fontFamily:
      "PlusJakartaSans_600SemiBold",
    fontSize: 10.5,
    color: "#2563EB",
  },

  removeProductButton: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  removeProductButtonText: {
    fontFamily:
      "PlusJakartaSans_600SemiBold",
    fontSize: 10.5,
    color: "#DC2626",
  },

  deleteModalRoot: {
    flex: 1,
    paddingHorizontal: 22,
    alignItems: "center",
    justifyContent: "center",
  },

  deleteModalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor:
      "rgba(15, 23, 42, 0.48)",
  },

  deleteModalCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
    alignItems: "center",
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },

  deleteModalIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEF2F2",
  },

  deleteModalTitle: {
    marginTop: 14,
    fontFamily:
      "PlusJakartaSans_700Bold",
    fontSize: 16,
    color: "#0F172A",
    textAlign: "center",
  },

  deleteModalDescription: {
    marginTop: 7,
    maxWidth: 290,
    fontFamily:
      "PlusJakartaSans_400Regular",
    fontSize: 11.5,
    lineHeight: 18,
    color: "#64748B",
    textAlign: "center",
  },

  deleteModalProduct: {
    width: "100%",
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 13,
    paddingVertical: 10,
  },

  deleteModalProductLabel: {
    fontFamily:
      "PlusJakartaSans_600SemiBold",
    fontSize: 8.5,
    color: "#94A3B8",
    letterSpacing: 0.6,
  },

  deleteModalProductTitle: {
    marginTop: 3,
    fontFamily:
      "PlusJakartaSans_600SemiBold",
    fontSize: 11.5,
    lineHeight: 17,
    color: "#334155",
  },

  deleteModalActions: {
    width: "100%",
    marginTop: 18,
    flexDirection: "row",
    gap: 9,
  },

  deleteModalCancelButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  deleteModalCancelText: {
    fontFamily:
      "PlusJakartaSans_600SemiBold",
    fontSize: 11,
    color: "#475569",
  },

  deleteModalDeleteButton: {
    flex: 1.25,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "#DC2626",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  deleteModalDeleteText: {
    fontFamily:
      "PlusJakartaSans_600SemiBold",
    fontSize: 11,
    color: "#FFFFFF",
  },


});

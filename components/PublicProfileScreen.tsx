import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  ChevronLeft,
  PackageOpen,
} from "lucide-react-native";

import {
  SafeAreaView,
} from "react-native-safe-area-context";

import {
  supabase,
} from "../lib/supabase";

import type {
  StoreProductCardItem,
} from "../lib/storeProducts";


type PublicProfileRow = {
  auth_user_id: string;
  full_name: string;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_private: boolean;
  show_liked_products: boolean;
  follower_count: number;
  following_count: number;
  like_count: number;
  is_following: boolean;
  can_view_content: boolean;
};


type Props = {
  profileUserId: string;

  products:
    StoreProductCardItem[];

  onBack: () => void;

  onOpenProduct: (
    product: StoreProductCardItem
  ) => void;
};


function getInitial(
  name: string
) {
  const clean =
    name.trim();

  return clean
    ? clean
        .charAt(0)
        .toUpperCase()
    : "D";
}


export default function PublicProfileScreen({
  profileUserId,
  products,
  onBack,
  onOpenProduct,
}: Props) {

  const [
    profile,
    setProfile,
  ] =
    useState<PublicProfileRow | null>(
      null
    );

  const [
    currentUserId,
    setCurrentUserId,
  ] =
    useState<string | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    followLoading,
    setFollowLoading,
  ] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");


  const creatorProducts =
    useMemo(
      () =>
        products.filter(
          product =>
            product.creatorUserId ===
            profileUserId
        ),
      [
        products,
        profileUserId,
      ]
    );


  async function fetchProfile(
    showLoading = true
  ) {
    if (showLoading) {
      setLoading(true);
    }

    setErrorMessage("");

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

      setCurrentUserId(
        authData.user?.id ??
        null
      );


      const {
        data,
        error,
      } =
        await supabase
          .rpc(
            "get_public_profile",
            {
              target_user_id:
                profileUserId,
            }
          )
          .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error(
          "Profil tidak ditemukan."
        );
      }

      setProfile(
        data as unknown as
          PublicProfileRow
      );

    } catch (error) {
      console.error(
        "Profil publik gagal dimuat:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Profil belum dapat dimuat."
      );

    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }


  useEffect(() => {
    void fetchProfile(true);
  }, [profileUserId]);


  async function handleFollowToggle() {
    if (
      !profile ||
      !currentUserId ||
      currentUserId ===
        profileUserId ||
      followLoading
    ) {
      return;
    }

    setFollowLoading(true);
    setErrorMessage("");

    try {
      if (profile.is_following) {
        const {
          error,
        } =
          await supabase
            .from(
              "app_profile_follows"
            )
            .delete()
            .eq(
              "follower_user_id",
              currentUserId
            )
            .eq(
              "following_user_id",
              profileUserId
            );

        if (error) {
          throw error;
        }

      } else {
        const {
          error,
        } =
          await supabase
            .from(
              "app_profile_follows"
            )
            .insert({
              follower_user_id:
                currentUserId,

              following_user_id:
                profileUserId,
            });

        if (error) {
          throw error;
        }
      }

      await fetchProfile(false);

    } catch (error) {
      console.error(
        "Follow gagal disimpan:",
        error
      );

      setErrorMessage(
        "Perubahan Follow belum dapat disimpan."
      );

    } finally {
      setFollowLoading(false);
    }
  }


  const isOwnProfile =
    currentUserId ===
    profileUserId;


  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={[
        "top",
        "bottom",
      ]}
    >
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#FFFFFF"
      />

      <View
        style={styles.header}
      >
        <Pressable
          style={styles.backButton}
          onPress={onBack}
          hitSlop={8}
        >
          <ChevronLeft
            size={25}
            color="#0F172A"
          />
        </Pressable>

        <Text
          style={styles.headerTitle}
        >
          Profil
        </Text>

        <View
          style={styles.headerSpacer}
        />
      </View>


      {loading ? (
        <View
          style={styles.center}
        >
          <ActivityIndicator
            size="small"
            color="#2563EB"
          />

          <Text
            style={styles.loadingText}
          >
            Memuat profil...
          </Text>
        </View>

      ) : !profile ? (
        <View
          style={styles.center}
        >
          <Text
            style={styles.errorTitle}
          >
            Profil belum tersedia
          </Text>

          <Text
            style={styles.errorText}
          >
            {errorMessage ||
              "Profil tidak ditemukan."}
          </Text>

          <Pressable
            style={styles.retryButton}
            onPress={() =>
              void fetchProfile(true)
            }
          >
            <Text
              style={styles.retryText}
            >
              Coba lagi
            </Text>
          </Pressable>
        </View>

      ) : (
        <ScrollView
          showsVerticalScrollIndicator={
            false
          }
          contentContainerStyle={
            styles.content
          }
        >
          <View
            style={styles.profileTop}
          >
            <View
              style={styles.avatar}
            >
              {profile.avatar_url ? (
                <Image
                  source={{
                    uri:
                      profile.avatar_url,
                  }}
                  style={
                    styles.avatarImage
                  }
                  resizeMode="cover"
                />
              ) : (
                <Text
                  style={
                    styles.avatarText
                  }
                >
                  {getInitial(
                    profile.full_name
                  )}
                </Text>
              )}
            </View>


            <Text
              style={styles.name}
              numberOfLines={1}
            >
              {profile.full_name}
            </Text>

            <Text
              style={styles.username}
            >
              {profile.username
                ? `@${profile.username}`
                : "@diginaz"}
            </Text>


            <View
              style={styles.stats}
            >
              <View
                style={styles.stat}
              >
                <Text
                  style={
                    styles.statNumber
                  }
                >
                  {
                    profile.following_count
                  }
                </Text>

                <Text
                  style={
                    styles.statLabel
                  }
                >
                  Mengikuti
                </Text>
              </View>


              <View
                style={styles.stat}
              >
                <Text
                  style={
                    styles.statNumber
                  }
                >
                  {
                    profile.follower_count
                  }
                </Text>

                <Text
                  style={
                    styles.statLabel
                  }
                >
                  Pengikut
                </Text>
              </View>


              <View
                style={styles.stat}
              >
                <Text
                  style={
                    styles.statNumber
                  }
                >
                  {profile.like_count}
                </Text>

                <Text
                  style={
                    styles.statLabel
                  }
                >
                  Suka
                </Text>
              </View>
            </View>


            {!isOwnProfile ? (
              <Pressable
                style={[
                  styles.followButton,

                  profile.is_following &&
                    styles.followingButton,
                ]}
                disabled={
                  followLoading
                }
                onPress={() =>
                  void handleFollowToggle()
                }
              >
                {followLoading ? (
                  <ActivityIndicator
                    size="small"
                    color={
                      profile.is_following
                        ? "#0F172A"
                        : "#FFFFFF"
                    }
                  />
                ) : (
                  <Text
                    style={[
                      styles.followText,

                      profile.is_following &&
                        styles.followingText,
                    ]}
                  >
                    {profile.is_following
                      ? "Mengikuti"
                      : "Follow"}
                  </Text>
                )}
              </Pressable>
            ) : null}


            {profile.bio?.trim() ? (
              <Text
                style={styles.bio}
              >
                {profile.bio.trim()}
              </Text>
            ) : null}
          </View>


          <View
            style={styles.sectionHeader}
          >
            <Text
              style={styles.sectionTitle}
            >
              Produk
            </Text>
          </View>


          {!profile.can_view_content ? (
            <View
              style={styles.privateBox}
            >
              <Text
                style={
                  styles.privateTitle
                }
              >
                Akun ini privat
              </Text>

              <Text
                style={
                  styles.privateText
                }
              >
                Follow akun ini untuk melihat produk yang tampil di profil.
              </Text>
            </View>

          ) : creatorProducts.length ===
            0 ? (
            <View
              style={styles.empty}
            >
              <PackageOpen
                size={34}
                color="#94A3B8"
              />

              <Text
                style={
                  styles.emptyTitle
                }
              >
                Belum ada produk
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                Produk kreator akan tampil di sini.
              </Text>
            </View>

          ) : (
            <View
              style={styles.grid}
            >
              {creatorProducts.map(
                product => (
                  <Pressable
                    key={product.id}
                    style={
                      styles.gridItem
                    }
                    onPress={() =>
                      onOpenProduct(
                        product
                      )
                    }
                  >
                    <View
                      style={
                        styles.productImageWrap
                      }
                    >
                      {product.thumbnailUrl ? (
                        <Image
                          source={{
                            uri:
                              product.thumbnailUrl,
                          }}
                          style={
                            styles.productImage
                          }
                          resizeMode="cover"
                        />
                      ) : (
                        <View
                          style={
                            styles.productFallback
                          }
                        >
                          <PackageOpen
                            size={23}
                            color="#94A3B8"
                          />
                        </View>
                      )}
                    </View>

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
                        styles.productPrice
                      }
                      numberOfLines={1}
                    >
                      {product.price}
                    </Text>
                  </Pressable>
                )
              )}
            </View>
          )}


          {errorMessage ? (
            <Text
              style={
                styles.inlineError
              }
            >
              {errorMessage}
            </Text>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}


const styles =
  StyleSheet.create({

    safeArea: {
      flex: 1,
      backgroundColor: "#FFFFFF",
    },

    header: {
      height: 54,
      paddingHorizontal: 10,
      flexDirection: "row",
      alignItems: "center",
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor: "#E2E8F0",
    },

    backButton: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
    },

    headerTitle: {
      flex: 1,
      textAlign: "center",
      fontSize: 16,
      color: "#0F172A",
      fontFamily:
        "PlusJakartaSans_700Bold",
    },

    headerSpacer: {
      width: 44,
    },

    center: {
      flex: 1,
      paddingHorizontal: 24,
      alignItems: "center",
      justifyContent: "center",
    },

    loadingText: {
      marginTop: 10,
      fontSize: 12,
      color: "#64748B",
      fontFamily:
        "PlusJakartaSans_500Medium",
    },

    errorTitle: {
      fontSize: 15,
      color: "#0F172A",
      fontFamily:
        "PlusJakartaSans_700Bold",
    },

    errorText: {
      marginTop: 6,
      textAlign: "center",
      fontSize: 12,
      lineHeight: 18,
      color: "#64748B",
      fontFamily:
        "PlusJakartaSans_400Regular",
    },

    retryButton: {
      marginTop: 16,
      minHeight: 40,
      paddingHorizontal: 18,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#2563EB",
    },

    retryText: {
      fontSize: 12,
      color: "#FFFFFF",
      fontFamily:
        "PlusJakartaSans_600SemiBold",
    },

    content: {
      paddingBottom: 36,
    },

    profileTop: {
      paddingTop: 22,
      paddingHorizontal: 18,
      alignItems: "center",
    },

    avatar: {
      width: 82,
      height: 82,
      borderRadius: 41,
      overflow: "hidden",
      backgroundColor: "#E2E8F0",
      alignItems: "center",
      justifyContent: "center",
    },

    avatarImage: {
      width: "100%",
      height: "100%",
    },

    avatarText: {
      fontSize: 28,
      color: "#475569",
      fontFamily:
        "PlusJakartaSans_700Bold",
    },

    name: {
      marginTop: 12,
      fontSize: 19,
      color: "#0F172A",
      fontFamily:
        "PlusJakartaSans_700Bold",
    },

    username: {
      marginTop: 2,
      fontSize: 12,
      color: "#64748B",
      fontFamily:
        "PlusJakartaSans_400Regular",
    },

    stats: {
      marginTop: 16,
      width: "76%",
      flexDirection: "row",
      justifyContent: "space-between",
    },

    stat: {
      minWidth: 64,
      alignItems: "center",
    },

    statNumber: {
      fontSize: 15,
      color: "#0F172A",
      fontFamily:
        "PlusJakartaSans_700Bold",
    },

    statLabel: {
      marginTop: 2,
      fontSize: 10,
      color: "#64748B",
      fontFamily:
        "PlusJakartaSans_400Regular",
    },

    followButton: {
      marginTop: 16,
      minWidth: 150,
      minHeight: 42,
      paddingHorizontal: 22,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#2563EB",
    },

    followingButton: {
      backgroundColor: "#FFFFFF",
      borderWidth: 1,
      borderColor: "#CBD5E1",
    },

    followText: {
      fontSize: 13,
      color: "#FFFFFF",
      fontFamily:
        "PlusJakartaSans_700Bold",
    },

    followingText: {
      color: "#0F172A",
    },

    bio: {
      width: "100%",
      marginTop: 16,
      textAlign: "center",
      fontSize: 12,
      lineHeight: 18,
      color: "#334155",
      fontFamily:
        "PlusJakartaSans_400Regular",
    },

    sectionHeader: {
      marginTop: 24,
      height: 46,
      paddingHorizontal: 18,
      justifyContent: "center",
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderColor: "#E2E8F0",
    },

    sectionTitle: {
      fontSize: 13,
      color: "#0F172A",
      fontFamily:
        "PlusJakartaSans_700Bold",
    },

    privateBox: {
      marginHorizontal: 20,
      marginTop: 30,
      padding: 22,
      borderRadius: 14,
      backgroundColor: "#F8FAFC",
      alignItems: "center",
    },

    privateTitle: {
      fontSize: 14,
      color: "#0F172A",
      fontFamily:
        "PlusJakartaSans_700Bold",
    },

    privateText: {
      marginTop: 6,
      textAlign: "center",
      fontSize: 11,
      lineHeight: 17,
      color: "#64748B",
      fontFamily:
        "PlusJakartaSans_400Regular",
    },

    empty: {
      paddingTop: 46,
      alignItems: "center",
    },

    emptyTitle: {
      marginTop: 9,
      fontSize: 13,
      color: "#334155",
      fontFamily:
        "PlusJakartaSans_600SemiBold",
    },

    emptyText: {
      marginTop: 4,
      fontSize: 11,
      color: "#94A3B8",
      fontFamily:
        "PlusJakartaSans_400Regular",
    },

    grid: {
      paddingHorizontal: 12,
      paddingTop: 12,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },

    gridItem: {
      width: "31.5%",
    },

    productImageWrap: {
      width: "100%",
      aspectRatio: 0.8,
      borderRadius: 8,
      overflow: "hidden",
      backgroundColor: "#F1F5F9",
    },

    productImage: {
      width: "100%",
      height: "100%",
    },

    productFallback: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },

    productTitle: {
      marginTop: 6,
      fontSize: 10.5,
      lineHeight: 14,
      color: "#0F172A",
      fontFamily:
        "PlusJakartaSans_600SemiBold",
    },

    productPrice: {
      marginTop: 3,
      fontSize: 9.5,
      color: "#2563EB",
      fontFamily:
        "PlusJakartaSans_600SemiBold",
    },

    inlineError: {
      marginTop: 18,
      paddingHorizontal: 20,
      textAlign: "center",
      fontSize: 11,
      color: "#DC2626",
      fontFamily:
        "PlusJakartaSans_500Medium",
    },
  });

import { getLocalUser } from "../lib/localAuth";

import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  ArrowLeft,
  Grid3X3,
  LogOut,
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


type ProfileRow = {
  id: string;
  auth_user_id: string | null;
  email: string;
  full_name: string;
  app_role: string;
  status: string;
  school_id: string | null;
  class_level: string | null;
  subject_id: string | null;
  bio: string | null;
};


type Props = {
  onBack: () => void;

  products:
    StoreProductCardItem[];

  onOpenProduct: (
    product: StoreProductCardItem
  ) => void;
};


function roleLabel(
  value: string | null
) {
  switch (value) {
    case "guru_kelas":
      return "Guru Kelas";

    case "guru_mapel":
      return "Guru Mapel";

    case "siswa":
      return "Siswa";

    case "ops":
    case "admin":
    case "ops_admin":
      return "Ops / Admin";

    default:
      return "Pengguna Diginaz";
  }
}


function getInitial(
  name: string
) {
  const clean =
    name.trim();

  if (!clean) {
    return "D";
  }

  return clean
    .charAt(0)
    .toUpperCase();
}


function getUsername(
  email: string
) {
  const local =
    email
      .trim()
      .split("@")[0]
      ?.replace(
        /[^a-zA-Z0-9._-]/g,
        ""
      );

  return local
    ? `@${local}`
    : "@diginaz";
}


export default function ProfileScreen({
  onBack,
  products,
  onOpenProduct,
}: Props) {

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    logoutLoading,
    setLogoutLoading,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    currentUserId,
    setCurrentUserId,
  ] = useState<string | null>(
    null
  );

  const [
    name,
    setName,
  ] = useState(
    "Pengguna Diginaz"
  );

  const [
    email,
    setEmail,
  ] = useState("");

  const [
    role,
    setRole,
  ] =
    useState<string | null>(
      null
    );
  const [
    bio,
    setBio,
  ] = useState("");

  const [
    followerCount,
    setFollowerCount,
  ] = useState(0);

  const [
    followingCount,
    setFollowingCount,
  ] = useState(0);

  const [
    likeCount,
    setLikeCount,
  ] = useState(0);


  const myProducts =
    useMemo(
      () =>
        currentUserId
          ? products.filter(
              (product) =>
                product.creatorUserId ===
                currentUserId
            )
          : [],
      [
        products,
        currentUserId,
      ]
    );


  const totalDownloads =
    useMemo(
      () =>
        myProducts.reduce(
          (
            total,
            product
          ) =>
            total +
            Number(
              product.downloadCount ??
                0
            ),
          0
        ),
      [myProducts]
    );


  useEffect(() => {
    let active = true;

    async function loadProfile() {
      setErrorMessage("");

      try {
        const {
          data: userData,
          error: userError,
        } =
          await getLocalUser();

        if (userError) {
          throw userError;
        }

        const user =
          userData.user;

        if (!user) {
          throw new Error(
            "Session pengguna tidak ditemukan."
          );
        }

        const fallbackName =
          String(
            user.user_metadata
              ?.full_name ||
            user.user_metadata
              ?.name ||
            user.email ||
            "Pengguna Diginaz"
          ).trim();

        const fallbackEmail =
          user.email ?? "";

        if (!active) {
          return;
        }

        /*
         * Tampilkan data lokal dulu.
         * Profil tidak menunggu query server.
         */
        setCurrentUserId(
          user.id
        );

        setName(
          fallbackName
        );

        setEmail(
          fallbackEmail
        );

        setLoading(false);


        let profileRow:
          ProfileRow | null =
          null;

        const {
          data: byAuthId,
          error: authProfileError,
        } =
          await supabase
            .from("app_profiles")
            .select(
              "id,auth_user_id,email,full_name,app_role,status,school_id,class_level,subject_id,bio"
            )
            .eq(
              "auth_user_id",
              user.id
            )
            .maybeSingle();

        if (authProfileError) {
          throw authProfileError;
        }

        if (byAuthId) {
          profileRow =
            byAuthId as unknown as
              ProfileRow;
        }
        else if (
          fallbackEmail
        ) {
          const {
            data: byEmail,
            error: emailProfileError,
          } =
            await supabase
              .from(
                "app_profiles"
              )
              .select(
                "id,auth_user_id,email,full_name,app_role,status,school_id,class_level,subject_id,bio"
              )
              .ilike(
                "email",
                fallbackEmail
              )
              .limit(1)
              .maybeSingle();

          if (
            emailProfileError
          ) {
            throw emailProfileError;
          }

          if (byEmail) {
            profileRow =
              byEmail as unknown as
                ProfileRow;
          }
        }

        if (!active) {
          return;
        }

        setName(
          profileRow
            ?.full_name
            ?.trim() ||
            fallbackName
        );

        setEmail(
          profileRow
            ?.email
            ?.trim() ||
            fallbackEmail
        );

        setRole(
          profileRow
            ?.app_role ??
            null
        );
        setBio(
          profileRow
            ?.bio
            ?.trim() ??
            ""
        );

      } catch (error) {

        console.error(
          "Gagal memuat profil:",
          error
        );

        if (active) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Profil belum dapat dimuat."
          );

          setLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, []);


  useEffect(() => {
    let active = true;

    async function loadSocialStats() {
      if (!currentUserId) {
        return;
      }

      try {
        const [
          followersResult,
          followingResult,
        ] =
          await Promise.all([
            supabase
              .from(
                "app_profile_follows"
              )
              .select(
                "follower_user_id",
                {
                  count: "exact",
                  head: true,
                }
              )
              .eq(
                "following_user_id",
                currentUserId
              ),

            supabase
              .from(
                "app_profile_follows"
              )
              .select(
                "following_user_id",
                {
                  count: "exact",
                  head: true,
                }
              )
              .eq(
                "follower_user_id",
                currentUserId
              ),
          ]);

        if (
          followersResult.error
        ) {
          throw followersResult.error;
        }

        if (
          followingResult.error
        ) {
          throw followingResult.error;
        }

        const productIds =
          products
            .filter(
              (product) =>
                product.creatorUserId ===
                currentUserId
            )
            .map(
              (product) =>
                product.id
            );

        let receivedLikes = 0;

        if (
          productIds.length > 0
        ) {
          const likesResult =
            await supabase
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
              .in(
                "product_id",
                productIds
              );

          if (
            likesResult.error
          ) {
            throw likesResult.error;
          }

          receivedLikes =
            likesResult.count ?? 0;
        }

        if (!active) {
          return;
        }

        setFollowerCount(
          followersResult.count ??
            0
        );

        setFollowingCount(
          followingResult.count ??
            0
        );

        setLikeCount(
          receivedLikes
        );

      } catch (error) {
        console.warn(
          "Statistik sosial gagal dimuat:",
          error
        );
      }
    }

    void loadSocialStats();

    return () => {
      active = false;
    };
  }, [
    currentUserId,
    products,
  ]);

  async function handleLogout() {
    if (logoutLoading) {
      return;
    }

    setLogoutLoading(true);
    setErrorMessage("");

    try {
      const {
        GoogleSignin,
      } =
        await import(
          "@react-native-google-signin/google-signin"
        );

      await GoogleSignin.signOut();

      const {
        error,
      } =
        await supabase.auth
          .signOut();

      if (error) {
        throw error;
      }

    } catch (error) {
      console.error(
        "Logout gagal:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Belum dapat keluar."
      );

    } finally {
      setLogoutLoading(false);
    }
  }


  function confirmLogout() {
    Alert.alert(
      "Keluar dari Diginaz?",
      "Anda perlu masuk kembali untuk menggunakan Diginaz.",
      [
        {
          text: "Batal",
          style: "cancel",
        },
        {
          text: "Keluar",
          style: "destructive",
          onPress: () => {
            void handleLogout();
          },
        },
      ]
    );
  }


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
        style={styles.topBar}
      >
        <Pressable
          onPress={onBack}
          style={
            styles.topButton
          }
          hitSlop={8}
        >
          <ArrowLeft
            size={24}
            color="#0F172A"
          />
        </Pressable>

        <Text
          style={styles.topTitle}
        >
          Profil
        </Text>

        <Pressable
          onPress={
            confirmLogout
          }
          style={
            styles.topButton
          }
          hitSlop={8}
          disabled={
            logoutLoading
          }
        >
          {logoutLoading ? (
            <ActivityIndicator
              size="small"
              color="#64748B"
            />
          ) : (
            <LogOut
              size={21}
              color="#0F172A"
            />
          )}
        </Pressable>
      </View>


      {loading ? (
        <View
          style={styles.center}
        >
          <ActivityIndicator
            size="small"
            color="#2563EB"
          />
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
            style={
              styles.profileHero
            }
          >
            <View
              style={
                styles.identityRow
              }
            >
              <View
                style={
                  styles.identityText
                }
              >
                <Text
                  style={
                    styles.name
                  }
                  numberOfLines={2}
                >
                  {name}
                </Text>

                <Text
                  style={
                    styles.username
                  }
                  numberOfLines={1}
                >
                  {getUsername(
                    email
                  )}
                </Text>


              </View>

              <View
                style={
                  styles.avatar
                }
              >
                <Text
                  style={
                    styles.avatarText
                  }
                >
                  {getInitial(
                    name
                  )}
                </Text>
              </View>
            </View>


            <View
              style={
                styles.socialStats
              }
            >
              <View
                style={
                  styles.socialStat
                }
              >
                <Text
                  style={
                    styles.socialNumber
                  }
                >
                  {followingCount}
                </Text>

                <Text
                  style={
                    styles.socialLabel
                  }
                >
                  Mengikuti
                </Text>
              </View>

              <View
                style={
                  styles.socialStat
                }
              >
                <Text
                  style={
                    styles.socialNumber
                  }
                >
                  {followerCount}
                </Text>

                <Text
                  style={
                    styles.socialLabel
                  }
                >
                  Pengikut
                </Text>
              </View>

              <View
                style={
                  styles.socialStat
                }
              >
                <Text
                  style={
                    styles.socialNumber
                  }
                >
                  {likeCount}
                </Text>

                <Text
                  style={
                    styles.socialLabel
                  }
                >
                  Suka
                </Text>
              </View>
            </View>


            <View
              style={
                styles.bioSection
              }
            >
              <Text
                style={
                  styles.bioText
                }
              >
                {bio ||
                  "Belum ada bio."}
              </Text>
            </View>
          </View>

          {errorMessage ? (
            <Text
              style={
                styles.errorText
              }
            >
              {errorMessage}
            </Text>
          ) : null}


          <View
            style={styles.tabBar}
          >
            <View
              style={
                styles.activeTab
              }
            >
              <Grid3X3
                size={19}
                color="#0F172A"
                strokeWidth={2.1}
              />

              <Text
                style={
                  styles.activeTabText
                }
              >
                Produk Saya
              </Text>
            </View>
          </View>


          {myProducts.length ===
          0 ? (
            <View
              style={styles.empty}
            >
              <PackageOpen
                size={32}
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
                Produk yang Anda
                publikasikan akan
                tampil di sini.
              </Text>
            </View>
          ) : (
            <View
              style={styles.grid}
            >
              {myProducts.map(
                (product) => (
                  <Pressable
                    key={
                      product.id
                    }
                    onPress={() =>
                      onOpenProduct(
                        product
                      )
                    }
                    style={
                      styles.gridItem
                    }
                  >
                    <View
                      style={
                        styles.productVisual
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
                            styles.productPlaceholder
                          }
                        >
                          <PackageOpen
                            size={28}
                            color="#94A3B8"
                          />
                        </View>
                      )}

                      <View
                        style={
                          styles.productOverlay
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
                            styles.productPrice
                          }
                          numberOfLines={1}
                        >
                          {product.price}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                )
              )}
            </View>
          )}

        </ScrollView>
      )}
    </SafeAreaView>
  );
}


const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor:
        "#FFFFFF",
    },

    topBar: {
      height: 56,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        "#E2E8F0",
    },

    topButton: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent:
        "center",
    },

    topTitle: {
      fontSize: 16,
      fontFamily: "PlusJakartaSans_700Bold",
      color: "#0F172A",
    },

    center: {
      flex: 1,
      alignItems: "center",
      justifyContent:
        "center",
    },

    content: {
      paddingBottom: 36,
    },

    profileHero: {
      paddingTop: 8,
      paddingHorizontal: 20,
      paddingBottom: 0,
    },

    identityRow: {
      position: "relative",
    },

    identityText: {
      paddingRight: 100,
    },

    avatar: {
      position: "absolute",
      top: 0,
      right: 0,
      width: 84,
      height: 84,
      borderRadius: 42,
      backgroundColor:
        "#E8F0FF",
      alignItems: "center",
      justifyContent:
        "center",
      borderWidth: 1,
      borderColor:
        "#D7E3FA",
    },

    avatarText: {
      fontSize: 35,
      fontFamily: "PlusJakartaSans_700Bold",
      color: "#2563EB",
    },

    name: {
      fontSize: 25,
      lineHeight: 29,
      fontFamily: "PlusJakartaSans_700Bold",
      color: "#0F172A",
    },

    username: {
      marginTop: 0,
      fontSize: 11,
      color: "#64748B",
      fontFamily: "PlusJakartaSans_400Regular",
    },


    socialStats: {
      marginTop: 7,
      width: "64%",
      paddingRight: 6,
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
    },

    socialStat: {
      marginRight: 0,
    },

    socialNumber: {
      fontSize: 16,
      fontFamily: "PlusJakartaSans_700Bold",
      color: "#0F172A",
    },

    socialLabel: {
      marginTop: 0,
      fontSize: 12,
      color: "#64748B",
      fontFamily: "PlusJakartaSans_400Regular",
    },

    bioSection: {
      marginTop: 4,
    },

    bioText: {
      fontSize: 14,
      lineHeight: 19,
      color: "#0F172A",
      fontFamily: "PlusJakartaSans_400Regular",
    },
    errorText: {
      marginHorizontal: 20,
      marginBottom: 12,
      padding: 10,
      borderRadius: 10,
      backgroundColor:
        "#FEF2F2",
      color: "#B91C1C",
      fontSize: 12,
      textAlign: "center",
    },

    tabBar: {
      marginTop: 0,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderColor: "#E2E8F0",
      height: 46,
      alignItems: "center",
      justifyContent:
        "center",
    },

    activeTab: {
      height: "100%",
      paddingHorizontal: 18,
      flexDirection: "row",
      gap: 7,
      alignItems: "center",
      justifyContent:
        "center",
      borderBottomWidth: 2,
      borderBottomColor:
        "#0F172A",
    },

    activeTabText: {
      fontSize: 13,
      fontFamily: "PlusJakartaSans_700Bold",
      color: "#0F172A",
    },

    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingTop: 1,
    },

    gridItem: {
      width: "33.3333%",
      padding: 1,
    },

    productVisual: {
      aspectRatio: 0.78,
      backgroundColor:
        "#F1F5F9",
      overflow: "hidden",
    },

    productImage: {
      width: "100%",
      height: "100%",
    },

    productPlaceholder: {
      flex: 1,
      alignItems: "center",
      justifyContent:
        "center",
      backgroundColor:
        "#F1F5F9",
    },

    productOverlay: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      minHeight: 56,
      paddingHorizontal: 7,
      paddingTop: 16,
      paddingBottom: 7,
      backgroundColor:
        "rgba(15,23,42,0.70)",
      justifyContent:
        "flex-end",
    },

    productTitle: {
      fontSize: 11,
      lineHeight: 14,
      fontFamily: "PlusJakartaSans_700Bold",
      color: "#FFFFFF",
    },

    productPrice: {
      marginTop: 2,
      fontSize: 10,
      color: "#E2E8F0",
      fontFamily: "PlusJakartaSans_400Regular",
    },

    empty: {
      paddingVertical: 58,
      paddingHorizontal: 24,
      alignItems: "center",
    },

    emptyTitle: {
      marginTop: 12,
      fontSize: 15,
      fontFamily: "PlusJakartaSans_700Bold",
      color: "#334155",
    },

    emptyText: {
      marginTop: 5,
      maxWidth: 240,
      fontSize: 12,
      lineHeight: 18,
      textAlign: "center",
      color: "#94A3B8",
      fontFamily: "PlusJakartaSans_400Regular",
    },
  });
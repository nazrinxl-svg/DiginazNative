import { Bookmark } from "lucide-react-native";
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
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  ArrowLeft,
  Camera,
  ChevronRight,
  Grid3X3,
  LogOut,
  MoreVertical,
  PackageOpen,
  PencilLine,
  Settings,
  Shield,
  ChevronLeft
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
  username: string | null;
  avatar_url: string | null;
};


type Props = {
  onBack: () => void;

  initialName?: string;
  initialAvatarUrl?: string;

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
  initialName = "",
  initialAvatarUrl = "",
  products,
  onOpenProduct,
}: Props) {

  const [
    loading,
    setLoading,
  ] = useState(
    !(
      initialName.trim() ||
      initialAvatarUrl.trim()
    )
  );

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
    initialName.trim() ||
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
    username,
    setUsername,
  ] = useState("");

  const [
    avatarUrl,
    setAvatarUrl,
  ] = useState(
    initialAvatarUrl.trim()
  );

  const [
    showSettingsMenu,
    setShowSettingsMenu,
  ] = useState(false);

  const [
    showEditProfile,
    setShowEditProfile,
  ] = useState(false);

  const [
    showAccountSettings,
    setShowAccountSettings,
  ] = useState(false);

  const [
    accountProvider,
    setAccountProvider,
  ] = useState(
    "Memuat..."
  );

  const [
    emailVerified,
    setEmailVerified,
  ] = useState(false);

  const [
    accountSettingsLoading,
    setAccountSettingsLoading,
  ] = useState(false);

  const [
    passwordResetLoading,
    setPasswordResetLoading,
  ] = useState(false);

  const [
    showPrivacySettings,
    setShowPrivacySettings,
  ] = useState(false);

  const [
    privacyLoading,
    setPrivacyLoading,
  ] = useState(false);

  const [
    privacySaving,
    setPrivacySaving,
  ] = useState(false);

  const [
    isPrivateAccount,
    setIsPrivateAccount,
  ] = useState(false);

  const [
    allowMessagesFrom,
    setAllowMessagesFrom,
  ] = useState<
    "everyone" |
    "following" |
    "none"
  >("everyone");

  const [
    showLikedProducts,
    setShowLikedProducts,
  ] = useState(true);

  const [
    editName,
    setEditName,
  ] = useState("");

  const [
    editUsername,
    setEditUsername,
  ] = useState("");

  const [
    editBio,
    setEditBio,
  ] = useState("");

  const [
    savingProfile,
    setSavingProfile,
  ] = useState(false);

  const [
    photoUploading,
    setPhotoUploading,
  ] = useState(false);

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


  const [
    activeProductTab,
    setActiveProductTab,
  ] =
    useState<
      "mine" | "saved"
    >("mine");

  // SAVED_PRODUCTS_V1
  const [
    savedProductIds,
    setSavedProductIds,
  ] =
    useState<string[]>([]);

  const [
    savedLoading,
    setSavedLoading,
  ] = useState(false);

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


  const savedProducts =
    useMemo(
      () =>
        savedProductIds
          .map(
            productId =>
              products.find(
                product =>
                  product.id ===
                  productId
              )
          )
          .filter(
            (
              product
            ): product is StoreProductCardItem =>
              Boolean(product)
          ),
      [
        products,
        savedProductIds,
      ]
    );

  const visibleProducts =
    activeProductTab ===
    "saved"
      ? savedProducts
      : myProducts;

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

    async function loadSavedProducts() {
      if (!currentUserId) {
        setSavedProductIds([]);
        return;
      }

      setSavedLoading(true);

      try {
        const {
          data,
          error,
        } =
          await supabase
            .from(
              "store_product_saves"
            )
            .select(
              "product_id,created_at"
            )
            .eq(
              "user_id",
              currentUserId
            )
            .order(
              "created_at",
              {
                ascending: false,
              }
            );

        if (error) {
          throw error;
        }

        if (!active) {
          return;
        }

        setSavedProductIds(
          (data ?? [])
            .map(
              row =>
                String(
                  row.product_id ??
                    ""
                )
            )
            .filter(Boolean)
        );
      }
      catch (error) {
        console.warn(
          "Produk tersimpan gagal dimuat:",
          error
        );

        if (active) {
          setSavedProductIds([]);
        }
      }
      finally {
        if (active) {
          setSavedLoading(false);
        }
      }
    }

    void loadSavedProducts();

    return () => {
      active = false;
    };
  }, [currentUserId]);


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

        setEmail(
          fallbackEmail
        );


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
              "id,auth_user_id,email,full_name,app_role,status,school_id,class_level,subject_id,bio,username,avatar_url"
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
                "id,auth_user_id,email,full_name,app_role,status,school_id,class_level,subject_id,bio,username,avatar_url"
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

        setUsername(
          profileRow
            ?.username
            ?.trim() ??
            getUsername(
              fallbackEmail
            ).replace(
              /^@/,
              ""
            )
        );

        setAvatarUrl(
          profileRow
            ?.avatar_url
            ?.trim() ||
            initialAvatarUrl.trim()
        );

        setLoading(false);

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

  async function openAccountSettings() {
    setShowSettingsMenu(
      false
    );

    setShowAccountSettings(
      true
    );

    setAccountSettingsLoading(
      true
    );

    try {
      const {
        data,
        error,
      } =
        await supabase.auth
          .getUser();

      if (error) {
        throw error;
      }

      const user =
        data.user;

      if (user?.email) {
        setEmail(
          user.email
        );
      }

      const rawProvider =
        String(
          user?.app_metadata
            ?.provider ??
          user?.identities?.[0]
            ?.provider ??
          "email"
        ).toLowerCase();

      if (
        rawProvider ===
        "google"
      ) {
        setAccountProvider(
          "Google"
        );
      }
      else if (
        rawProvider ===
        "email"
      ) {
        setAccountProvider(
          "Email & kata sandi"
        );
      }
      else {
        setAccountProvider(
          rawProvider
        );
      }

      setEmailVerified(
        Boolean(
          user?.email_confirmed_at
        )
      );

    } catch (error) {
      console.error(
        "Gagal memuat pengaturan akun:",
        error
      );

      setAccountProvider(
        "Tidak diketahui"
      );

      Alert.alert(
        "Pengaturan akun",
        "Data akun belum dapat dimuat."
      );

    } finally {
      setAccountSettingsLoading(
        false
      );
    }
  }


  async function handlePasswordReset() {
    if (
      passwordResetLoading
    ) {
      return;
    }

    if (
      accountProvider ===
      "Google"
    ) {
      Alert.alert(
        "Akun Google",
        "Kata sandi akun ini dikelola melalui akun Google Anda."
      );

      return;
    }

    const accountEmail =
      email.trim();

    if (!accountEmail) {
      Alert.alert(
        "Email tidak tersedia",
        "Email akun belum tersedia."
      );

      return;
    }

    setPasswordResetLoading(
      true
    );

    try {
      const {
        error,
      } =
        await supabase.auth
          .resetPasswordForEmail(
            accountEmail
          );

      if (error) {
        throw error;
      }

      Alert.alert(
        "Email reset dikirim",
        "Tautan untuk mengubah kata sandi telah dikirim ke " +
          accountEmail +
          "."
      );

    } catch (error) {
      console.error(
        "Gagal mengirim reset password:",
        error
      );

      Alert.alert(
        "Belum dapat mengubah kata sandi",
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat mengirim email reset."
      );

    } finally {
      setPasswordResetLoading(
        false
      );
    }
  }


  async function openPrivacySettings() {
    setShowSettingsMenu(
      false
    );

    setShowPrivacySettings(
      true
    );

    if (!currentUserId) {
      return;
    }

    setPrivacyLoading(
      true
    );

    try {
      const {
        data,
        error,
      } =
        await supabase
          .from("app_profiles")
          .select(
            "is_private,allow_messages_from,show_liked_products"
          )
          .eq(
            "auth_user_id",
            currentUserId
          )
          .maybeSingle();

      if (error) {
        throw error;
      }

      setIsPrivateAccount(
        Boolean(
          data?.is_private
        )
      );

      const messageSetting =
        data?.allow_messages_from;

      if (
        messageSetting === "everyone" ||
        messageSetting === "following" ||
        messageSetting === "none"
      ) {
        setAllowMessagesFrom(
          messageSetting
        );
      }

      setShowLikedProducts(
        data?.show_liked_products !== false
      );

    } catch (error) {
      console.error(
        "Gagal memuat privasi:",
        error
      );

      Alert.alert(
        "Privasi",
        "Pengaturan privasi belum dapat dimuat."
      );

    } finally {
      setPrivacyLoading(
        false
      );
    }
  }


  async function togglePrivateAccount() {
    if (
      !currentUserId ||
      privacySaving
    ) {
      return;
    }

    const previous =
      isPrivateAccount;

    const next =
      !previous;

    setIsPrivateAccount(
      next
    );

    setPrivacySaving(
      true
    );

    try {
      const {
        error,
      } =
        await supabase
          .from("app_profiles")
          .update({
            is_private: next,
            updated_at:
              new Date()
                .toISOString(),
          })
          .eq(
            "auth_user_id",
            currentUserId
          );

      if (error) {
        throw error;
      }

    } catch (error) {
      setIsPrivateAccount(
        previous
      );

      console.error(
        "Gagal menyimpan akun privat:",
        error
      );

      Alert.alert(
        "Belum tersimpan",
        "Pengaturan akun privat belum dapat disimpan."
      );

    } finally {
      setPrivacySaving(
        false
      );
    }
  }


  async function changeMessagePrivacy(
    value:
      "everyone" |
      "following" |
      "none"
  ) {
    if (
      !currentUserId ||
      privacySaving ||
      value === allowMessagesFrom
    ) {
      return;
    }

    const previous =
      allowMessagesFrom;

    setAllowMessagesFrom(
      value
    );

    setPrivacySaving(
      true
    );

    try {
      const {
        error,
      } =
        await supabase
          .from("app_profiles")
          .update({
            allow_messages_from:
              value,
            updated_at:
              new Date()
                .toISOString(),
          })
          .eq(
            "auth_user_id",
            currentUserId
          );

      if (error) {
        throw error;
      }

    } catch (error) {
      setAllowMessagesFrom(
        previous
      );

      console.error(
        "Gagal menyimpan privasi pesan:",
        error
      );

      Alert.alert(
        "Belum tersimpan",
        "Pengaturan pesan belum dapat disimpan."
      );

    } finally {
      setPrivacySaving(
        false
      );
    }
  }


  async function toggleLikedProductsVisibility() {
    if (
      !currentUserId ||
      privacySaving
    ) {
      return;
    }

    const previous =
      showLikedProducts;

    const next =
      !previous;

    setShowLikedProducts(
      next
    );

    setPrivacySaving(
      true
    );

    try {
      const {
        error,
      } =
        await supabase
          .from("app_profiles")
          .update({
            show_liked_products:
              next,
            updated_at:
              new Date()
                .toISOString(),
          })
          .eq(
            "auth_user_id",
            currentUserId
          );

      if (error) {
        throw error;
      }

    } catch (error) {
      setShowLikedProducts(
        previous
      );

      console.error(
        "Gagal menyimpan visibilitas suka:",
        error
      );

      Alert.alert(
        "Belum tersimpan",
        "Pengaturan produk yang disukai belum dapat disimpan."
      );

    } finally {
      setPrivacySaving(
        false
      );
    }
  }


  function openEditProfile() {
    const fallbackUsername =
      getUsername(
        email
      ).replace(
        /^@/,
        ""
      );

    setEditName(
      name
    );

    setEditUsername(
      username ||
        fallbackUsername
    );

    setEditBio(
      bio
    );

    setShowSettingsMenu(
      false
    );

    setShowEditProfile(
      true
    );
  }


  function decodeBase64(
    base64: string
  ): ArrayBuffer {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    const clean =
      base64.replace(
        /[^A-Za-z0-9+/=]/g,
        ""
      );

    const padding =
      clean.endsWith("==")
        ? 2
        : clean.endsWith("=")
          ? 1
          : 0;

    const byteLength =
      Math.floor(
        clean.length * 3 / 4
      ) - padding;

    const bytes =
      new Uint8Array(
        byteLength
      );

    let byteIndex =
      0;

    for (
      let index = 0;
      index < clean.length;
      index += 4
    ) {
      const first =
        chars.indexOf(
          clean[index] ?? "A"
        );

      const second =
        chars.indexOf(
          clean[index + 1] ?? "A"
        );

      const thirdChar =
        clean[index + 2] ?? "=";

      const fourthChar =
        clean[index + 3] ?? "=";

      const third =
        thirdChar === "="
          ? 0
          : chars.indexOf(
              thirdChar
            );

      const fourth =
        fourthChar === "="
          ? 0
          : chars.indexOf(
              fourthChar
            );

      const chunk =
        (first << 18) |
        (second << 12) |
        (third << 6) |
        fourth;

      if (
        byteIndex <
        byteLength
      ) {
        bytes[byteIndex] =
          (chunk >> 16) &
          255;

        byteIndex += 1;
      }

      if (
        byteIndex <
        byteLength
      ) {
        bytes[byteIndex] =
          (chunk >> 8) &
          255;

        byteIndex += 1;
      }

      if (
        byteIndex <
        byteLength
      ) {
        bytes[byteIndex] =
          chunk & 255;

        byteIndex += 1;
      }
    }

    return bytes.buffer;
  }


  async function handleChangePhoto() {
    if (
      photoUploading ||
      !currentUserId
    ) {
      return;
    }

    setPhotoUploading(
      true
    );

    let uploadedPath =
      "";

    try {
      const cropModule =
        await import(
          "react-native-image-crop-picker"
        );

      const ImageCropPicker =
        cropModule.default;

      const asset =
        await ImageCropPicker.openPicker({
          mediaType: "photo",
          width: 1024,
          height: 1024,
          cropping: true,
          cropperCircleOverlay: true,
          freeStyleCropEnabled: false,
          includeBase64: true,
          compressImageQuality: 0.82,
          cropperToolbarTitle:
            "Sesuaikan Foto",
          cropperChooseText:
            "Gunakan",
          cropperCancelText:
            "Batal",
        });


      if (
        !asset ||
        !asset.data
      ) {
        throw new Error(
          "Data foto tidak tersedia."
        );
      }


      const mimeType =
        (
          asset.mime ??
          ""
        ).toLowerCase();

      let extension =
        "";

      if (
        mimeType ===
          "image/jpeg" ||
        mimeType ===
          "image/jpg"
      ) {
        extension =
          "jpg";
      }
      else if (
        mimeType ===
        "image/png"
      ) {
        extension =
          "png";
      }
      else if (
        mimeType ===
        "image/webp"
      ) {
        extension =
          "webp";
      }
      else {
        Alert.alert(
          "Format belum didukung",
          "Gunakan foto JPG, PNG, atau WEBP."
        );

        return;
      }


      const arrayBuffer =
        decodeBase64(
          asset.data
        );


      if (
        arrayBuffer.byteLength >
        5 * 1024 * 1024
      ) {
        Alert.alert(
          "Foto terlalu besar",
          "Ukuran foto maksimal 5 MB."
        );

        return;
      }


      uploadedPath =
        currentUserId +
        "/" +
        Date.now() +
        "." +
        extension;


      const {
        error: uploadError,
      } =
        await supabase
          .storage
          .from(
            "profile-avatars"
          )
          .upload(
            uploadedPath,
            arrayBuffer,
            {
              contentType:
                mimeType,
              cacheControl:
                "31536000",
              upsert: false,
            }
          );


      if (uploadError) {
        throw uploadError;
      }


      const {
        data: publicData,
      } =
        supabase
          .storage
          .from(
            "profile-avatars"
          )
          .getPublicUrl(
            uploadedPath
          );


      const publicUrl =
        publicData.publicUrl;

      if (!publicUrl) {
        throw new Error(
          "URL foto tidak tersedia."
        );
      }


      const previousUrl =
        avatarUrl;


      const {
        data: updatedProfile,
        error: profileError,
      } =
        await supabase
          .from(
            "app_profiles"
          )
          .update({
            avatar_url:
              publicUrl,
            updated_at:
              new Date()
                .toISOString(),
          })
          .eq(
            "auth_user_id",
            currentUserId
          )
          .select(
            "avatar_url"
          )
          .maybeSingle();


      if (
        profileError ||
        !updatedProfile
      ) {
        await supabase
          .storage
          .from(
            "profile-avatars"
          )
          .remove([
            uploadedPath,
          ]);

        uploadedPath =
          "";

        if (profileError) {
          throw profileError;
        }

        throw new Error(
          "Profil tidak ditemukan."
        );
      }


      setAvatarUrl(
        updatedProfile
          .avatar_url ??
          publicUrl
      );


      const marker =
        "/storage/v1/object/public/profile-avatars/";

      if (
        previousUrl &&
        previousUrl.includes(
          marker
        )
      ) {
        const encodedOldPath =
          previousUrl
            .split(
              marker
            )[1]
            ?.split("?")[0];

        if (encodedOldPath) {
          const oldPath =
            decodeURIComponent(
              encodedOldPath
            );

          if (
            oldPath &&
            oldPath !==
              uploadedPath
          ) {
            void supabase
              .storage
              .from(
                "profile-avatars"
              )
              .remove([
                oldPath,
              ]);
          }
        }
      }


      uploadedPath =
        "";

    } catch (error) {
      const cropError =
        error as {
          code?: string;
          message?: string;
        };

      if (
        cropError?.code ===
          "E_PICKER_CANCELLED" ||
        cropError?.code ===
          "E_PICKER_CANCEL"
      ) {
        return;
      }

      console.error(
        "Gagal mengganti foto profil:",
        error
      );


      if (uploadedPath) {
        try {
          await supabase
            .storage
            .from(
              "profile-avatars"
            )
            .remove([
              uploadedPath,
            ]);
        }
        catch {
          // cleanup best effort
        }
      }


      Alert.alert(
        "Foto belum dapat diganti",
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat mengunggah foto."
      );

    } finally {
      setPhotoUploading(
        false
      );
    }
  }


  async function saveProfileChanges() {
    if (
      savingProfile ||
      !currentUserId
    ) {
      return;
    }

    const cleanName =
      editName.trim();

    const cleanUsername =
      editUsername
        .trim()
        .toLowerCase()
        .replace(
          /^@+/,
          ""
        );

    const cleanBio =
      editBio.trim();

    if (
      cleanName.length < 2
    ) {
      Alert.alert(
        "Nama belum sesuai",
        "Nama minimal 2 karakter."
      );

      return;
    }

    if (
      !/^[a-z0-9._]{3,30}$/.test(
        cleanUsername
      )
    ) {
      Alert.alert(
        "Username belum sesuai",
        "Gunakan 3-30 karakter: huruf kecil, angka, titik, atau garis bawah."
      );

      return;
    }

    if (
      cleanBio.length > 160
    ) {
      Alert.alert(
        "Bio terlalu panjang",
        "Bio maksimal 160 karakter."
      );

      return;
    }

    setSavingProfile(
      true
    );

    try {
      const {
        data,
        error,
      } =
        await supabase
          .from(
            "app_profiles"
          )
          .update({
            full_name:
              cleanName,
            username:
              cleanUsername,
            bio:
              cleanBio ||
              null,
            updated_at:
              new Date()
                .toISOString(),
          })
          .eq(
            "auth_user_id",
            currentUserId
          )
          .select(
            "full_name,username,bio"
          )
          .maybeSingle();

      if (error) {
        if (
          error.code ===
          "23505"
        ) {
          Alert.alert(
            "Username tidak tersedia",
            "Username tersebut sudah digunakan pengguna lain."
          );

          return;
        }

        throw error;
      }

      if (!data) {
        throw new Error(
          "Profil tidak ditemukan."
        );
      }

      setName(
        data.full_name
      );

      setUsername(
        data.username ??
          cleanUsername
      );

      setBio(
        data.bio ??
          ""
      );

      setShowEditProfile(
        false
      );

    } catch (error) {
      console.error(
        "Gagal menyimpan profil:",
        error
      );

      Alert.alert(
        "Belum dapat menyimpan",
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat menyimpan profil."
      );

    } finally {
      setSavingProfile(
        false
      );
    }
  }


  async function handleLogout() {
    if (logoutLoading) {
      return;
    }

    setLogoutLoading(true);
    setErrorMessage("");

    try {
      /*
       * Logout Google bersifat tambahan.
       * Kalau Google logout gagal, session
       * Supabase tetap HARUS dibersihkan.
       */
      try {
        const {
          GoogleSignin,
        } =
          await import(
            "@react-native-google-signin/google-signin"
          );

        await GoogleSignin.signOut();
      } catch (googleError) {
        console.warn(
          "Google logout dilewati:",
          googleError
        );
      }

      const {
        error,
      } =
        await supabase.auth
          .signOut({
            scope: "local",
          });

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
          onPress={() =>
            setShowSettingsMenu(
              value => !value
            )
          }
          style={
            styles.topButton
          }
          hitSlop={8}
        >
          <MoreVertical
            size={24}
            color="#0F172A"
            strokeWidth={2}
          />
        </Pressable>
      </View>


      <Modal
        visible={
          showAccountSettings
        }
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() =>
          setShowAccountSettings(
            false
          )
        }
      >
        <SafeAreaView
          style={
            styles.accountSettingsSafeArea
          }
          edges={[
            "top",
            "bottom",
          ]}
        >
          <View
            style={
              styles.accountSettingsHeader
            }
          >
            <Pressable
              style={
                styles.accountSettingsBack
              }
              onPress={() =>
                setShowAccountSettings(
                  false
                )
              }
              hitSlop={8}
            >
              <ChevronLeft
                size={24}
                color="#0F172A"
                strokeWidth={2}
              />
            </Pressable>

            <Text
              style={
                styles.accountSettingsTitle
              }
            >
              Pengaturan Akun
            </Text>

            <View
              style={
                styles.accountSettingsHeaderSpacer
              }
            />
          </View>


          <ScrollView
            contentContainerStyle={
              styles.accountSettingsContent
            }
            showsVerticalScrollIndicator={
              false
            }
          >
            {accountSettingsLoading ? (
              <View
                style={
                  styles.accountSettingsLoading
                }
              >
                <ActivityIndicator
                  size="small"
                  color="#2563EB"
                />

                <Text
                  style={
                    styles.accountSettingsLoadingText
                  }
                >
                  Memuat data akun...
                </Text>
              </View>
            ) : (
              <>
                <Text
                  style={
                    styles.accountSectionTitle
                  }
                >
                  Akun
                </Text>

                <View
                  style={
                    styles.accountCard
                  }
                >
                  <View
                    style={
                      styles.accountInfoRow
                    }
                  >
                    <View
                      style={
                        styles.accountInfoBody
                      }
                    >
                      <Text
                        style={
                          styles.accountInfoLabel
                        }
                      >
                        Email akun
                      </Text>

                      <Text
                        style={
                          styles.accountInfoValue
                        }
                        numberOfLines={1}
                      >
                        {email || "-"}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={
                      styles.accountDivider
                    }
                  />

                  <View
                    style={
                      styles.accountInfoRow
                    }
                  >
                    <View
                      style={
                        styles.accountInfoBody
                      }
                    >
                      <Text
                        style={
                          styles.accountInfoLabel
                        }
                      >
                        Metode masuk
                      </Text>

                      <Text
                        style={
                          styles.accountInfoValue
                        }
                      >
                        {accountProvider}
                      </Text>
                    </View>
                  </View>
                </View>


                <Text
                  style={[
                    styles.accountSectionTitle,
                    styles.accountSectionTitleSpaced,
                  ]}
                >
                  Keamanan
                </Text>

                <View
                  style={
                    styles.accountCard
                  }
                >
                  <Pressable
                    style={
                      styles.accountActionRow
                    }
                    disabled={
                      passwordResetLoading
                    }
                    onPress={() =>
                      void handlePasswordReset()
                    }
                  >
                    <View
                      style={
                        styles.accountInfoBody
                      }
                    >
                      <Text
                        style={
                          styles.accountActionTitle
                        }
                      >
                        Ubah kata sandi
                      </Text>

                      <Text
                        style={
                          styles.accountActionDescription
                        }
                      >
                        {accountProvider ===
                        "Google"
                          ? "Dikelola melalui akun Google"
                          : "Kirim tautan reset ke email Anda"}
                      </Text>
                    </View>

                    {passwordResetLoading ? (
                      <ActivityIndicator
                        size="small"
                        color="#2563EB"
                      />
                    ) : (
                      <ChevronRight
                        size={19}
                        color="#94A3B8"
                      />
                    )}
                  </Pressable>

                  <View
                    style={
                      styles.accountDivider
                    }
                  />

                  <View
                    style={
                      styles.accountInfoRow
                    }
                  >
                    <View
                      style={
                        styles.accountInfoBody
                      }
                    >
                      <Text
                        style={
                          styles.accountInfoLabel
                        }
                      >
                        Verifikasi email
                      </Text>

                      <Text
                        style={[
                          styles.accountVerificationText,
                          emailVerified
                            ? styles.accountVerified
                            : styles.accountNotVerified,
                        ]}
                      >
                        {emailVerified
                          ? "Terverifikasi"
                          : "Belum terverifikasi"}
                      </Text>
                    </View>
                  </View>
                </View>


                <Text
                  style={
                    styles.accountSecurityNote
                  }
                >
                  Data login dan keamanan akun dikelola melalui sistem autentikasi Diginaz.
                </Text>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>


      <Modal
        visible={
          showPrivacySettings
        }
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() =>
          setShowPrivacySettings(
            false
          )
        }
      >
        <SafeAreaView
          style={
            styles.privacySafeArea
          }
          edges={[
            "top",
            "bottom",
          ]}
        >
          <View
            style={
              styles.privacyHeader
            }
          >
            <Pressable
              style={
                styles.privacyBack
              }
              onPress={() =>
                setShowPrivacySettings(
                  false
                )
              }
              hitSlop={8}
            >
              <ChevronLeft
                size={24}
                color="#0F172A"
                strokeWidth={2}
              />
            </Pressable>

            <Text
              style={
                styles.privacyTitle
              }
            >
              Privasi
            </Text>

            <View
              style={
                styles.privacyHeaderRight
              }
            >
              {privacySaving ? (
                <ActivityIndicator
                  size="small"
                  color="#2563EB"
                />
              ) : null}
            </View>
          </View>


          <ScrollView
            contentContainerStyle={
              styles.privacyContent
            }
            showsVerticalScrollIndicator={
              false
            }
          >
            {privacyLoading ? (
              <View
                style={
                  styles.privacyLoading
                }
              >
                <ActivityIndicator
                  size="small"
                  color="#2563EB"
                />

                <Text
                  style={
                    styles.privacyLoadingText
                  }
                >
                  Memuat privasi...
                </Text>
              </View>
            ) : (
              <>
                <Text
                  style={
                    styles.privacySectionTitle
                  }
                >
                  Profil
                </Text>

                <View
                  style={
                    styles.privacyCard
                  }
                >
                  <Pressable
                    style={
                      styles.privacySettingRow
                    }
                    disabled={
                      privacySaving
                    }
                    onPress={() =>
                      void togglePrivateAccount()
                    }
                  >
                    <View
                      style={
                        styles.privacySettingBody
                      }
                    >
                      <Text
                        style={
                          styles.privacySettingTitle
                        }
                      >
                        Akun privat
                      </Text>

                      <Text
                        style={
                          styles.privacySettingDescription
                        }
                      >
                        Batasi akses profil dan konten Anda.
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.privacySwitch,
                        isPrivateAccount &&
                          styles.privacySwitchActive,
                      ]}
                    >
                      <View
                        style={[
                          styles.privacySwitchKnob,
                          isPrivateAccount &&
                            styles.privacySwitchKnobActive,
                        ]}
                      />
                    </View>
                  </Pressable>
                </View>


                <Text
                  style={[
                    styles.privacySectionTitle,
                    styles.privacySectionSpaced,
                  ]}
                >
                  Pesan
                </Text>

                <View
                  style={
                    styles.privacyCard
                  }
                >
                  <Pressable
                    style={
                      styles.privacyOptionRow
                    }
                    disabled={
                      privacySaving
                    }
                    onPress={() =>
                      void changeMessagePrivacy(
                        "everyone"
                      )
                    }
                  >
                    <View
                      style={
                        styles.privacySettingBody
                      }
                    >
                      <Text
                        style={
                          styles.privacySettingTitle
                        }
                      >
                        Semua orang
                      </Text>

                      <Text
                        style={
                          styles.privacySettingDescription
                        }
                      >
                        Semua pengguna dapat mengirim pesan.
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.privacyRadio,
                        allowMessagesFrom ===
                          "everyone" &&
                          styles.privacyRadioActive,
                      ]}
                    >
                      {allowMessagesFrom ===
                      "everyone" ? (
                        <View
                          style={
                            styles.privacyRadioDot
                          }
                        />
                      ) : null}
                    </View>
                  </Pressable>

                  <View
                    style={
                      styles.privacyDivider
                    }
                  />

                  <Pressable
                    style={
                      styles.privacyOptionRow
                    }
                    disabled={
                      privacySaving
                    }
                    onPress={() =>
                      void changeMessagePrivacy(
                        "following"
                      )
                    }
                  >
                    <View
                      style={
                        styles.privacySettingBody
                      }
                    >
                      <Text
                        style={
                          styles.privacySettingTitle
                        }
                      >
                        Yang saya ikuti
                      </Text>

                      <Text
                        style={
                          styles.privacySettingDescription
                        }
                      >
                        Hanya akun yang Anda ikuti.
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.privacyRadio,
                        allowMessagesFrom ===
                          "following" &&
                          styles.privacyRadioActive,
                      ]}
                    >
                      {allowMessagesFrom ===
                      "following" ? (
                        <View
                          style={
                            styles.privacyRadioDot
                          }
                        />
                      ) : null}
                    </View>
                  </Pressable>

                  <View
                    style={
                      styles.privacyDivider
                    }
                  />

                  <Pressable
                    style={
                      styles.privacyOptionRow
                    }
                    disabled={
                      privacySaving
                    }
                    onPress={() =>
                      void changeMessagePrivacy(
                        "none"
                      )
                    }
                  >
                    <View
                      style={
                        styles.privacySettingBody
                      }
                    >
                      <Text
                        style={
                          styles.privacySettingTitle
                        }
                      >
                        Tidak seorang pun
                      </Text>

                      <Text
                        style={
                          styles.privacySettingDescription
                        }
                      >
                        Jangan izinkan pesan baru.
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.privacyRadio,
                        allowMessagesFrom ===
                          "none" &&
                          styles.privacyRadioActive,
                      ]}
                    >
                      {allowMessagesFrom ===
                      "none" ? (
                        <View
                          style={
                            styles.privacyRadioDot
                          }
                        />
                      ) : null}
                    </View>
                  </Pressable>
                </View>


                <Text
                  style={[
                    styles.privacySectionTitle,
                    styles.privacySectionSpaced,
                  ]}
                >
                  Aktivitas
                </Text>

                <View
                  style={
                    styles.privacyCard
                  }
                >
                  <Pressable
                    style={
                      styles.privacySettingRow
                    }
                    disabled={
                      privacySaving
                    }
                    onPress={() =>
                      void toggleLikedProductsVisibility()
                    }
                  >
                    <View
                      style={
                        styles.privacySettingBody
                      }
                    >
                      <Text
                        style={
                          styles.privacySettingTitle
                        }
                      >
                        Produk yang disukai
                      </Text>

                      <Text
                        style={
                          styles.privacySettingDescription
                        }
                      >
                        Izinkan produk yang Anda sukai tampil di profil.
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.privacySwitch,
                        showLikedProducts &&
                          styles.privacySwitchActive,
                      ]}
                    >
                      <View
                        style={[
                          styles.privacySwitchKnob,
                          showLikedProducts &&
                            styles.privacySwitchKnobActive,
                        ]}
                      />
                    </View>
                  </Pressable>
                </View>

                <Text
                  style={
                    styles.privacyNote
                  }
                >
                  Perubahan privasi disimpan otomatis.
                </Text>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>


      {showSettingsMenu ? (
        <>
          <Pressable
            style={
              styles.menuBackdrop
            }
            onPress={() =>
              setShowSettingsMenu(
                false
              )
            }
          />

          <View
            style={
              styles.settingsMenu
            }
          >
            <Pressable
              style={
                styles.settingsItem
              }
              onPress={
                openEditProfile
              }
            >
              <PencilLine
                size={19}
                color="#0F172A"
              />

              <Text
                style={
                  styles.settingsItemText
                }
              >
                Edit Profil
              </Text>

              <ChevronRight
                size={18}
                color="#94A3B8"
              />
            </Pressable>


            <Pressable
              style={
                styles.settingsItem
              }
              onPress={() => {
                void openAccountSettings();
              }}
            >
              <Settings
                size={19}
                color="#0F172A"
              />

              <Text
                style={
                  styles.settingsItemText
                }
              >
                Pengaturan akun
              </Text>

              <ChevronRight
                size={18}
                color="#94A3B8"
              />
            </Pressable>


            <Pressable
              style={
                styles.settingsItem
              }
              onPress={() => {
                void openPrivacySettings();
              }}
            >
              <Shield
                size={19}
                color="#0F172A"
              />

              <Text
                style={
                  styles.settingsItemText
                }
              >
                Privasi
              </Text>

              <ChevronRight
                size={18}
                color="#94A3B8"
              />
            </Pressable>


            <View
              style={
                styles.settingsDivider
              }
            />


            <Pressable
              style={
                styles.settingsItem
              }
              disabled={
                logoutLoading
              }
              onPress={() => {
                setShowSettingsMenu(
                  false
                );

                confirmLogout();
              }}
            >
              {logoutLoading ? (
                <ActivityIndicator
                  size="small"
                  color="#DC2626"
                />
              ) : (
                <LogOut
                  size={19}
                  color="#DC2626"
                />
              )}

              <Text
                style={[
                  styles.settingsItemText,
                  styles.logoutText,
                ]}
              >
                Keluar akun
              </Text>
            </Pressable>
          </View>
        </>
      ) : null}


      <Modal
        visible={
          showEditProfile
        }
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() =>
          setShowEditProfile(
            false
          )
        }
      >
        <SafeAreaView
          style={
            styles.editSafeArea
          }
          edges={[
            "top",
            "bottom",
          ]}
        >
          <StatusBar
            barStyle="dark-content"
            backgroundColor="#F5F5F5"
          />


          <View
            style={
              styles.editTopBar
            }
          >
            <Pressable
              style={
                styles.topButton
              }
              onPress={() =>
                setShowEditProfile(
                  false
                )
              }
              hitSlop={8}
            >
              <ArrowLeft
                size={25}
                color="#0F172A"
              />
            </Pressable>

            <Text
              style={
                styles.editTopTitle
              }
            >
              Edit Profil
            </Text>

            <View
              style={
                styles.topButton
              }
            />
          </View>


          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={
              false
            }
            contentContainerStyle={
              styles.editContent
            }
          >

            <Pressable
              style={
                styles.editAvatarButton
              }
              onPress={() =>
                void handleChangePhoto()
              }
              disabled={
                photoUploading
              }
            >
              <View
                style={
                  styles.editAvatar
                }
              >
                {avatarUrl ? (
                  <Image
                    source={{
                      uri:
                        avatarUrl,
                    }}
                    style={
                      styles.editAvatarImage
                    }
                    resizeMode="cover"
                  />
                ) : (
                  <Text
                    style={
                      styles.editAvatarText
                    }
                  >
                    {getInitial(
                      editName ||
                        name
                    )}
                  </Text>
                )}

                <View
                  style={
                    styles.cameraBadge
                  }
                >
                  <Camera
                    size={22}
                    color="#FFFFFF"
                    strokeWidth={2.2}
                  />
                </View>
              </View>

              <Text
                style={
                  styles.changePhotoText
                }
              >
                {photoUploading
                  ? "Mengunggah..."
                  : "Ganti foto"}
              </Text>
            </Pressable>


            <View
              style={
                styles.editCard
              }
            >
              <View
                style={
                  styles.editFieldRow
                }
              >
                <Text
                  style={
                    styles.editFieldLabel
                  }
                >
                  Nama
                </Text>

                <TextInput
                  value={
                    editName
                  }
                  onChangeText={
                    setEditName
                  }
                  style={
                    styles.editFieldInput
                  }
                  placeholder="Nama"
                  placeholderTextColor="#94A3B8"
                  maxLength={60}
                  textAlign="right"
                />
              </View>


              <View
                style={
                  styles.editDivider
                }
              />


              <View
                style={
                  styles.editFieldRow
                }
              >
                <Text
                  style={
                    styles.editFieldLabel
                  }
                >
                  Username
                </Text>

                <View
                  style={
                    styles.usernameInputWrap
                  }
                >
                  <Text
                    style={
                      styles.usernamePrefix
                    }
                  >
                    @
                  </Text>

                  <TextInput
                    value={
                      editUsername
                    }
                    onChangeText={
                      setEditUsername
                    }
                    style={
                      styles.usernameEditInput
                    }
                    placeholder="username"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={30}
                  />
                </View>
              </View>


              <View
                style={
                  styles.editDivider
                }
              />


              <View
                style={
                  styles.profileLinkRow
                }
              >
                <Text
                  style={
                    styles.editFieldLabel
                  }
                >
                  Link profil
                </Text>

                <Text
                  style={
                    styles.profileLink
                  }
                  numberOfLines={1}
                >
                  diginaz.id/@{
                    editUsername ||
                    "diginaz"
                  }
                </Text>
              </View>
            </View>


            <Text
              style={
                styles.editSectionTitle
              }
            >
              Info dasar
            </Text>


            <View
              style={
                styles.editCard
              }
            >
              <View
                style={
                  styles.bioEditRow
                }
              >
                <Text
                  style={
                    styles.editFieldLabel
                  }
                >
                  Bio
                </Text>

                <TextInput
                  value={
                    editBio
                  }
                  onChangeText={
                    setEditBio
                  }
                  style={
                    styles.bioEditInput
                  }
                  placeholder="Tambahkan bio"
                  placeholderTextColor="#94A3B8"
                  multiline
                  maxLength={160}
                  textAlignVertical="top"
                />
              </View>

              <Text
                style={
                  styles.bioCounter
                }
              >
                {editBio.length}/160
              </Text>
            </View>


            <Pressable
              style={[
                styles.saveProfileButton,
                savingProfile &&
                  styles.saveProfileButtonDisabled,
              ]}
              disabled={
                savingProfile
              }
              onPress={() =>
                void saveProfileChanges()
              }
            >
              {savingProfile ? (
                <ActivityIndicator
                  size="small"
                  color="#FFFFFF"
                />
              ) : (
                <Text
                  style={
                    styles.saveProfileButtonText
                  }
                >
                  Simpan perubahan
                </Text>
              )}
            </Pressable>

          </ScrollView>
        </SafeAreaView>
      </Modal>


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
                  {username
                    ? `@${username}`
                    : getUsername(
                        email
                      )}
                </Text>


              </View>

              <View
                style={
                  styles.avatar
                }
              >
                {avatarUrl ? (
                  <Image
                    source={{
                      uri:
                        avatarUrl,
                    }}
                    style={
                      styles.profileAvatarImage
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
                    name
                  )}
                </Text>
                )}
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
            <Pressable
              style={[
                styles.productTab,
                activeProductTab ===
                  "mine" &&
                  styles.productTabActive,
              ]}
              onPress={() =>
                setActiveProductTab(
                  "mine"
                )
              }
            >
              <Grid3X3
                size={18}
                color={
                  activeProductTab ===
                  "mine"
                    ? "#0F172A"
                    : "#94A3B8"
                }
                strokeWidth={2}
              />

              <Text
                style={[
                  styles.productTabText,
                  activeProductTab ===
                    "mine" &&
                    styles.productTabTextActive,
                ]}
              >
                Produk Saya
              </Text>
            </Pressable>



            <Pressable
              style={[
                styles.productTab,
                activeProductTab ===
                  "saved" &&
                  styles.productTabActive,
              ]}
              onPress={() =>
                setActiveProductTab(
                  "saved"
                )
              }
            >
              <Bookmark
                size={18}
                color={
                  activeProductTab ===
                  "saved"
                    ? "#0F172A"
                    : "#94A3B8"
                }
                strokeWidth={2}
              />

              <Text
                style={[
                  styles.productTabText,
                  activeProductTab ===
                    "saved" &&
                    styles.productTabTextActive,
                ]}
              >
                Tersimpan
              </Text>
            </Pressable>
          </View>

          {activeProductTab ===
            "saved" &&
          savedLoading ? (
            <View style={styles.empty}>
              <ActivityIndicator
                size="small"
                color="#2563EB"
              />

              <Text
                style={styles.emptyText}
              >
                Memuat tersimpan...
              </Text>
            </View>
          ) : visibleProducts.length ===
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
                {activeProductTab ===
                "saved"
                  ? "Belum ada produk tersimpan"
                  : "Belum ada produk"}
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                {activeProductTab ===
                "saved"
                  ? "Produk yang Anda simpan akan tampil di sini."
                  : "Produk yang Anda publikasikan akan tampil di sini."}
              </Text>
            </View>
          ) : (
            <View
              style={styles.grid}
            >
              {visibleProducts.map(
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
      marginBottom: 24,
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
      height: 46,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderColor: "#E2E8F0",
      flexDirection: "row",
      alignItems: "center",
    },

    productTab: {
      flex: 1,
      height: "100%",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      borderBottomWidth: 2,
      borderBottomColor:
        "transparent",
    },

    productTabActive: {
      borderBottomColor:
        "#0F172A",
    },

    productTabText: {
      fontSize: 13,
      fontFamily:
        "PlusJakartaSans_600SemiBold",
      color: "#94A3B8",
    },

    productTabTextActive: {
      fontFamily:
        "PlusJakartaSans_700Bold",
      color: "#0F172A",
    },

    activeTab: {
      height: "100%",
      paddingHorizontal: 18,
      flexDirection: "row",
      gap: 7,
      alignItems: "center",
      justifyContent:
        "center",
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

    menuBackdrop: {
      position: "absolute",
      top: 56,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 20,
    },

    settingsMenu: {
      position: "absolute",
      top: 52,
      right: 12,
      width: 230,
      paddingVertical: 6,
      borderRadius: 14,
      backgroundColor: "#FFFFFF",
      borderWidth:
        StyleSheet.hairlineWidth,
      borderColor: "#E2E8F0",
      zIndex: 30,
      elevation: 10,
      shadowColor: "#000000",
      shadowOpacity: 0.12,
      shadowRadius: 14,
      shadowOffset: {
        width: 0,
        height: 5,
      },
    },

    settingsItem: {
      minHeight: 48,
      paddingHorizontal: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
    },

    settingsItemText: {
      flex: 1,
      fontSize: 13,
      color: "#0F172A",
      fontFamily:
        "PlusJakartaSans_500Medium",
    },

    settingsDivider: {
      height:
        StyleSheet.hairlineWidth,
      marginVertical: 4,
      backgroundColor: "#E2E8F0",
    },

    logoutText: {
      color: "#DC2626",
    },


    editSafeArea: {
      flex: 1,
      backgroundColor: "#F5F5F5",
    },

    editTopBar: {
      height: 56,
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
      backgroundColor: "#F5F5F5",
    },

    editTopTitle: {
      fontSize: 18,
      color: "#0F172A",
      fontFamily:
        "PlusJakartaSans_700Bold",
    },

    editContent: {
      paddingHorizontal: 16,
      paddingBottom: 40,
    },

    editAvatarButton: {
      alignItems: "center",
      paddingTop: 18,
      paddingBottom: 28,
    },

    editAvatar: {
      width: 116,
      height: 116,
      borderRadius: 58,
      backgroundColor: "#D9D9D9",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: "#FFFFFF",
    },

    editAvatarImage: {
      width: "100%",
      height: "100%",
      borderRadius: 58,
    },

    editAvatarText: {
      fontSize: 42,
      color: "#FFFFFF",
      fontFamily:
        "PlusJakartaSans_700Bold",
    },

    cameraBadge: {
      position: "absolute",
      right: 8,
      bottom: 7,
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor:
        "rgba(15,23,42,0.82)",
      borderWidth: 2,
      borderColor: "#FFFFFF",
    },

    changePhotoText: {
      marginTop: 12,
      fontSize: 15,
      color: "#0F8A8A",
      fontFamily:
        "PlusJakartaSans_700Bold",
    },

    editCard: {
      borderRadius: 14,
      backgroundColor: "#FFFFFF",
      overflow: "hidden",
    },

    editFieldRow: {
      minHeight: 62,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
    },

    editFieldLabel: {
      width: 96,
      fontSize: 14,
      color: "#64748B",
      fontFamily:
        "PlusJakartaSans_400Regular",
    },

    editFieldInput: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 0,
      fontSize: 14,
      color: "#0F172A",
      fontFamily:
        "PlusJakartaSans_600SemiBold",
    },

    editDivider: {
      height:
        StyleSheet.hairlineWidth,
      marginLeft: 16,
      backgroundColor: "#E2E8F0",
    },

    usernameInputWrap: {
      flex: 1,
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
    },

    usernamePrefix: {
      fontSize: 14,
      color: "#0F172A",
      fontFamily:
        "PlusJakartaSans_600SemiBold",
    },

    usernameEditInput: {
      minWidth: 90,
      maxWidth: 190,
      paddingVertical: 8,
      paddingHorizontal: 0,
      fontSize: 14,
      color: "#0F172A",
      textAlign: "right",
      fontFamily:
        "PlusJakartaSans_600SemiBold",
    },

    profileLinkRow: {
      minHeight: 58,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
    },

    profileLink: {
      flex: 1,
      fontSize: 12,
      textAlign: "right",
      color: "#475569",
      fontFamily:
        "PlusJakartaSans_500Medium",
    },

    editSectionTitle: {
      marginTop: 24,
      marginBottom: 9,
      marginLeft: 4,
      fontSize: 13,
      color: "#94A3B8",
      fontFamily:
        "PlusJakartaSans_500Medium",
    },

    bioEditRow: {
      minHeight: 112,
      paddingHorizontal: 16,
      paddingTop: 15,
      flexDirection: "row",
      alignItems: "flex-start",
    },

    bioEditInput: {
      flex: 1,
      minHeight: 82,
      padding: 0,
      fontSize: 14,
      lineHeight: 20,
      color: "#0F172A",
      fontFamily:
        "PlusJakartaSans_500Medium",
    },

    bioCounter: {
      paddingRight: 16,
      paddingBottom: 10,
      textAlign: "right",
      fontSize: 10,
      color: "#94A3B8",
      fontFamily:
        "PlusJakartaSans_400Regular",
    },

    saveProfileButton: {
      height: 48,
      marginTop: 24,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#2563EB",
    },

    saveProfileButtonDisabled: {
      opacity: 0.6,
    },

    saveProfileButtonText: {
      fontSize: 14,
      color: "#FFFFFF",
      fontFamily:
        "PlusJakartaSans_700Bold",
    },
    profileAvatarImage: {
      width: "100%",
      height: "100%",
      borderRadius: 999,
    },


    accountSettingsSafeArea: {
      flex: 1,
      backgroundColor: "#F8FAFC",
    },

    accountSettingsHeader: {
      height: 56,
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor: "#E2E8F0",
      backgroundColor: "#FFFFFF",
    },

    accountSettingsBack: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
    },

    accountSettingsTitle: {
      flex: 1,
      textAlign: "center",
      fontSize: 16,
      color: "#0F172A",
      fontFamily:
        "PlusJakartaSans_700Bold",
    },

    accountSettingsHeaderSpacer: {
      width: 44,
      height: 44,
    },

    accountSettingsContent: {
      paddingHorizontal: 16,
      paddingTop: 20,
      paddingBottom: 40,
    },

    accountSettingsLoading: {
      paddingTop: 48,
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    },

    accountSettingsLoadingText: {
      fontSize: 13,
      color: "#64748B",
      fontFamily:
        "PlusJakartaSans_500Medium",
    },

    accountSectionTitle: {
      marginLeft: 4,
      marginBottom: 8,
      fontSize: 12,
      color: "#64748B",
      fontFamily:
        "PlusJakartaSans_600SemiBold",
    },

    accountSectionTitleSpaced: {
      marginTop: 22,
    },

    accountCard: {
      overflow: "hidden",
      borderRadius: 14,
      backgroundColor: "#FFFFFF",
      borderWidth:
        StyleSheet.hairlineWidth,
      borderColor: "#E2E8F0",
    },

    accountInfoRow: {
      minHeight: 68,
      paddingHorizontal: 16,
      paddingVertical: 13,
      flexDirection: "row",
      alignItems: "center",
    },

    accountActionRow: {
      minHeight: 74,
      paddingHorizontal: 16,
      paddingVertical: 13,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },

    accountInfoBody: {
      flex: 1,
      minWidth: 0,
    },

    accountInfoLabel: {
      fontSize: 13,
      color: "#64748B",
      fontFamily:
        "PlusJakartaSans_500Medium",
    },

    accountInfoValue: {
      marginTop: 4,
      fontSize: 14,
      color: "#0F172A",
      fontFamily:
        "PlusJakartaSans_600SemiBold",
    },

    accountActionTitle: {
      fontSize: 14,
      color: "#0F172A",
      fontFamily:
        "PlusJakartaSans_600SemiBold",
    },

    accountActionDescription: {
      marginTop: 3,
      fontSize: 11,
      lineHeight: 16,
      color: "#64748B",
      fontFamily:
        "PlusJakartaSans_400Regular",
    },

    accountDivider: {
      height:
        StyleSheet.hairlineWidth,
      marginLeft: 16,
      backgroundColor: "#E2E8F0",
    },

    accountVerificationText: {
      marginTop: 4,
      fontSize: 13,
      fontFamily:
        "PlusJakartaSans_600SemiBold",
    },

    accountVerified: {
      color: "#15803D",
    },

    accountNotVerified: {
      color: "#B45309",
    },

    accountSecurityNote: {
      marginTop: 14,
      paddingHorizontal: 4,
      fontSize: 11,
      lineHeight: 17,
      color: "#94A3B8",
      fontFamily:
        "PlusJakartaSans_400Regular",
    },


    privacySafeArea: {
      flex: 1,
      backgroundColor: "#F8FAFC",
    },

    privacyHeader: {
      height: 56,
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#FFFFFF",
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor: "#E2E8F0",
    },

    privacyBack: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
    },

    privacyTitle: {
      flex: 1,
      textAlign: "center",
      fontSize: 16,
      color: "#0F172A",
      fontFamily:
        "PlusJakartaSans_700Bold",
    },

    privacyHeaderRight: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
    },

    privacyContent: {
      paddingHorizontal: 16,
      paddingTop: 20,
      paddingBottom: 40,
    },

    privacyLoading: {
      paddingTop: 48,
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    },

    privacyLoadingText: {
      fontSize: 13,
      color: "#64748B",
      fontFamily:
        "PlusJakartaSans_500Medium",
    },

    privacySectionTitle: {
      marginLeft: 4,
      marginBottom: 8,
      fontSize: 12,
      color: "#64748B",
      fontFamily:
        "PlusJakartaSans_600SemiBold",
    },

    privacySectionSpaced: {
      marginTop: 22,
    },

    privacyCard: {
      overflow: "hidden",
      borderRadius: 14,
      backgroundColor: "#FFFFFF",
      borderWidth:
        StyleSheet.hairlineWidth,
      borderColor: "#E2E8F0",
    },

    privacySettingRow: {
      minHeight: 78,
      paddingHorizontal: 16,
      paddingVertical: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },

    privacyOptionRow: {
      minHeight: 72,
      paddingHorizontal: 16,
      paddingVertical: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },

    privacySettingBody: {
      flex: 1,
      minWidth: 0,
    },

    privacySettingTitle: {
      fontSize: 14,
      color: "#0F172A",
      fontFamily:
        "PlusJakartaSans_600SemiBold",
    },

    privacySettingDescription: {
      marginTop: 4,
      fontSize: 11,
      lineHeight: 16,
      color: "#64748B",
      fontFamily:
        "PlusJakartaSans_400Regular",
    },

    privacyDivider: {
      height:
        StyleSheet.hairlineWidth,
      marginLeft: 16,
      backgroundColor: "#E2E8F0",
    },

    privacySwitch: {
      width: 44,
      height: 24,
      borderRadius: 12,
      padding: 2,
      justifyContent: "center",
      backgroundColor: "#CBD5E1",
    },

    privacySwitchActive: {
      backgroundColor: "#2563EB",
    },

    privacySwitchKnob: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: "#FFFFFF",
    },

    privacySwitchKnobActive: {
      alignSelf: "flex-end",
    },

    privacyRadio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: "#CBD5E1",
      alignItems: "center",
      justifyContent: "center",
    },

    privacyRadioActive: {
      borderColor: "#2563EB",
    },

    privacyRadioDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: "#2563EB",
    },

    privacyNote: {
      marginTop: 14,
      paddingHorizontal: 4,
      fontSize: 11,
      lineHeight: 17,
      color: "#94A3B8",
      fontFamily:
        "PlusJakartaSans_400Regular",
    },


  });

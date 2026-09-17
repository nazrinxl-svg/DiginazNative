import { formatEngagementCount, getDummyCardEngagement } from "../lib/storeEngagement";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Modal,
  Pressable,
  ScrollView,
  useWindowDimensions,

  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  Download,
  ArrowLeft,
  Bookmark,
  Heart,
  MessageCircle,
  Pencil,
  Plus,
  Check,

  ShieldCheck,
  Trash2,
  Star,
  ShoppingCart,
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import ReactNativeBlobUtil from "react-native-blob-util";
import { supabase } from "../lib/supabase";
import {
  getCreatorAvatarUrl,
  peekCreatorAvatar,
} from "../lib/creatorAvatarPreview";
import { pdfViewer } from "../lib/pdfViewer";

import {
  createStoreProductPreviewSession,
  logA4,
  type StoreProductPreviewSession,
} from "../lib/storeProductPreview";

type ProductSummary = {
  id: string;
  creatorUserId: string;
  creatorAvatarUrl?: string | null;
  type: string;
  subject: string;
  level: string;
  title: string;
  author: string;
  rating: string;
  reviewCount: number;
  price: string;
  thumbnailUrl: string | null;
  firstPageStoragePath?: string | null;
  pageCount?: number;
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
  file_path: string | null;
  download_count: number | null;
  updated_at: string | null;
};

type ProductPageRow = {
  page_number: number;
  storage_path: string;
};

type Props = {
  product: ProductSummary;
  initialCurrentUserId?: string | null;
  previewSession?: StoreProductPreviewSession;
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
  initialCurrentUserId,
  previewSession,
  onBack,
  onEditProduct,
  onProductChanged,
  onOpenChat,
  onOpenCreatorProfile,
}: Props) {
  const { width: viewportWidth } =
    useWindowDimensions();

  const [
    avatarDiagStartedAt,
  ] = useState(
    () => Date.now()
  );

  console.log(
    "[AVATAR_DIAG][DETAIL_RENDER]",
    {
      productId:
        product.id,

      propAvatar:
        product.creatorAvatarUrl ??
        null,

      propIsFile:
        Boolean(
          product.creatorAvatarUrl
            ?.startsWith(
              "file://"
            )
        ),

      sinceStart:
        Date.now() -
        avatarDiagStartedAt,

      at:
        Date.now(),
    }
  );

  const [localPreviewSession] = useState(createStoreProductPreviewSession);
  const pagePreview = previewSession ?? localPreviewSession;

  // SHARED_PRODUCT_ENGAGEMENT
  // Angka sama dengan kartu Store untuk product.id yang sama.
  const dummyEngagement =
    getDummyCardEngagement(
      product.id
    );
  const openedAtRef = useRef(Date.now());

  const productSlideScrollRef =
    useRef<ScrollView | null>(null);

  const productSlideDragStartXRef =
    useRef(0);

  const imageStartedRef = useRef(new Map<string, number>());
  const sourceUrlsRef = useRef<Array<string | null>>([]);

  // MULTIPAGE_IMAGE_DOWNLOAD_V1
  // URL signed untuk viewer tetap terpisah dari storage_path download.
  const productPageRowsRef =
    useRef<ProductPageRow[]>([]);
  const [firstImageSettledUrl, setFirstImageSettledUrl] = useState<string | null>(null);
  const [productPageUrls, setProductPageUrls] = useState<Array<string | null>>(() => {
    const cached = pagePreview.peek(product.id, product.firstPageStoragePath);
    return cached ? [cached] : [];
  });

  useEffect(() => {
    logA4("DETAIL_MOUNT", product.id);
  }, [product.id]);

  useEffect(() => {
    let active = true;
    const path = product.firstPageStoragePath;
    if (path) {
      // Join an in-flight Store sign, or reuse its URL. No page-1 DB query.
      void pagePreview.getUrl(product.id, path).then(url => {
        if (!active || !url) return;
        setProductPageUrls(current => current[0] === url
          ? current : [url, ...current.slice(1)]);
      });
    }
    return () => { active = false; };
  }, [product.id, product.firstPageStoragePath, pagePreview]);

  useEffect(() => {
    productPageUrls.forEach((url, index) => {
      if (url && url !== sourceUrlsRef.current[index]) {
        logA4("SOURCE_SET", product.id, {
          page: index + 1,
          sinceMountMs: Date.now() - openedAtRef.current,
          replaced: Boolean(sourceUrlsRef.current[index]),
        });
      }
    });
    sourceUrlsRef.current = productPageUrls;
  }, [product.id, productPageUrls]);

  const [
    activeProductSlide,
    setActiveProductSlide,
  ] = useState(0);
  const [detail, setDetail] =
    useState<ProductDetailRow | null>(null);

  const [
    pdfLocalPath,
    setPdfLocalPath,
  ] = useState<string | null>(null);

  const [
    pdfPageUrls,
    setPdfPageUrls,
  ] = useState<Array<string | null>>([]);

  const [
    pdfPageCount,
    setPdfPageCount,
  ] = useState(0);

  const [
    pdfViewerError,
    setPdfViewerError,
  ] = useState("");

  const pdfRenderingRef =
    useRef(new Set<number>());

  const pdfRenderedPathsRef =
    useRef(new Set<string>());

  const [loading, setLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [currentUserId, setCurrentUserId] =
    useState<string | null>(
      () => initialCurrentUserId ?? null
    );

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
    isFollowingCreator,
    setIsFollowingCreator,
  ] = useState(false);

  const [
    creatorFollowReady,
    setCreatorFollowReady,
  ] = useState(false);

  const [
    followLoading,
    setFollowLoading,
  ] = useState(false);

  const [
    creatorAvatarUrl,
    setCreatorAvatarUrl,
  ] = useState(
    () =>
      product.creatorAvatarUrl ??
      peekCreatorAvatar(
        product.creatorUserId
      ) ??
      ""
  );

  const [
    creatorVerified,
    setCreatorVerified,
  ] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadCreatorVerification() {
      const {
        data,
        error,
      } = await supabase
        .from(
          "app_profile_verifications"
        )
        .select(
          "auth_user_id"
        )
        .eq(
          "auth_user_id",
          product.creatorUserId
        )
        .maybeSingle();

      if (!active) {
        return;
      }

      if (error) {
        console.warn(
          "Status verifikasi creator gagal dimuat:",
          error
        );

        setCreatorVerified(false);
        return;
      }

      setCreatorVerified(
        Boolean(
          data?.auth_user_id
        )
      );
    }

    void loadCreatorVerification();

    return () => {
      active = false;
    };
  }, [
    product.creatorUserId,
  ]);

  console.log(
    "[AVATAR_DIAG][DETAIL_STATE]",
    {
      stateAvatar:
        creatorAvatarUrl ||
        null,

      stateIsFile:
        Boolean(
          creatorAvatarUrl
            ?.startsWith(
              "file://"
            )
        ),

      sinceStart:
        Date.now() -
        avatarDiagStartedAt,

      at:
        Date.now(),
    }
  );

  // DOWNLOAD_SUCCESS_DIGINAZ_MODAL_STATE
  const [
    downloadSuccessFileName,
    setDownloadSuccessFileName,
  ] = useState<string | null>(null);

  const [
    downloadSuccessFileUri,
    setDownloadSuccessFileUri,
  ] = useState<string | null>(null);

  const [
    downloadSuccessFileMime,
    setDownloadSuccessFileMime,
  ] = useState(
    "application/octet-stream"
  );


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

  const [
    hasProductAccess,
    setHasProductAccess,
  ] = useState(false);

  const [
    productAccessLoading,
    setProductAccessLoading,
  ] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadDetail() {
      setLoading(true);
      setErrorMessage("");
      setActiveProductSlide(0);

      productPageRowsRef.current = [];

      const pagesStarted = Date.now();
      logA4("PAGES_QUERY_START", product.id);

      const pagesPromise = Promise.resolve(
        supabase
          .from("store_product_pages")
          .select(
            "page_number,storage_path"
          )
          .eq(
            "product_id",
            product.id
          )
          .order(
            "page_number",
            {
              ascending: true,
            }
          )
      );

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!active) return;

        setCurrentUserId(user?.id ?? null);

        if (user?.id) {
          const {
            data: accessData,
            error: accessError,
          } =
            await supabase
              .from(
                "store_product_access"
              )
              .select("id")
              .eq(
                "user_id",
                user.id
              )
              .eq(
                "product_id",
                product.id
              )
              .maybeSingle();

          if (accessError) {
            console.warn(
              "Cek akses produk gagal:",
              accessError
            );

            setHasProductAccess(
              false
            );
          } else {
            setHasProductAccess(
              Boolean(
                accessData?.id
              )
            );
          }
        } else {
          setHasProductAccess(
            false
          );
        }

        const {
          data,
          error,
        } = await supabase
          .from("store_products")
          .select(
            "id,creator_user_id,creator_name,title,product_type,subject,class_level,pricing_type,price_amount,original_price_amount,description,thumbnail_path,file_path,download_count,updated_at"
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

        /*
         * Data utama produk sudah siap.
         * Jangan tahan seluruh halaman hanya karena
         * gallery masih menyiapkan signed URL/gambar.
         */
        setLoading(false);

        const {
          data: pageRows,
          error: pageRowsError,
        } = await pagesPromise;

        logA4("PAGES_QUERY_DONE", product.id, {
          ms: Date.now() - pagesStarted, ok: !pageRowsError,
          count: pageRows?.length ?? 0,
        });
        if (!active) return;

        if (pageRowsError) {
          // A background metadata failure must not erase a ready first image.
          console.warn("Halaman produk gagal dimuat:", pageRowsError);
        } else {
          const pages =
            (pageRows ?? []) as ProductPageRow[];

          productPageRowsRef.current =
            [...pages].sort(
              (a, b) =>
                Number(a.page_number) -
                Number(b.page_number)
            );

          if (pages.length > 0) {
            const firstPageUrl = await pagePreview.getUrl(
              product.id, pages[0].storage_path, pages[0].page_number
            );
            if (!active) return;
            setProductPageUrls(current => [
              firstPageUrl ?? current[0] ?? null,
              ...pages.slice(1).map(() => null),
            ]);

            // Preserve each page's slot even if a signing request fails.
            await Promise.all(pages.slice(1).map(async (page, index) => {
              const url = await pagePreview.getUrl(
                product.id, page.storage_path, page.page_number
              );
              if (!active || !url) return;
              setProductPageUrls(current => {
                const next = [...current];
                next[index + 1] = url;
                return next;
              });
            }));
            // Image loads pages 2+ after the first image settles. No second prefetch.
          }
        }
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
  }, [product.id, pagePreview]);

  /*
   * PDF_VIEWER_V1
   * PDF tetap disimpan sebagai file PDF asli.
   * Hanya salinan sementara yang dibaca PdfRenderer di perangkat.
   */
  useEffect(() => {
    const storagePath =
      detail?.file_path?.trim() ??
      "";

    if (
      !storagePath
        .toLowerCase()
        .endsWith(".pdf")
    ) {
      setPdfLocalPath(null);
      setPdfPageUrls([]);
      setPdfPageCount(0);
      setPdfViewerError("");
      return;
    }

    let active = true;
    let temporaryPdfPath:
      string | null = null;

    pdfRenderingRef.current.clear();
    pdfRenderedPathsRef.current.clear();

    setPdfLocalPath(null);
    setPdfPageUrls([]);
    setPdfPageCount(0);
    setPdfViewerError("");
    setFirstImageSettledUrl(null);

    async function preparePdf() {
      try {
        if (
          Platform.OS !== "android" ||
          !pdfViewer.available
        ) {
          throw new Error(
            "Viewer PDF belum tersedia pada perangkat ini."
          );
        }

        const pdfCacheDirectory =
          `${ReactNativeBlobUtil.fs.dirs.CacheDir}/` +
          "diginaz-pdf-cache";

        const storageFileName =
          storagePath
            .split("/")
            .pop()
            ?.trim() ||
          "product.pdf";

        const pdfCacheVersion =
          detail?.updated_at
            ?.trim()
            .replace(
              /[^a-zA-Z0-9]/g,
              ""
            ) ||
          "legacy";

        const cacheFileName =
          `${product.id}-${pdfCacheVersion}-${storageFileName}`
            .replace(
              /[^a-zA-Z0-9._-]/g,
              "_"
            );

        const cachedPdfPath =
          `${pdfCacheDirectory}/${cacheFileName}`;

        let cachedPdfReady = false;

        try {
          const cacheExists =
            await ReactNativeBlobUtil.fs
              .exists(
                cachedPdfPath
              );

          if (cacheExists) {
            const cacheStat =
              await ReactNativeBlobUtil.fs
                .stat(
                  cachedPdfPath
                );

            cachedPdfReady =
              Number(
                cacheStat.size ?? 0
              ) > 0;
          }
        } catch {
          cachedPdfReady = false;
        }

        if (!cachedPdfReady) {
          const cacheDirectoryExists =
            await ReactNativeBlobUtil.fs
              .exists(
                pdfCacheDirectory
              );

          if (!cacheDirectoryExists) {
            await ReactNativeBlobUtil.fs
              .mkdir(
                pdfCacheDirectory
              );
          }

          const {
            data: signed,
            error: signedError,
          } = await supabase.storage
            .from(
              "store-product-files"
            )
            .createSignedUrl(
              storagePath,
              300
            );

          if (signedError) {
            throw signedError;
          }

          if (!signed?.signedUrl) {
            throw new Error(
              "File PDF belum dapat dibuka."
            );
          }

          await ReactNativeBlobUtil
            .config({
              path:
                cachedPdfPath,
            })
            .fetch(
              "GET",
              signed.signedUrl
            );
        }

        temporaryPdfPath =
          cachedPdfPath;

        if (!active) {
          return;
        }

        const pageCount =
          await pdfViewer.getPageCount(
            temporaryPdfPath
          );

        if (pageCount <= 0) {
          throw new Error(
            "PDF tidak memiliki halaman."
          );
        }

        const firstPage =
          await pdfViewer.renderPage(
            temporaryPdfPath,
            0,
            1000
          );

        if (!active) {
          return;
        }

        pdfRenderedPathsRef.current.add(
          firstPage.uri
        );

        setPdfLocalPath(
          temporaryPdfPath
        );

        setPdfPageCount(
          pageCount
        );

        setPdfPageUrls([
          firstPage.uri,
          ...Array.from(
            {
              length:
                Math.max(
                  pageCount - 1,
                  0
                ),
            },
            () => null
          ),
        ]);
      } catch (error) {
        if (!active) return;

        console.error(
          "PDF viewer gagal:",
          error
        );

        setPdfViewerError(
          error instanceof Error
            ? error.message
            : "Isi PDF belum dapat ditampilkan."
        );
      }
    }

    void preparePdf();

    return () => {
      active = false;

      pdfRenderingRef.current.clear();
      pdfRenderedPathsRef.current.clear();

      /*
       * PDF dan hasil render sengaja dipertahankan
       * di CacheDir agar produk yang sama dapat
       * dibuka kembali tanpa download/render ulang.
       */
    };
  }, [
    detail?.file_path,
    detail?.updated_at,
    product.id,
  ]);


  /*
   * Render halaman aktif bila belum ada.
   * Setelah halaman aktif siap, render satu halaman berikutnya.
   */
  useEffect(() => {
    if (
      !pdfLocalPath ||
      pdfPageCount <= 0 ||
      !pdfViewer.available
    ) {
      return;
    }

    const currentReady =
      Boolean(
        pdfPageUrls[
          activeProductSlide
        ]
      );

    const targetIndex =
      currentReady
        ? activeProductSlide + 1
        : activeProductSlide;

    if (
      targetIndex < 0 ||
      targetIndex >= pdfPageCount ||
      pdfPageUrls[targetIndex] ||
      pdfRenderingRef.current.has(
        targetIndex
      )
    ) {
      return;
    }

    let active = true;

    pdfRenderingRef.current.add(
      targetIndex
    );

    void pdfViewer
      .renderPage(
        pdfLocalPath,
        targetIndex,
        1000
      )
      .then(rendered => {
        if (!active) return;

        pdfRenderedPathsRef.current.add(
          rendered.uri
        );

        setPdfPageUrls(
          current => {
            const next =
              [...current];

            next[targetIndex] =
              rendered.uri;

            return next;
          }
        );
      })
      .catch(error => {
        if (!active) return;

        console.warn(
          "Halaman PDF gagal dirender:",
          error
        );
      })
      .finally(() => {
        pdfRenderingRef.current.delete(
          targetIndex
        );
      });

    return () => {
      active = false;
    };
  }, [
    pdfLocalPath,
    pdfPageCount,
    pdfPageUrls,
    activeProductSlide,
  ]);


  const isOwner =
    currentUserId === product.creatorUserId;

  // CREATOR_PROFILE_BOOTSTRAP_V6

  /*
   * AVATAR V8
   *
   * Prioritas pertama adalah URI yang sudah
   * dibawa product. Biasanya ini file:// lokal.
   *
   * Jangan overwrite dengan URL network jika
   * avatar sudah tersedia pada frame pertama.
   */
  useEffect(() => {
    let active = true;

    if (
      product.creatorAvatarUrl
    ) {
      setCreatorAvatarUrl(
        product.creatorAvatarUrl
      );

      return () => {
        active = false;
      };
    }


    const cachedAvatar =
      peekCreatorAvatar(
        product.creatorUserId
      );


    if (cachedAvatar) {
      setCreatorAvatarUrl(
        cachedAvatar
      );
    }


    void getCreatorAvatarUrl(
      product.creatorUserId
    )
      .then(avatarUrl => {
        if (
          !active ||
          !avatarUrl
        ) {
          return;
        }

        setCreatorAvatarUrl(
          avatarUrl
        );
      })
      .catch(error => {
        console.warn(
          "Avatar creator gagal dimuat:",
          error
        );
      });


    return () => {
      active = false;
    };
  }, [
    product.creatorUserId,
    product.creatorAvatarUrl,
  ]);


  /*
   * FOLLOW:
   * currentUserId harus sudah siap dulu.
   *
   * Ini mencegah akun dianggap
   * "belum follow" pada frame pertama.
   */
  useEffect(() => {
    let active = true;

    setCreatorFollowReady(
      false
    );

    if (!currentUserId) {
      return () => {
        active = false;
      };
    }

    if (isOwner) {
      setIsFollowingCreator(
        false
      );

      setCreatorFollowReady(
        true
      );

      return () => {
        active = false;
      };
    }

    async function loadCreatorFollow() {
      try {
        const {
          data,
          error,
        } =
          await supabase
            .rpc(
              "get_public_profile",
              {
                target_user_id:
                  product.creatorUserId,
              }
            )
            .maybeSingle();

        if (error) {
          throw error;
        }

        if (!active) {
          return;
        }

        const publicProfile =
          data as unknown as {
            is_following:
              boolean | null;
          } | null;

        setIsFollowingCreator(
          Boolean(
            publicProfile?.is_following
          )
        );

        setCreatorFollowReady(
          true
        );

      } catch (error) {
        console.warn(
          "Status follow creator gagal dimuat:",
          error
        );

        if (active) {
          /*
           * Jangan tampilkan + kalau
           * status tidak berhasil dipastikan.
           */
          setCreatorFollowReady(
            false
          );
        }
      }
    }

    void loadCreatorFollow();

    return () => {
      active = false;
    };
  }, [
    currentUserId,
    isOwner,
    product.creatorUserId,
  ]);


  async function handleCreatorFollowToggle() {
    if (
      !currentUserId ||
      isOwner ||
      followLoading
    ) {
      return;
    }

    const previous =
      isFollowingCreator;

    const next =
      !previous;

    setFollowLoading(true);
    setIsFollowingCreator(next);

    try {
      if (next) {
        const { error } =
          await supabase
            .from(
              "app_profile_follows"
            )
            .insert({
              follower_user_id:
                currentUserId,
              following_user_id:
                product.creatorUserId,
            });

        if (
          error &&
          error.code !== "23505"
        ) {
          throw error;
        }

        if (
          error?.code === "23505"
        ) {
          setIsFollowingCreator(true);
        }
      } else {
        const { error } =
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
              product.creatorUserId
            );

        if (error) {
          throw error;
        }
      }
    } catch (error) {
      setIsFollowingCreator(
        previous
      );

      console.error(
        "Follow creator gagal:",
        error
      );

      Alert.alert(
        "Belum dapat diperbarui",
        "Status follow belum dapat diperbarui."
      );
    } finally {
      setFollowLoading(false);
    }
  }
  const canDownloadProduct =
    product.price === "Gratis" ||
    isOwner ||
    hasProductAccess;

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



  // OPEN_DOWNLOAD_FOLDER_HELPER
  async function openDownloadFolder() {
    if (Platform.OS !== "android") {
      return;
    }

    const targets = [
      {
        uri:
          "content://com.android.externalstorage.documents/document/primary%3ADownload",
        mime:
          "vnd.android.document/directory",
      },
      {
        uri:
          "content://com.android.externalstorage.documents/document/primary%3ADownload",
        mime:
          "resource/folder",
      },
      {
        uri:
          "content://com.android.providers.downloads.documents/root/downloads",
        mime:
          "vnd.android.document/directory",
      },
      {
        uri:
          "content://com.android.providers.downloads.documents/root/downloads",
        mime:
          "resource/folder",
      },
    ];

    let lastError: unknown = null;

    for (const target of targets) {
      try {
        await ReactNativeBlobUtil.android
          .actionViewIntent(
            target.uri,
            target.mime
          );

        console.log(
          "[DOWNLOAD]",
          JSON.stringify({
            event:
              "DOWNLOAD_FOLDER_OPENED",
            uri:
              target.uri,
            mime:
              target.mime,
          })
        );

        return;
      }
      catch (error) {
        lastError = error;
      }
    }

    /*
     * Tidak munculkan popup kedua.
     * Jika file manager perangkat tidak menerima intent,
     * cukup catat di log.
     */
    console.warn(
      "Folder Download tidak dapat dibuka otomatis:",
      lastError
    );
  }


  async function openOwnedProduct(
    skipLoadingGuard = false
  ) {
    // FIRST_CLICK_DOWNLOAD_READINESS_V1
    if (
      !skipLoadingGuard &&
      productAccessLoading
    ) {
      return;
    }

    setProductAccessLoading(true);

    try {
      let downloadFilePath =
        detail?.file_path?.trim() ?? "";

      const detailIsPdf =
        downloadFilePath
          .toLowerCase()
          .endsWith(".pdf");

      /*
       * MULTIPAGE_IMAGE_DOWNLOAD_V1
       *
       * PDF yang sudah diketahui .pdf langsung melewati
       * jalur ini dan tetap memakai alur lama.
       */
      if (!detailIsPdf) {
        let imagePages =
          [...productPageRowsRef.current].sort(
            (a, b) =>
              Number(a.page_number) -
              Number(b.page_number)
          );

        /*
         * Tombol Unduh tidak menunggu race background viewer.
         * Jika rows belum masuk ref, query langsung saat klik.
         */
        if (imagePages.length === 0) {
          const {
            data: freshPages,
            error: freshPagesError,
          } =
            await supabase
              .from("store_product_pages")
              .select("page_number,storage_path")
              .eq("product_id", product.id)
              .order("page_number", {
                ascending: true,
              });

          if (freshPagesError) {
            throw freshPagesError;
          }

          imagePages =
            ((freshPages ?? []) as ProductPageRow[])
              .slice()
              .sort(
                (a, b) =>
                  Number(a.page_number) -
                  Number(b.page_number)
              );

          productPageRowsRef.current =
            imagePages;
        }

        if (imagePages.length > 0) {
          const safeImageTitle =
            (
              product.title.trim() ||
              "Produk Diginaz"
            )
              .replace(
                /[<>:"/\|?* -]/g,
                "_"
              )
              .replace(/s+/g, " ")
              .replace(/[. ]+$/g, "")
              .slice(0, 110) ||
            "Produk Diginaz";

          const mimeMap: Record<string, string> = {
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            png: "image/png",
            webp: "image/webp",
          };

          const digits =
            Math.max(
              2,
              String(imagePages.length).length
            );

          let firstSavedUri: string | null = null;
          let firstSavedMime = "image/jpeg";
          let firstSavedName = "";

          for (
            let index = 0;
            index < imagePages.length;
            index += 1
          ) {
            const page = imagePages[index];

            /*
             * Gunakan signer yang sama dengan viewer.
             * storage_path tetap authority.
             */
            const signedPageUrl =
              await pagePreview.getUrl(
                product.id,
                page.storage_path,
                page.page_number
              );

            if (!signedPageUrl) {
              throw new Error(
                "Halaman " +
                  String(index + 1) +
                  " belum dapat diunduh."
              );
            }

            const originalName =
              page.storage_path
                .split("?")[0]
                .split("/")
                .pop()
                ?.trim() ?? "";

            const rawExtension =
              originalName.includes(".")
                ? (
                    originalName.split(".").pop() ??
                    ""
                  )
                    .trim()
                    .toLowerCase()
                : "";

            const extension =
              Object.prototype.hasOwnProperty.call(
                mimeMap,
                rawExtension
              )
                ? rawExtension
                : "jpg";

            const mime =
              mimeMap[extension] ??
              "image/jpeg";

            const sequence =
              String(index + 1).padStart(
                digits,
                "0"
              );

            const fileName =
              safeImageTitle +
              " - " +
              sequence +
              "." +
              extension;

            if (
              Platform.OS === "android" &&
              Number(Platform.Version) >= 29
            ) {
              let temporaryPath = "";

              try {
                const result =
                  await ReactNativeBlobUtil
                    .config({
                      fileCache: true,
                    })
                    .fetch(
                      "GET",
                      signedPageUrl
                    );

                temporaryPath =
                  result.path();

                const mediaUri =
                  await ReactNativeBlobUtil
                    .MediaCollection
                    .copyToMediaStore(
                      {
                        name: fileName,
                        parentFolder: "",
                        mimeType: mime,
                      },
                      "Download",
                      temporaryPath
                    );

                if (!mediaUri) {
                  throw new Error(
                    "Halaman " +
                      String(index + 1) +
                      " gagal disimpan."
                  );
                }

                console.log(
                  "[DOWNLOAD]",
                  JSON.stringify({
                    event:
                      "MULTIPAGE_MEDIASTORE_SAVED",
                    productId: product.id,
                    page: index + 1,
                    total: imagePages.length,
                    name: fileName,
                    uri: mediaUri,
                  })
                );

                if (!firstSavedUri) {
                  firstSavedUri = mediaUri;
                  firstSavedMime = mime;
                  firstSavedName = fileName;
                }
              }
              finally {
                if (temporaryPath) {
                  try {
                    const exists =
                      await ReactNativeBlobUtil
                        .fs
                        .exists(
                          temporaryPath
                        );

                    if (exists) {
                      await ReactNativeBlobUtil
                        .fs
                        .unlink(
                          temporaryPath
                        );
                    }
                  }
                  catch (cleanupError) {
                    console.warn(
                      "Temporary multipage gagal dibersihkan:",
                      cleanupError
                    );
                  }
                }
              }

              continue;
            }

            if (Platform.OS === "android") {
              const targetPath =
                ReactNativeBlobUtil
                  .fs
                  .dirs
                  .DownloadDir +
                "/" +
                fileName;

              await ReactNativeBlobUtil
                .config({
                  addAndroidDownloads: {
                    useDownloadManager: true,
                    notification: true,
                    mediaScannable: true,
                    title: fileName,
                    description:
                      "Mengunduh " +
                      product.title,
                    mime,
                    path: targetPath,
                  },
                })
                .fetch(
                  "GET",
                  signedPageUrl
                );

              if (!firstSavedUri) {
                firstSavedUri = targetPath;
                firstSavedMime = mime;
                firstSavedName = fileName;
              }

              continue;
            }

            const targetPath =
              ReactNativeBlobUtil
                .fs
                .dirs
                .DocumentDir +
              "/" +
              fileName;

            await ReactNativeBlobUtil
              .config({
                path: targetPath,
                fileCache: true,
              })
              .fetch(
                "GET",
                signedPageUrl
              );

            if (!firstSavedUri) {
              firstSavedUri = targetPath;
              firstSavedMime = mime;
              firstSavedName = fileName;
            }
          }

          /*
           * Modal baru dibuka setelah SELURUH loop selesai.
           * Tombol Lihat tetap menunjuk halaman pertama.
           */
          if (!firstSavedUri) {
            throw new Error(
              "Tidak ada halaman yang berhasil disimpan."
            );
          }

          setDownloadSuccessFileUri(
            firstSavedUri
          );

          setDownloadSuccessFileMime(
            firstSavedMime
          );

          setDownloadSuccessFileName(
            firstSavedName
          );

          console.log(
            "[DOWNLOAD]",
            JSON.stringify({
              event: "MULTIPAGE_COMPLETE",
              productId: product.id,
              total: imagePages.length,
            })
          );

          return;
        }
      }

      /*
       * PDF / legacy single-file.
       * Jika file_path belum ada di state, refresh saat klik.
       */
      if (!downloadFilePath) {
        const {
          data: freshProduct,
          error: freshProductError,
        } =
          await supabase
            .from("store_products")
            .select("file_path")
            .eq("id", product.id)
            .single();

        if (freshProductError) {
          throw freshProductError;
        }

        downloadFilePath =
          (
            freshProduct as {
              file_path: string | null;
            } | null
          )?.file_path?.trim() ?? "";
      }

      if (!downloadFilePath) {
        throw new Error(
          "File produk belum tersedia untuk diunduh."
        );
      }

      const {
        data,
        error,
      } =
        await supabase.storage
          .from(
            "store-product-files"
          )
          .createSignedUrl(
            downloadFilePath,
            300
          );

      if (error) {
        throw error;
      }

      if (!data?.signedUrl) {
        throw new Error(
          "Signed URL tidak tersedia."
        );
      }

      const originalName =
        downloadFilePath
          .split("/")
          .pop()
          ?.trim() ||
        "produk-diginaz";

      const originalExtension =
        originalName.includes(".")
          ? originalName
              .split(".")
              .pop()
              ?.trim()
              .toLowerCase() ?? ""
          : "";

      const extensionSuffix =
        originalExtension
          ? "." + originalExtension
          : "";

      const rawProductTitle =
        product.title.trim() ||
        "Produk Diginaz";

      const titleWithoutExtension =
        extensionSuffix &&
        rawProductTitle
          .toLowerCase()
          .endsWith(
            extensionSuffix.toLowerCase()
          )
          ? rawProductTitle.slice(
              0,
              -extensionSuffix.length
            )
          : rawProductTitle;

      const safeTitle =
        titleWithoutExtension
          .replace(
            /[<>:"/\\|?*\x00-\x1F]/g,
            "_"
          )
          .replace(
            /\s+/g,
            " "
          )
          .replace(
            /[. ]+$/g,
            ""
          )
          .slice(
            0,
            120
          ) ||
        "Produk Diginaz";

      const safeName =
        safeTitle +
        extensionSuffix;

      const extension =
        safeName
          .split(".")
          .pop()
          ?.toLowerCase() ?? "";

      const mimeByExtension = {
        pdf: "application/pdf",
        doc: "application/msword",
        docx:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ppt: "application/vnd.ms-powerpoint",
        pptx:
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        xls: "application/vnd.ms-excel",
        xlsx:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        zip: "application/zip",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
      };

      const mime =
        mimeByExtension[
          extension as keyof typeof mimeByExtension
        ] ??
        "application/octet-stream";

      if (Platform.OS === "android") {
        /*
         * Android 10+ menggunakan scoped storage.
         * Download file ke cache aplikasi lebih dulu,
         * lalu salin ke MediaStore collection Download.
         *
         * Jangan menggunakan fs.dirs.DownloadDir sebagai
         * tujuan DownloadManager karena pada perangkat
         * tertentu nilainya mengarah ke Android/data/...,
         * yang ditolak MediaProvider.
         */
        if (
          Number(
            Platform.Version
          ) >= 29
        ) {
          let temporaryPath = "";
          let shouldCleanupTemporaryPath =
            true;

          /*
           * PDF yang sudah dipakai viewer
           * sudah ada di cache perangkat.
           * Jangan download file yang sama
           * untuk kedua kalinya.
           */
          const canReusePdfCache =
            downloadFilePath
              .trim()
              .toLowerCase()
              .endsWith(".pdf") &&
            Boolean(pdfLocalPath);

          if (
            canReusePdfCache &&
            pdfLocalPath
          ) {
            try {
              const cachedExists =
                await ReactNativeBlobUtil
                  .fs
                  .exists(
                    pdfLocalPath
                  );

              if (cachedExists) {
                const cachedStat =
                  await ReactNativeBlobUtil
                    .fs
                    .stat(
                      pdfLocalPath
                    );

                if (
                  Number(
                    cachedStat.size ?? 0
                  ) > 0
                ) {
                  temporaryPath =
                    pdfLocalPath;

                  shouldCleanupTemporaryPath =
                    false;

                  console.log(
                    "[DOWNLOAD]",
                    JSON.stringify({
                      event:
                        "REUSE_PDF_CACHE",
                      productId:
                        product.id,
                      path:
                        pdfLocalPath,
                    })
                  );
                }
              }
            }
            catch (cacheError) {
              console.warn(
                "Cache PDF belum dapat dipakai untuk download:",
                cacheError
              );
            }
          }

          /*
           * Fallback: kalau cache viewer belum siap,
           * download dari storage seperti sebelumnya.
           */
          if (!temporaryPath) {
            const downloadResult =
              await ReactNativeBlobUtil
                .config({
                  fileCache: true,
                })
                .fetch(
                  "GET",
                  data.signedUrl
                );

            temporaryPath =
              downloadResult.path();
          }

          try {
            const mediaUri =
              await ReactNativeBlobUtil
                .MediaCollection
                .copyToMediaStore(
                  {
                    name: safeName,
                    parentFolder: "",
                    mimeType: mime,
                  },
                  "Download",
                  temporaryPath
                );

            if (!mediaUri) {
              throw new Error(
                "File gagal disimpan ke folder Download."
              );
            }

            console.log(
              "[DOWNLOAD]",
              JSON.stringify({
                event:
                  "MEDIASTORE_SAVED",
                name:
                  safeName,
                uri:
                  mediaUri,
                reusedPdfCache:
                  !shouldCleanupTemporaryPath,
              })
            );

            setDownloadSuccessFileUri(
              mediaUri
            );
            setDownloadSuccessFileMime(
              mime
            );
            setDownloadSuccessFileName(
              safeName
            );
          }
          finally {
            /*
             * Jangan hapus cache PDF viewer.
             * Hanya hapus temporary file hasil
             * network download fallback.
             */
            if (
              shouldCleanupTemporaryPath &&
              temporaryPath
            ) {
              try {
                const exists =
                  await ReactNativeBlobUtil
                    .fs
                    .exists(
                      temporaryPath
                    );

                if (exists) {
                  await ReactNativeBlobUtil
                    .fs
                    .unlink(
                      temporaryPath
                    );
                }
              }
              catch (cleanupError) {
                console.warn(
                  "File sementara download gagal dibersihkan:",
                  cleanupError
                );
              }
            }
          }

          return;
        }

        /*
         * Fallback Android lama (< 10).
         */
        const targetPath =
          ReactNativeBlobUtil.fs.dirs.DownloadDir +
          "/" +
          safeName;

        await ReactNativeBlobUtil
          .config({
            addAndroidDownloads: {
              useDownloadManager: true,
              notification: true,
              mediaScannable: true,
              title: safeName,
              description:
                "Mengunduh " +
                product.title,
              mime,
              path: targetPath,
            },
          })
          .fetch(
            "GET",
            data.signedUrl
          );

        setDownloadSuccessFileUri(
          targetPath
        );
        setDownloadSuccessFileMime(
          mime
        );
        setDownloadSuccessFileName(safeName);

        return;
      }

      const targetPath =
        ReactNativeBlobUtil.fs.dirs.DocumentDir +
        "/" +
        safeName;

      await ReactNativeBlobUtil
        .config({
          path: targetPath,
          fileCache: true,
        })
        .fetch(
          "GET",
          data.signedUrl
        );

      Alert.alert(
        "Unduhan selesai",
        "File telah disimpan di perangkat."
      );
    }
    catch (error) {
      console.error(
        "Unduh produk gagal:",
        error
      );

      Alert.alert(
        "Belum dapat mengunduh produk",
        error instanceof Error
          ? error.message
          : "Silakan coba lagi."
      );
    }
    finally {
      setProductAccessLoading(
        false
      );
    }
  }

  async function handlePrimaryProductAction() {
    if (productAccessLoading) {
      return;
    }

    if (isOwner) {
      await openOwnedProduct();
      return;
    }

    if (hasProductAccess) {
      await openOwnedProduct();
      return;
    }

    if (product.price === "Gratis") {
      const {
        data: { session: activeSession },
        error: activeSessionError,
      } = await supabase.auth.getSession();

      if (activeSessionError) {
        console.warn(
          "Baca sesi download gagal:",
          activeSessionError
        );
      }

      const effectiveCurrentUserId =
        activeSession?.user?.id ?? null;

      if (
        effectiveCurrentUserId &&
        effectiveCurrentUserId !== currentUserId
      ) {
        setCurrentUserId(
          effectiveCurrentUserId
        );
      }

      console.log(
        "[DOWNLOAD_AUTH]",
        JSON.stringify({
          event: "SESSION_RESOLVED",
          authenticated:
            Boolean(effectiveCurrentUserId),
          productId:
            product.id,
        })
      );

      if (!effectiveCurrentUserId) {
        Alert.alert(
          "Login diperlukan",
          "Silakan login terlebih dahulu."
        );

        return;
      }

      setProductAccessLoading(
        true
      );

      try {
        const {
          error,
        } =
          await supabase.rpc(
            "claim_free_store_product",
            {
              target_product_id:
                product.id,
            }
          );

        if (error) {
          throw error;
        }

        setHasProductAccess(
          true
        );

        await openOwnedProduct(
          true
        );
      }
      catch (error) {
        console.error(
          "Dapatkan produk gratis gagal:",
          error
        );

        Alert.alert(
          "Belum dapat mengambil produk",
          error instanceof Error
            ? error.message
            : "Silakan coba lagi."
        );
      }
      finally {
        setProductAccessLoading(
          false
        );
      }

      return;
    }

    Alert.alert(
      "Pembayaran belum tersedia",
      "Fitur pembelian produk berbayar sedang dipersiapkan."
    );
  }

  /*
   * Cover 1:1 hanya untuk kartu Store.
   * Detail Produk hanya memakai halaman produk.
   */  /*
   * PRODUCT_DETAIL_FIRST_PAINT_V10
   *
   * Jangan bangun seluruh gallery pada render
   * pertama. Beri native UI kesempatan commit
   * header + avatar terlebih dahulu.
   */
  const [
    previewMountProductId,
    setPreviewMountProductId,
  ] = useState<string | null>(
    null
  );

  useEffect(() => {
    let active = true;

    const frame =
      requestAnimationFrame(
        () => {
          if (!active) {
            return;
          }

          setPreviewMountProductId(
            product.id
          );
        }
      );

    return () => {
      active = false;

      cancelAnimationFrame(
        frame
      );
    };
  }, [
    product.id,
  ]);

  const previewUiReady =
    previewMountProductId ===
    product.id;


  const isPdfProduct =
    Boolean(
      detail?.file_path
        ?.trim()
        .toLowerCase()
        .endsWith(".pdf")
    );

  const productSlides =
    previewUiReady
      ? (
          isPdfProduct
            ? pdfPageUrls
            : productPageUrls
        )
      : [];

  const productPageCount =
    isPdfProduct
      ? pdfPageCount
      : Math.max(
          Number(
            product.pageCount ?? 0
          ),
          productSlides.length
        );

  const productGalleryWidth =
    Math.max(
      viewportWidth,
      1
    );


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
        ) : (
          <View
            style={
              styles.headerVisitorActions
            }
          >
            <Pressable
              style={
                styles.creatorHeaderIdentity
              }
              onPress={() =>
                onOpenCreatorProfile(
                  product.creatorUserId
                )
              }
              hitSlop={6}
              accessibilityLabel="Buka profil pembuat"
            >
              <Text
                style={
                  styles.creatorHeaderName
                }
                numberOfLines={1}
                allowFontScaling={false}
              >
                {String(
                  product.author ||
                  detail?.creator_name ||
                  "Pengguna"
                ).trim()}
              </Text>

              <View
                style={[
                  styles.creatorVerifiedBadge,
                  !creatorVerified &&
                    styles.creatorVerifiedBadgeHidden,
                ]}
              >
                <Check
                  size={7}
                  color="#FFFFFF"
                  strokeWidth={3.2}
                />
              </View>
            </Pressable>

            <View
              style={
                styles.creatorFollowWrap
              }
            >
              <Pressable
                style={
                  styles.creatorAvatarButton
                }
                onPress={() =>
                  onOpenCreatorProfile(
                    product.creatorUserId
                  )
                }
                hitSlop={6}
                accessibilityLabel="Buka profil pembuat"
              >
                {creatorAvatarUrl ? (
                  <Image
                    source={{
                      uri:
                        creatorAvatarUrl,
                    }}
                    style={
                      styles.creatorAvatarImage
                    }
                    resizeMode="cover"
                    fadeDuration={0}

                    onLoadStart={() => {
                      console.log(
                        "[AVATAR_DIAG][IMAGE_START]",
                        {
                          uri:
                            creatorAvatarUrl,

                          sinceStart:
                            Date.now() -
                            avatarDiagStartedAt,

                          at:
                            Date.now(),
                        }
                      );
                    }}

                    onLoad={() => {
                      console.log(
                        "[AVATAR_DIAG][IMAGE_LOADED]",
                        {
                          uri:
                            creatorAvatarUrl,

                          sinceStart:
                            Date.now() -
                            avatarDiagStartedAt,

                          at:
                            Date.now(),
                        }
                      );
                    }}

                    onError={event => {
                      console.log(
                        "[AVATAR_DIAG][IMAGE_ERROR]",
                        {
                          uri:
                            creatorAvatarUrl,

                          error:
                            event.nativeEvent,

                          sinceStart:
                            Date.now() -
                            avatarDiagStartedAt,

                          at:
                            Date.now(),
                        }
                      );
                    }}
                  />
                ) : (
                  <View
                    style={
                      styles.creatorAvatarPlaceholder
                    }
                  >
                    <Text
                      style={
                        styles.creatorAvatarInitial
                      }
                    >
                      {String(
                        detail?.creator_name ||
                        product.author ||
                        "D"
                      )
                        .trim()
                        .charAt(0)
                        .toUpperCase()}
                    </Text>
                  </View>
                )}
              </Pressable>

              {creatorFollowReady && !isFollowingCreator ? (
                <Pressable
                  style={
                    styles.creatorFollowBadge
                  }
                  onPress={() =>
                    void handleCreatorFollowToggle()
                  }
                  disabled={followLoading}
                  hitSlop={7}
                  accessibilityLabel="Ikuti pembuat"
                >
                  {followLoading ? (
                    <ActivityIndicator
                      size={10}
                      color="#FFFFFF"
                    />
                  ) : (
                    <Plus
                      size={14}
                      color="#FFFFFF"
                      strokeWidth={3}
                    />
                  )}
                </Pressable>
              ) : null}
            </View>
          </View>
        )}


      </View>

      {errorMessage && !detail ? (
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
          style={styles.detailScroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={
            styles.content
          }
          scrollEventThrottle={
            isPdfProduct
              ? 16
              : undefined
          }
          onScroll={
            isPdfProduct
              ? event => {
                  if (productPageCount <= 0) {
                    return;
                  }

                  const estimatedPageHeight =
                    productGalleryWidth *
                      (297 / 210) +
                    8;

                  const offsetY =
                    event.nativeEvent
                      .contentOffset.y;

                  const nextIndex =
                    Math.floor(
                      (
                        offsetY +
                        estimatedPageHeight * 0.35
                      ) /
                        estimatedPageHeight
                    );

                  setActiveProductSlide(
                    Math.max(
                      0,
                      Math.min(
                        nextIndex,
                        productPageCount - 1
                      )
                    )
                  );
                }
              : undefined
          }
        >
          <View
            style={[
              styles.productGallery,
              isPdfProduct &&
                styles.pdfProductGallery,
            ]}
          >
            {isPdfProduct ? (
              productSlides.length > 0 ? (
                <View
                  style={
                    styles.pdfDocument
                  }
                >
                  {productSlides.map(
                    (imageUrl, index) => (
                      <View
                        key={`${product.id}-pdf-page-${index}`}
                        style={
                          styles.pdfPage
                        }
                      >
                        {imageUrl ? (
                          <Image
                            source={{
                              uri: imageUrl,
                            }}
                            style={
                              styles.pdfPageImage
                            }
                            resizeMode="contain"
                          />
                        ) : (
                          <View
                            style={
                              styles.pdfPageLoading
                            }
                          >
                            <ActivityIndicator
                              size="small"
                              color="#2563EB"
                            />
                          </View>
                        )}

                        <View
                          style={
                            styles.pdfPageNumber
                          }
                        >
                          <Text
                            style={
                              styles.pdfPageNumberText
                            }
                          >
                            {index + 1}
                            {" / "}
                            {productPageCount}
                          </Text>
                        </View>
                      </View>
                    ))
                  }
                </View>
              ) : (
                <View
                  style={
                    styles.pdfInitialLoading
                  }
                >
                  {pdfViewerError ? (
                    <Text
                      style={styles.errorText}
                    >
                      {pdfViewerError}
                    </Text>
                  ) : (
                    <ActivityIndicator
                      size="small"
                      color="#2563EB"
                    />
                  )}
                </View>
              )
            ) : productSlides.length > 0 ? (
              <ScrollView
                ref={productSlideScrollRef}
                horizontal
                nestedScrollEnabled
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                snapToInterval={
                  productGalleryWidth
                }
                snapToAlignment="start"
                disableIntervalMomentum
                onScrollBeginDrag={event => {
                  productSlideDragStartXRef.current =
                    event.nativeEvent
                      .contentOffset.x;
                }}
                onScrollEndDrag={event => {
                  const startX =
                    productSlideDragStartXRef.current;

                  const endX =
                    event.nativeEvent
                      .contentOffset.x;

                  const deltaX =
                    endX - startX;

                  const startIndex =
                    Math.round(
                      startX /
                        productGalleryWidth
                    );

                  let nextIndex =
                    startIndex;

                  /*
                   * Swipe dibuat lebih sensitif.
                   * Geser sekitar 18px sudah cukup
                   * untuk pindah satu halaman.
                   */
                  if (
                    Math.abs(deltaX) >= 18
                  ) {
                    nextIndex =
                      startIndex +
                      (
                        deltaX > 0
                          ? 1
                          : -1
                      );
                  }

                  nextIndex =
                    Math.max(
                      0,
                      Math.min(
                        nextIndex,
                        productSlides.length - 1
                      )
                    );

                  setActiveProductSlide(
                    nextIndex
                  );

                  productSlideScrollRef
                    .current
                    ?.scrollTo({
                      x:
                        nextIndex *
                        productGalleryWidth,
                      y: 0,
                      animated: true,
                    });
                }}
                onMomentumScrollEnd={event => {
                  const nextIndex =
                    Math.round(
                      event.nativeEvent
                        .contentOffset.x /
                        productGalleryWidth
                    );

                  setActiveProductSlide(
                    Math.max(
                      0,
                      Math.min(
                        nextIndex,
                        productSlides.length - 1
                      )
                    )
                  );
                }}
              >
                {productSlides.map(
                  (imageUrl, index) => (
                    <View
                      key={`${product.id}-page-${index}`}
                      style={[
                        styles.productSlide,
                        {
                          width:
                            productGalleryWidth,
                        },
                      ]}
                    >
                      {imageUrl && (
                        index <= activeProductSlide ||
                        (
                          firstImageSettledUrl ===
                            productSlides[0] &&
                          index ===
                            activeProductSlide + 1
                        )
                      ) ? (
                        <Image
                          source={{
                            uri: imageUrl,
                          }}
                          style={
                            styles.thumbnailImage
                          }
                          resizeMode="contain"
                          onLoadStart={() => {
                            imageStartedRef.current.set(
                              imageUrl,
                              Date.now()
                            );

                            logA4(
                              "IMAGE_START",
                              product.id,
                              {
                                page: index + 1,
                              }
                            );
                          }}
                          onLoad={() => {
                            const started =
                              imageStartedRef.current.get(
                                imageUrl
                              );

                            logA4(
                              "IMAGE_LOADED",
                              product.id,
                              {
                                page: index + 1,
                                imageMs:
                                  started === undefined
                                    ? -1
                                    : Date.now() -
                                      started,
                                sinceMountMs:
                                  Date.now() -
                                  openedAtRef.current,
                              }
                            );

                            if (index === 0) {
                              setFirstImageSettledUrl(
                                imageUrl
                              );
                            }
                          }}
                        />
                      ) : null}
                    </View>
                  ))
                }
              </ScrollView>
            ) : (
              <View
                style={[
                  styles.productSlide,
                  {
                    width:
                      productGalleryWidth,
                  },
                ]}
              >
                <ActivityIndicator
                  size="small"
                  color="#2563EB"
                />
              </View>
            )}

            {!isPdfProduct ? (
              <>
                <View
                  style={styles.typeBadge}
                >
                  <Text
                    style={
                      styles.typeBadgeText
                    }
                  >
                    {product.type}
                  </Text>
                </View>

                {productPageCount > 1 ? (
                  <View
                    style={
                      styles.slideCounter
                    }
                  >
                    <Text
                      style={
                        styles.slideCounterText
                      }
                    >
                      {activeProductSlide + 1}
                      {" / "}
                      {productPageCount}
                    </Text>
                  </View>
                ) : null}
              </>
            ) : null}
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





          {!isOwner ? (
            <>


              {contactError ? (
                <Text
                  style={
                    styles.contactError
                  }
                >
                  {contactError}
                </Text>
              ) : null}

              {product.price !== "Gratis" ? (
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
                  Transaksi langsung
                </Text>

                <Text
                  style={styles.safetyText}
                >
                  Bayar langsung ke kreator.
                  Diginaz tidak memproses pembayaran.
                </Text>
              </View>
            </View>
              ) : null}
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

        </ScrollView>
      )}

      <View style={styles.detailPurchaseBar}>
        {!isOwner ? (
          <Pressable
            style={[
              styles.detailContactButton,
              contactLoading &&
                styles.detailContactButtonDisabled,
            ]}
            onPress={
              handleContactCreator
            }
            disabled={
              contactLoading
            }
            accessibilityRole="button"
            accessibilityLabel="Hubungi Kreator"
          >
            {contactLoading ? (
              <ActivityIndicator
                size="small"
                color="#2563EB"
              />
            ) : (
              <>
                <MessageCircle
                  size={19}
                  color="#2563EB"
                  strokeWidth={1.9}
                />

                <Text
                  style={
                    styles.detailContactButtonText
                  }
                  numberOfLines={1}
                >
                  Hubungi Kreator
                </Text>
              </>
            )}
          </Pressable>
        ) : null}

        {canDownloadProduct ? (
          <Pressable
            style={[
              styles.detailPrimaryButton,
              productAccessLoading &&
                styles.detailPrimaryButtonDisabled,
            ]}
            onPress={
              handlePrimaryProductAction
            }
            disabled={
              productAccessLoading
            }
            accessibilityRole="button"
            accessibilityLabel="Unduh produk"
          >
            <View
              style={
                styles.detailActionContent
              }
            >
              <Download
                size={20}
                color="#FFFFFF"
                strokeWidth={2}
              />

              <Text
                style={
                  styles.detailPrimaryButtonText
                }
              >
                {productAccessLoading
                  ? "Memproses..."
                  : "Unduh"}
              </Text>
            </View>
          </Pressable>
        ) : (
          <Pressable
            style={[
              styles.detailPrimaryButton,
              productAccessLoading &&
                styles.detailPrimaryButtonDisabled,
            ]}
            onPress={
              handlePrimaryProductAction
            }
            disabled={
              productAccessLoading
            }
            accessibilityRole="button"
            accessibilityLabel="Beli produk sekarang"
          >
            <View
              style={
                styles.detailActionContent
              }
            >
              <ShoppingCart
                size={20}
                color="#FFFFFF"
                strokeWidth={2}
              />

              <Text
                style={
                  styles.detailPrimaryButtonText
                }
              >
                Beli Sekarang
              </Text>
            </View>

            <Text
              style={
                styles.detailPrimaryButtonPrice
              }
            >
              {product.price}
            </Text>
          </Pressable>
        )}
      </View>

      {/* DOWNLOAD_SUCCESS_DIGINAZ_MODAL_UI */}
      <Modal
        visible={
          Boolean(
            downloadSuccessFileName
          )
        }
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() =>
          setDownloadSuccessFileName(
            null
          )
        }
      >
        <View
          style={
            styles.deleteModalRoot
          }
        >
          <Pressable
            style={
              styles.deleteModalBackdrop
            }
            onPress={() =>
              setDownloadSuccessFileName(
                null
              )
            }
          />

          <View
            style={
              styles.deleteModalCard
            }
          >
            <View
              style={[
                styles.deleteModalIcon,
                {
                  backgroundColor:
                    "#ECFDF5",
                },
              ]}
            >
              <Check
                size={23}
                color="#16A34A"
                strokeWidth={2}
              />
            </View>

            <Text
              style={
                styles.deleteModalTitle
              }
            >
              Download berhasil
            </Text>

            <Text
              style={
                styles.deleteModalDescription
              }
            >
              File sudah tersimpan di perangkat Anda.
            </Text>

            <View
              style={
                styles.deleteModalProduct
              }
            >
              <Text
                style={
                  styles.deleteModalProductLabel
                }
              >
                FILE
              </Text>

              <Text
                style={
                  styles.deleteModalProductTitle
                }
                numberOfLines={2}
              >
                {
                  downloadSuccessFileName
                }
              </Text>

              <Text
                style={[
                  styles.deleteModalProductLabel,
                  {
                    marginTop: 9,
                  },
                ]}
              >
                DISIMPAN DI
              </Text>

              <Text
                style={
                  styles.deleteModalProductTitle
                }
              >
                Penyimpanan internal ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âº Download
              </Text>
            </View>

            <View
              style={
                styles.deleteModalActions
              }
            >
              <Pressable
                style={
                  styles.deleteModalCancelButton
                }
                onPress={() =>
                  setDownloadSuccessFileName(
                    null
                  )
                }
              >
                <Text
                  style={
                    styles.deleteModalCancelText
                  }
                >
                  Tutup
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.deleteModalDeleteButton,
                  {
                    backgroundColor:
                      "#16A34A",
                  },
                ]}
                onPress={() => {
                  const fileUri =
                    downloadSuccessFileUri;
                  const fileMime =
                    downloadSuccessFileMime;

                  setDownloadSuccessFileName(
                    null
                  );

                  if (!fileUri) {
                    void openDownloadFolder();
                    return;
                  }

                  void ReactNativeBlobUtil.android
                    .actionViewIntent(
                      fileUri,
                      fileMime
                    )
                    .catch(error => {
                      console.warn(
                        "File download tidak dapat dibuka langsung:",
                        error
                      );

                      void openDownloadFolder();
                    });
                }}
              >
                <Download
                  size={16}
                  color="#FFFFFF"
                  strokeWidth={1.9}
                />

                <Text
                  style={
                    styles.deleteModalDeleteText
                  }
                >
                  Lihat
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

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
    backgroundColor: "#FFFFFF",
  },

  header: {
    height: 62,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",

    backgroundColor: "#FFFFFF",

    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",

    position: "relative",
    zIndex: 100,
    elevation: 0,
    shadowOpacity: 0,
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
    marginLeft: 10,
    marginRight: "auto",
    transform: [
      { translateY: -2 },
    ],
    fontFamily:
      "PlusJakartaSans_700Bold",
    fontSize: 13,
    color: "#0F172A",
    textAlign: "left",
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

  headerVisitorActions: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  creatorHeaderIdentity: {
    maxWidth: 105,
    height: 18,
    flexDirection: "row",
    alignItems: "center",
  },

  creatorHeaderName: {
    maxWidth: 84,
    height: 16,
    flexShrink: 1,
    fontWeight: "600",
    fontSize: 11,
    lineHeight: 16,
    color: "#0F172A",
    includeFontPadding: false,
    textAlignVertical: "center",
  },

  creatorVerifiedBadge: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: 3,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  creatorVerifiedBadgeHidden: {
    opacity: 0,
  },

  creatorFollowWrap: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },

  creatorAvatarButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  creatorAvatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
  },

  creatorAvatarPlaceholder: {
    width: "100%",
    height: "100%",
    borderRadius: 21,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
  },

  creatorAvatarInitial: {
    fontFamily:
      "PlusJakartaSans_700Bold",
    fontSize: 16,
    color: "#2563EB",
  },

  creatorFollowBadge: {
    position: "absolute",
    bottom: -1,
    alignSelf: "center",
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    backgroundColor: "#2563EB",
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

  detailScroll: {
    flex: 1,
  },

  detailPurchaseBar: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 9,
    paddingBottom: 9,
    borderTopWidth:
      StyleSheet.hairlineWidth,
    borderTopColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },

  detailPurchaseSideAction: {
    width: 52,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
  },

  detailPurchaseSideActionText: {
    marginTop: 2,
    fontFamily:
      "PlusJakartaSans_500Medium",
    fontSize: 10.5,
    lineHeight: 14,
    color: "#0F172A",
  },

  detailCartButton: {
    width: 58,
    minHeight: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EFF6FF",
  },

  detailContactButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 10,
  },

  detailContactButtonDisabled: {
    opacity: 0.6,
  },

  detailContactButtonText: {
    flexShrink: 1,
    fontFamily:
      "PlusJakartaSans_600SemiBold",
    fontSize: 11,
    lineHeight: 15,
    color: "#2563EB",
    textAlign: "center",
  },

  detailPrimaryButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563EB",
  },

  detailFreeButton: {
    backgroundColor: "#2563EB",
  },

  detailPrimaryButtonDisabled: {
    opacity: 0.6,
  },

  detailActionContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  detailPrimaryButtonText: {
    fontFamily:
      "PlusJakartaSans_700Bold",
    fontSize: 14.5,
    lineHeight: 19,
    color: "#FFFFFF",
    textAlign: "center",
  },

  detailPrimaryButtonPrice: {
    marginTop: 1,
    fontFamily:
      "PlusJakartaSans_500Medium",
    fontSize: 10.5,
    lineHeight: 14,
    color:
      "rgba(255,255,255,0.88)",
    textAlign: "center",
  },

  content: {
    paddingBottom: 40,
  },

  pdfProductGallery: {
    overflow: "visible",
    backgroundColor: "#E2E8F0",
  },

  pdfDocument: {
    width: "100%",
    gap: 8,
    paddingBottom: 8,
    backgroundColor: "#E2E8F0",
  },

  pdfPage: {
    width: "100%",
    aspectRatio: 210 / 297,
    position: "relative",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  pdfPageImage: {
    width: "100%",
    height: "100%",
  },

  pdfPageLoading: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },

  pdfInitialLoading: {
    width: "100%",
    aspectRatio: 210 / 297,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },

  pdfPageNumber: {
    position: "absolute",
    right: 10,
    bottom: 10,
    minWidth: 42,
    height: 24,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor:
      "rgba(15, 23, 42, 0.66)",
  },

  pdfPageNumberText: {
    fontFamily:
      "PlusJakartaSans_600SemiBold",
    fontSize: 9,
    color: "#FFFFFF",
  },

  productGallery: {
    width: "100%",
    backgroundColor: "#EFF6FF",
    position: "relative",
    overflow: "hidden",
  },

  productSlide: {
    aspectRatio: 210 / 297,
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

  slideCounter: {
    position: "absolute",
    right: 14,
    bottom: 14,
    minWidth: 42,
    height: 26,
    paddingHorizontal: 9,
    borderRadius: 13,
    backgroundColor:
      "rgba(15, 23, 42, 0.72)",
    alignItems: "center",
    justifyContent: "center",
  },

  slideCounterText: {
    fontFamily:
      "PlusJakartaSans_600SemiBold",
    fontSize: 10,
    color: "#FFFFFF",
  },

  mainInfo: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },


  title: {
    marginTop: 4,
    fontFamily:
      "PlusJakartaSans_700Bold",
    fontSize: 14,
    lineHeight: 20,
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
    marginTop: 8,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  safetyIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },

  safetyContent: {
    flex: 1,
    gap: 1,
  },

  safetyTitle: {
    fontFamily:
      "PlusJakartaSans_600SemiBold",
    fontSize: 12.5,
    lineHeight: 17,
    color: "#334155",
  },

  safetyText: {
    fontFamily:
      "PlusJakartaSans_400Regular",
    fontSize: 11,
    lineHeight: 16,
    color: "#64748B",
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
    fontSize: 12,
    color: "#0F172A",
  },

  description: {
    marginTop: 5,
    fontFamily:
      "PlusJakartaSans_400Regular",
    fontSize: 12,
    lineHeight: 18,
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
    fontSize: 12,
    color: "#94A3B8",
  },

  infoValue: {
    flex: 1,
    textAlign: "right",
    fontFamily:
      "PlusJakartaSans_600SemiBold",
    fontSize: 12,
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

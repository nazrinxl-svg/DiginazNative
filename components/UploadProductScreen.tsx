import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Image,
} from "react-native";
import {
  ArrowLeft,
  FileText,
  Files,
  Image as ImageIcon,
  Upload,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ImageCropPicker from "react-native-image-crop-picker";
import { ImagePickerCompat as ImagePicker } from "../lib/nativePickers";
import { DocumentPickerCompat as DocumentPicker } from "../lib/nativePickers";

import { supabase } from "../lib/supabase";
import {
  STORE_MEDIA_BUCKETS,
  STORE_MEDIA_UPLOAD_LIMITS,
  assertStoreMediaUploadSize,
  type StoreMediaUploadSizeLimitKey,
  buildStoreProductFilePath,
  buildStoreProductOriginalPath,
  buildStoreProductPagePath,
  buildStoreThumbnailPath,
  finalizeStagedStoreProductMediaChange,
  registerStoreProductMediaAsset,
  rollbackStagedStoreProductMediaChange,
  rollbackStoreProductMediaAssets,
  stageStoreProductMediaRemoval,
  stageStoreProductMediaReplacement,
  type StagedStoreProductMediaChange,
} from "../lib/storeMedia";

type Props = {
  onClose: () => void;
  onUploaded: () => void;
  editProductId?: string | null;
};

type PickedAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;

  // EDIT_EXISTING_PAGE:
  // Jika terisi, halaman ini sudah ada di Storage.
  storagePath?: string | null;
};

const PRODUCT_PAGE_SLOT_SIZE = 106;
const PRODUCT_PAGE_SWAP_THRESHOLD =
  PRODUCT_PAGE_SLOT_SIZE / 2;
const PRODUCT_PAGE_LONG_PRESS_MS = 300;

type DraggableProductPageCardProps = {
  page: PickedAsset;
  index: number;
  totalPages: number;
  onMove: (
    fromIndex: number,
    toIndex: number
  ) => void;
  onRemove: () => void;
};

function DraggableProductPageCard({
  page,
  index,
  totalPages,
  onMove,
  onRemove,
}: DraggableProductPageCardProps) {
  const [dragging, setDragging] =
    useState(false);

  const dragX =
    useRef(
      new Animated.Value(0)
    ).current;

  const dragTimerRef =
    useRef<
      ReturnType<typeof setTimeout> |
        null
    >(null);

  const draggingRef =
    useRef(false);

  /*
   * Menyimpan posisi dx terakhir saat
   * halaman berhasil ditukar.
   */
  const dragLayoutOffsetRef =
    useRef(0);

  /*
   * Swipe biasa tidak boleh menjadi reorder.
   * Reorder baru siap setelah long-press.
   */
  const dragReadyRef =
    useRef(false);

  const touchStartXRef =
    useRef(0);

  const touchStartYRef =
    useRef(0);

  const indexRef =
    useRef(index);

  const totalPagesRef =
    useRef(totalPages);

  const onMoveRef =
    useRef(onMove);

  indexRef.current =
    index;

  totalPagesRef.current =
    totalPages;

  onMoveRef.current =
    onMove;

  function clearDragTimer() {
    if (
      dragTimerRef.current !== null
    ) {
      clearTimeout(
        dragTimerRef.current
      );

      dragTimerRef.current =
        null;
    }
  }

  function resetDrag() {
    clearDragTimer();

    dragX.stopAnimation();

    draggingRef.current =
      false;

    dragReadyRef.current =
      false;

    dragLayoutOffsetRef.current =
      0;

    setDragging(false);

    dragX.setValue(0);
  }

  function settleDrag() {
    clearDragTimer();

    dragReadyRef.current =
      false;

    draggingRef.current =
      false;

    Animated.spring(
      dragX,
      {
        toValue: 0,

        stiffness: 300,
        damping: 30,
        mass: 0.7,

        useNativeDriver:
          true,
      }
    ).start(
      ({ finished }) => {
        if (
          finished &&
          !draggingRef.current
        ) {
          dragLayoutOffsetRef.current =
            0;

          setDragging(false);
        }
      }
    );
  }

  useEffect(() => {
    return () => {
      clearDragTimer();
    };
  }, []);

  const panResponder =
    useRef(
      PanResponder.create({
        /*
         * Jangan ambil touch ketika baru
         * menyentuh gambar. Ini membuat
         * ScrollView horizontal tetap normal.
         */
        onStartShouldSetPanResponder:
          () => false,

        onMoveShouldSetPanResponderCapture:
          (_, gestureState) => {
            if (
              !dragReadyRef.current
            ) {
              return false;
            }

            return (
              Math.abs(
                gestureState.dx
              ) >= 4 &&
              Math.abs(
                gestureState.dx
              ) >
                Math.abs(
                  gestureState.dy
                )
            );
          },

        onMoveShouldSetPanResponder:
          (_, gestureState) => {
            if (
              !dragReadyRef.current
            ) {
              return false;
            }

            return (
              Math.abs(
                gestureState.dx
              ) >= 4 &&
              Math.abs(
                gestureState.dx
              ) >
                Math.abs(
                  gestureState.dy
                )
            );
          },

        onPanResponderGrant:
          () => {
            clearDragTimer();

            dragReadyRef.current =
              false;

            draggingRef.current =
              true;

            dragLayoutOffsetRef.current =
              0;

            setDragging(true);
          },

        onPanResponderMove:
          (_, gestureState) => {
            if (
              !draggingRef.current
            ) {
              return;
            }

            const relativeDx =
              gestureState.dx -
              dragLayoutOffsetRef.current;

            dragX.setValue(
              relativeDx
            );

            const fromIndex =
              indexRef.current;

            const maxIndex =
              totalPagesRef.current -
              1;

            if (
              relativeDx >=
                PRODUCT_PAGE_SWAP_THRESHOLD &&
              fromIndex < maxIndex
            ) {
              onMoveRef.current(
                fromIndex,
                fromIndex + 1
              );

              dragLayoutOffsetRef.current +=
                PRODUCT_PAGE_SLOT_SIZE;

              dragX.setValue(
                gestureState.dx -
                  dragLayoutOffsetRef.current
              );

              return;
            }

            if (
              relativeDx <=
                -PRODUCT_PAGE_SWAP_THRESHOLD &&
              fromIndex > 0
            ) {
              onMoveRef.current(
                fromIndex,
                fromIndex - 1
              );

              dragLayoutOffsetRef.current -=
                PRODUCT_PAGE_SLOT_SIZE;

              dragX.setValue(
                gestureState.dx -
                  dragLayoutOffsetRef.current
              );
            }
          },

        onPanResponderRelease:
          () => {
            settleDrag();
          },

        onPanResponderTerminate:
          () => {
            settleDrag();
          },

        onPanResponderTerminationRequest:
          () =>
            !draggingRef.current,
      })
    ).current;


  return (
    <Animated.View
      style={[
        styles.productPageCard,
        dragging &&
          styles.productPageCardDragging,
        {
          transform: [
            {
              translateX:
                dragX,
            },
            {
              scale:
                dragging
                  ? 1.05
                  : 1,
            },
          ],
        },
      ]}
    >
      <View
        {...panResponder.panHandlers}
        onTouchStart={event => {
          clearDragTimer();

          dragX.stopAnimation();

          dragX.setValue(0);

          setDragging(false);

          dragReadyRef.current =
            false;

          draggingRef.current =
            false;

          dragLayoutOffsetRef.current =
            0;

          touchStartXRef.current =
            event.nativeEvent.pageX;

          touchStartYRef.current =
            event.nativeEvent.pageY;

          dragTimerRef.current =
            setTimeout(
              () => {
                dragReadyRef.current =
                  true;
              },
              PRODUCT_PAGE_LONG_PRESS_MS
            );
        }}
        onTouchMove={event => {
          if (
            dragReadyRef.current ||
            draggingRef.current
          ) {
            return;
          }

          const dx =
            event.nativeEvent.pageX -
            touchStartXRef.current;

          const dy =
            event.nativeEvent.pageY -
            touchStartYRef.current;

          /*
           * Jari langsung bergerak =
           * niat scroll, bukan reorder.
           */
          if (
            Math.abs(dx) > 14 ||
            Math.abs(dy) > 14
          ) {
            clearDragTimer();
          }
        }}
        onTouchEnd={() => {
          if (
            !draggingRef.current
          ) {
            clearDragTimer();

            dragReadyRef.current =
              false;
          }
        }}
        onTouchCancel={() => {
          if (
            !draggingRef.current
          ) {
            clearDragTimer();

            dragReadyRef.current =
              false;
          }
        }}
        style={
          styles.productPageDragSurface
        }
      >
        <View
          style={
            styles.productPageImageWrap
          }
        >
          <Image
            source={{
              uri: page.uri,
            }}
            style={
              styles.productPageImage
            }
            resizeMode="contain"
          />

          {dragging ? (
            <View
              style={
                styles.productPageDragBadge
              }
            >
              <Text
                style={
                  styles.productPageDragBadgeText
                }
              >
                Halaman {index + 1}
              </Text>
            </View>
          ) : null}
        </View>

        <Text
          style={
            styles.productPageNumber
          }
        >
          Halaman {index + 1}
        </Text>
      </View>

      <Pressable
        onPress={onRemove}
        hitSlop={8}
        style={
          styles.productPageRemove
        }
      >
        <X
          size={14}
          color="#FFFFFF"
          strokeWidth={2.4}
        />
      </Pressable>
    </Animated.View>
  );
}


const PRODUCT_TYPES = [
  "LKPD",
  "PPT",
  "E-Book",
  "Media Pembelajaran",
];

const CLASS_LEVELS = [
  "Kelas 1",
  "Kelas 2",
  "Kelas 3",
  "Kelas 4",
  "Kelas 5",
  "Kelas 6",
  "Kelas 7",
  "Kelas 8",
  "Kelas 9",
  "Kelas 10",
  "Kelas 11",
  "Kelas 12",
  "Guru",
];

const SUBJECTS = [
  "Pendidikan Agama Islam",
  "Pendidikan Pancasila",
  "Bahasa Indonesia",
  "Matematika",
  "IPAS",
  "Bahasa Inggris",
  "PJOK",
  "Seni Budaya",
  "Informatika",
  "Muatan Lokal",
  "Lainnya",
];


function safeFileName(value: string) {
  return value
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-");
}

function getExtension(
  asset: PickedAsset,
  fallback: string
) {
  const name =
    asset.fileName ??
    asset.uri.split("/").pop() ??
    "";

  const extension =
    name
      .split(".")
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, "");

  return extension || fallback;
}

function getPickedAssetSizeBytes(
  value: unknown
): number | null {
  const parsed =
    Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed < 0
  ) {
    return null;
  }

  return Math.trunc(parsed);
}

async function fetchStoreUploadBuffer(
  asset: PickedAsset,
  limitKey: StoreMediaUploadSizeLimitKey,
  label: string
): Promise<ArrayBuffer> {
  if (
    asset.sizeBytes != null
  ) {
    assertStoreMediaUploadSize(
      asset.sizeBytes,
      limitKey,
      label
    );
  }

  const buffer =
    await fetch(
      asset.uri
    ).then(response =>
      response.arrayBuffer()
    );

  assertStoreMediaUploadSize(
    buffer.byteLength,
    limitKey,
    label
  );

  return buffer;
}

export default function UploadProductScreen({
  onClose,
  onUploaded,
  editProductId = null,
}: Props) {
  const [title, setTitle] = useState("");
  const [productType, setProductType] =
    useState("LKPD");

  const [subject, setSubject] = useState("");
  const [
    customSubject,
    setCustomSubject,
  ] = useState("");
  const [classLevel, setClassLevel] =
    useState("Kelas 1");

  const [
    showProductTypeMenu,
    setShowProductTypeMenu,
  ] = useState(false);

  const [
    showSubjectMenu,
    setShowSubjectMenu,
  ] = useState(false);

  const [
    showClassLevelMenu,
    setShowClassLevelMenu,
  ] = useState(false);

  const [pricingType, setPricingType] =
    useState<"free" | "paid">("free");

  const [
    showPricingTypeMenu,
    setShowPricingTypeMenu,
  ] = useState(false);

  const [price, setPrice] = useState("");
  const [description, setDescription] =
    useState("");

  const [thumbnail, setThumbnail] =
    useState<PickedAsset | null>(null);

  const [productFile, setProductFile] =
    useState<PickedAsset | null>(null);

  /*
   * WORD_MANUAL_PREVIEW_V1
   * Word asli = productFile
   * PDF preview = previewPdfFile
   */
  const [
    previewPdfFile,
    setPreviewPdfFile,
  ] =
    useState<PickedAsset | null>(null);

  const [productPages, setProductPages] =
    useState<PickedAsset[]>([]);

  const [submitting, setSubmitting] =
    useState(false);

  // UPLOAD_PROGRESS_V1
  const [
    uploadProgress,
    setUploadProgress,
  ] = useState<number | null>(null);

  function updateUploadProgress(
    value: number
  ) {
    const nextValue =
      Math.max(
        0,
        Math.min(
          100,
          Math.round(value)
        )
      );

    setUploadProgress(
      current =>
        current === null
          ? nextValue
          : Math.max(
              current,
              nextValue
            )
    );
  }

  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    if (!editProductId) {
      return;
    }

    let active = true;

    async function loadProductForEdit() {
      setErrorMessage("");

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
          .select(
            "id,creator_user_id,title,product_type,subject,class_level,pricing_type,price_amount,description,thumbnail_path,file_path"
          )
          .eq("id", editProductId)
          .eq("creator_user_id", user.id)
          .single();

        if (error) {
          throw error;
        }

        // EDIT_SLIDES_LOAD_EXISTING
        const {
          data: pageRows,
          error: pageRowsError,
        } = await supabase
          .from("store_product_pages")
          .select(
            "page_number,storage_path,mime_type,original_name"
          )
          .eq(
            "product_id",
            editProductId
          )
          .order(
            "page_number",
            {
              ascending: true,
            }
          );

        if (pageRowsError) {
          throw pageRowsError;
        }

        const loadedPages:
          PickedAsset[] = [];

        const currentFilePath =
          String(
            data.file_path ?? ""
          )
            .trim()
            .toLowerCase();

        const shouldLoadImagePages =
          !currentFilePath.endsWith(
            ".pdf"
          );

        /*
         * EDIT_IMAGE_PREVIEW_BATCH_V1
         * Semua signed URL halaman dibuat
         * dalam satu request Storage.
         */
        const imagePageRows =
          (
            shouldLoadImagePages
              ? pageRows ?? []
              : []
          ).filter(row =>
            Boolean(
              String(
                row.storage_path ?? ""
              ).trim()
            )
          );

        if (
          imagePageRows.length > 0
        ) {
          const storagePaths =
            imagePageRows.map(row =>
              String(
                row.storage_path ?? ""
              ).trim()
            );

          const {
            data: signedRows,
            error: signedRowsError,
          } =
            await supabase.storage
              .from(
                "store-product-files"
              )
              .createSignedUrls(
                storagePaths,
                3600
              );

          if (signedRowsError) {
            throw signedRowsError;
          }

          if (
            !signedRows ||
            signedRows.length !==
              imagePageRows.length
          ) {
            throw new Error(
              "Preview halaman produk tidak lengkap."
            );
          }

          for (
            let index = 0;
            index <
              imagePageRows.length;
            index++
          ) {
            const row =
              imagePageRows[index];

            const storagePath =
              storagePaths[index];

            const signedUrl =
              signedRows[index]
                ?.signedUrl;

            if (!signedUrl) {
              throw new Error(
                "Preview halaman produk tidak dapat disiapkan."
              );
            }

            loadedPages.push({
              uri: signedUrl,

              fileName:
                row.original_name ??
                `Halaman ${row.page_number}`,

              mimeType:
                row.mime_type ??
                "image/jpeg",

              storagePath,
            });
          }
        }

        if (!active) {
          return;
        }

        setTitle(data.title ?? "");
        setProductType(
          data.product_type ?? "LKPD"
        );
        const loadedSubject =
          data.subject ?? "";

        if (
          loadedSubject &&
          SUBJECTS.includes(
            loadedSubject
          )
        ) {
          setSubject(
            loadedSubject
          );
          setCustomSubject("");
        } else if (
          loadedSubject
        ) {
          setSubject("Lainnya");
          setCustomSubject(
            loadedSubject
          );
        } else {
          setSubject("");
          setCustomSubject("");
        }

        setClassLevel(
          data.class_level ?? "Kelas 1"
        );
        setPricingType(
          data.pricing_type === "paid"
            ? "paid"
            : "free"
        );
        setPrice(
          data.pricing_type === "paid" &&
          data.price_amount != null
            ? String(data.price_amount)
            : ""
        );
        setDescription(
          data.description ?? ""
        );

        if (
          loadedPages.length > 0
        ) {
          setProductFileKind(
            "image"
          );

          setProductPages(
            loadedPages
          );

          setProductFile(
            loadedPages[0]
          );
        } else {
          setProductPages([]);
          setProductFile(null);

          setProductFileKind(
            data.file_path
              ? "pdf"
              : null
          );
        }
      } catch (error) {
        if (!active) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Produk belum dapat dimuat untuk diedit."
        );
      }
    }

    void loadProductForEdit();

    return () => {
      active = false;
    };
  }, [editProductId]);

  const [
    productFileKind,
    setProductFileKind,
  ] =
    useState<
      "pdf" |
      "image" |
      "office" |
      null
    >(null);

  const [
    showProductFileKindMenu,
    setShowProductFileKindMenu,
  ] =
    useState(false);


  function selectProductFileKind(
    kind:
      | "pdf"
      | "image"
      | "office"
  ) {
    setProductFileKind(kind);
    setShowProductFileKindMenu(false);
                setShowPricingTypeMenu(false);

    // Hindari file lama tetap terbaca
    // setelah jenis file diganti.
    setProductFile(null);
    setPreviewPdfFile(null);
    setProductPages([]);

    setErrorMessage("");
  }


  async function chooseThumbnail() {
    setErrorMessage("");

    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        setErrorMessage(
          "Izin galeri diperlukan untuk memilih cover produk."
        );
        return;
      }

      const image =
        await ImageCropPicker.openPicker({
          mediaType: "photo",
          width: 1080,
          height: 1080,
          cropping: true,
          compressImageQuality: 0.9,
          cropperToolbarTitle:
            "Atur Cover 1:1",
          cropperChooseText:
            "Gunakan",
          cropperCancelText:
            "Batal",
          enableRotationGesture: true,
          freeStyleCropEnabled: false,
        });

      if (
        !image?.path
      ) {
        return;
      }

      setThumbnail({
        uri: image.path,
        fileName:
          `thumbnail-${Date.now()}.jpg`,
        mimeType:
          image.mime ??
          "image/jpeg",
        sizeBytes:
          getPickedAssetSizeBytes(
            image.size
          ),
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "";

      if (
        message
          .toLowerCase()
          .includes("cancel")
      ) {
        return;
      }

      setErrorMessage(
        "Cover produk belum dapat dipilih."
      );
    }
  }



  function removeProductPage(
    index: number
  ) {
    const nextPages =
      productPages.filter(
        (_, pageIndex) =>
          pageIndex !== index
      );

    setProductPages(
      nextPages
    );

    // Halaman pertama tetap menjadi
    // file_path utama agar alur lama
    // tetap kompatibel.
    setProductFile(
      nextPages[0] ??
      null
    );
  }


  function moveProductPage(
    fromIndex: number,
    toIndex: number
  ) {
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >=
        productPages.length ||
      toIndex >=
        productPages.length
    ) {
      return;
    }

    const nextPages = [
      ...productPages,
    ];

    const [movedPage] =
      nextPages.splice(
        fromIndex,
        1
      );

    nextPages.splice(
      toIndex,
      0,
      movedPage
    );

    setProductPages(
      nextPages
    );

    setProductFile(
      nextPages[0] ?? null
    );

    setErrorMessage("");
  }


  async function syncProductImagePages(
    userId: string,
    productId: string,
    firstStoragePath: string,
    pages: PickedAsset[],
    createdMediaAssetIds: string[]
  ) {
    if (
      pages.length === 0
    ) {
      return;
    }

    if (
      pages.length >
      STORE_MEDIA_UPLOAD_LIMITS
        .maxImagePages
    ) {
      throw new Error(
        `Produk gambar maksimal ${STORE_MEDIA_UPLOAD_LIMITS.maxImagePages} halaman.`
      );
    }

    const {
      data: previousRows,
      error: previousRowsError,
    } =
      await supabase
        .from(
          "store_product_pages"
        )
        .select(
          "storage_path"
        )
        .eq(
          "product_id",
          productId
        );

    if (previousRowsError) {
      throw previousRowsError;
    }

    const previousPaths =
      (previousRows ?? [])
        .map(row =>
          String(
            row.storage_path ??
            ""
          )
        )
        .filter(Boolean);

    const rows = [
      {
        product_id:
          productId,

        page_number:
          1,

        storage_path:
          firstStoragePath,

        mime_type:
          pages[0].mimeType ??
          "image/jpeg",

        original_name:
          pages[0].fileName ??
          null,
      },
    ];

    const currentPaths: string[] =
      [
        firstStoragePath,
      ];

    const uploadedExtras:
      string[] = [];

    try {
      const batchId =
        Date.now();

      for (
        let index = 1;
        index < pages.length;
        index++
      ) {
        const page =
          pages[index];

        const extension =
          getExtension(
            page,
            "jpg"
          );

        const rawName =
          page.fileName ??
          `halaman-${index + 1}.${extension}`;

        const cleanName =
          safeFileName(
            rawName
          );

        const storagePath =
          buildStoreProductPagePath(
            userId,
            productId,
            index + 1,
            batchId,
            cleanName
          );

        const buffer =
          await fetchStoreUploadBuffer(page, "productFileBytes", "Gambar produk");

        const {
          error: uploadError,
        } =
          await supabase.storage
            .from(
              STORE_MEDIA_BUCKETS.productFiles
            )
            .upload(
              storagePath,
              buffer,
              {
                contentType:
                  page.mimeType ??
                  "image/jpeg",

                upsert:
                  false,
              }
            );

        if (uploadError) {
          throw uploadError;
        }

        uploadedExtras.push(
          storagePath
        );

        const pageMediaAssetId =
          await registerStoreProductMediaAsset({
            ownerUserId:
              userId,
            productId,
            bucket:
              STORE_MEDIA_BUCKETS.productFiles,
            storagePath,
            mediaKind:
              "image",
            variant:
              "page",
            mimeType:
              page.mimeType ??
              "image/jpeg",
            sizeBytes:
              buffer.byteLength,
            visibility:
              "private",
            role:
              "page",
            sortOrder:
              index + 1,
            metadata: {
              source:
                "product_upload",
              page_number:
                index + 1,
            },
          });

        createdMediaAssetIds.push(
          pageMediaAssetId
        );

        updateUploadProgress(
          40 +
            (
              index /
              Math.max(
                1,
                pages.length - 1
              )
            ) *
              45
        );

        currentPaths.push(
          storagePath
        );

        rows.push({
          product_id:
            productId,

          page_number:
            index + 1,

          storage_path:
            storagePath,

          mime_type:
            page.mimeType ??
            "image/jpeg",

          original_name:
            page.fileName ??
            null,
        });
      }


      const {
        error: upsertError,
      } =
        await supabase
          .from(
            "store_product_pages"
          )
          .upsert(
            rows,
            {
              onConflict:
                "product_id,page_number",
            }
          );

      if (upsertError) {
        throw upsertError;
      }


      const {
        error: trimError,
      } =
        await supabase
          .from(
            "store_product_pages"
          )
          .delete()
          .eq(
            "product_id",
            productId
          )
          .gt(
            "page_number",
            pages.length
          );

      if (trimError) {
        throw trimError;
      }


      const stalePaths =
        previousPaths.filter(
          path =>
            !currentPaths.includes(
              path
            )
        );

      if (
        stalePaths.length > 0
      ) {
        const {
          error: cleanupError,
        } =
          await supabase.storage
            .from(
              "store-product-files"
            )
            .remove(
              stalePaths
            );

        if (cleanupError) {
          console.warn(
            "Halaman lama belum terhapus:",
            cleanupError
          );
        }
      }
    }
    catch (error) {
      if (
        uploadedExtras.length > 0
      ) {
        await supabase.storage
          .from(
            "store-product-files"
          )
          .remove(
            uploadedExtras
          );
      }

      throw error;
    }
  }


  // EDIT_SLIDES_SYNC_RPC_V2
  async function syncEditedImagePages(
    userId: string,
    productId: string,
    pages: PickedAsset[],
    productInput: {
      title: string;
      productType: string;
      subject: string;
      classLevel: string;
      pricingType: "free" | "paid";
      priceAmount: number | null;
      description: string;
      thumbnailPath: string | null;
    }
  ): Promise<{
    firstStoragePath: string;
    staleStorage: Array<{
      bucket: string;
      storagePath: string;
    }>;
  }> {
    if (pages.length === 0) {
      throw new Error(
        "Produk gambar minimal memiliki 1 halaman."
      );
    }

    if (
      pages.length >
      STORE_MEDIA_UPLOAD_LIMITS
        .maxImagePages
    ) {
      throw new Error(
        `Produk gambar maksimal ${STORE_MEDIA_UPLOAD_LIMITS.maxImagePages} halaman.`
      );
    }

    const {
      data: previousRows,
      error: previousRowsError,
    } = await supabase
      .from("store_product_pages")
      .select("storage_path")
      .eq("product_id", productId);

    if (previousRowsError) {
      throw previousRowsError;
    }

    const previousPaths =
      (previousRows ?? [])
        .map(row =>
          String(
            row.storage_path ?? ""
          ).trim()
        )
        .filter(Boolean);

    const uploadedPaths: string[] = [];

    const rpcPages: Array<{
      storage_path: string;
      mime_type: string;
      original_name: string | null;
      size_bytes: number | null;
    }> = [];

    let rpcCommitted = false;

    try {
      const batchId = Date.now();

      for (
        let index = 0;
        index < pages.length;
        index++
      ) {
        const page = pages[index];

        let storagePath =
          page.storagePath?.trim() ?? "";

        if (
          storagePath &&
          !previousPaths.includes(
            storagePath
          )
        ) {
          storagePath = "";
        }

        let sizeBytes:
          number | null = null;

        if (!storagePath) {
          const extension =
            getExtension(
              page,
              "jpg"
            );

          const rawName =
            page.fileName ??
            `halaman-${index + 1}.${extension}`;

          const cleanName =
            safeFileName(
              rawName
            );

          storagePath =
            buildStoreProductPagePath(
              userId,
              productId,
              index + 1,
              batchId,
              cleanName
            );

          const buffer =
            await fetchStoreUploadBuffer(page, "productFileBytes", "Gambar produk");

          sizeBytes =
            buffer.byteLength;

          const {
            error: uploadError,
          } =
            await supabase.storage
              .from(
                STORE_MEDIA_BUCKETS
                  .productFiles
              )
              .upload(
                storagePath,
                buffer,
                {
                  contentType:
                    page.mimeType ??
                    "image/jpeg",
                  upsert: false,
                }
              );

          if (uploadError) {
            throw uploadError;
          }

          uploadedPaths.push(
            storagePath
          );

          updateUploadProgress(
            20 +
              (
                (index + 1) /
                Math.max(
                  1,
                  pages.length
                )
              ) *
                60
          );
        }

        rpcPages.push({
          storage_path:
            storagePath,
          mime_type:
            page.mimeType ??
            "image/jpeg",
          original_name:
            page.fileName ??
            null,
          size_bytes:
            sizeBytes,
        });
      }

      const {
        data: rpcData,
        error: rpcError,
      } = await supabase.rpc(
        "sync_store_product_image_pages_v1",
        {
          p_product_id:
            productId,
          p_title:
            productInput.title,
          p_product_type:
            productInput.productType,
          p_subject:
            productInput.subject,
          p_class_level:
            productInput.classLevel,
          p_pricing_type:
            productInput.pricingType,
          p_price_amount:
            productInput.priceAmount,
          p_description:
            productInput.description,
          p_thumbnail_path:
            productInput.thumbnailPath,
          p_pages:
            rpcPages,
        }
      );

      if (rpcError) {
        throw rpcError;
      }

      rpcCommitted = true;

      const rpcResult =
        (
          rpcData &&
          typeof rpcData === "object"
        )
          ? rpcData as {
              first_storage_path?:
                unknown;
              stale_storage?:
                unknown;
            }
          : null;

      const firstStoragePath =
        String(
          rpcResult
            ?.first_storage_path ??
          rpcPages[0]
            ?.storage_path ??
          ""
        ).trim();

      if (!firstStoragePath) {
        throw new Error(
          "RPC tidak mengembalikan halaman pertama."
        );
      }

      const staleStorage:
        Array<{
          bucket: string;
          storagePath: string;
        }> = [];

      if (
        Array.isArray(
          rpcResult?.stale_storage
        )
      ) {
        for (
          const item of
          rpcResult.stale_storage
        ) {
          if (
            !item ||
            typeof item !== "object"
          ) {
            continue;
          }

          const record =
            item as {
              bucket?: unknown;
              storage_path?: unknown;
            };

          const bucket =
            String(
              record.bucket ?? ""
            ).trim();

          const storagePath =
            String(
              record.storage_path ?? ""
            ).trim();

          if (
            bucket &&
            storagePath
          ) {
            staleStorage.push({
              bucket,
              storagePath,
            });
          }
        }
      }

      return {
        firstStoragePath,
        staleStorage,
      };
    } catch (error) {
      if (
        !rpcCommitted &&
        uploadedPaths.length > 0
      ) {
        try {
          await supabase.storage
            .from(
              STORE_MEDIA_BUCKETS
                .productFiles
            )
            .remove(
              uploadedPaths
            );
        } catch {
          // cleanup best effort
        }
      }

      throw error;
    }
  }


  async function chooseProductFile() {
    setErrorMessage("");

    if (!productFileKind) {
      setErrorMessage(
        "Pilih jenis file terlebih dahulu."
      );

      return;
    }


    /*
     * GAMBAR
     * Langsung buka galeri HP.
     */
    if (
      productFileKind ===
      "image"
    ) {
      const permission =
        await ImagePicker
          .requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        setErrorMessage(
          "Izin galeri diperlukan untuk memilih gambar produk."
        );

        return;
      }

      try {
        const picked =
          await ImageCropPicker.openPicker({
            mediaType:
              "photo",

            multiple:
              true,

            maxFiles:
              STORE_MEDIA_UPLOAD_LIMITS
                .maxImagePages,

            compressImageQuality:
              0.9,
          });

        const images =
          Array.isArray(picked)
            ? picked
            : [picked];

        const pickedPages =
          images
            .filter(
              image =>
                Boolean(
                  image?.path
                )
            )
            .map(
              (
                image,
                index
              ) => {
                const mimeType =
                  image.mime ??
                  "image/jpeg";

                const extension =
                  mimeType ===
                    "image/png"
                    ? "png"
                    : mimeType ===
                        "image/webp"
                      ? "webp"
                      : "jpg";

                return {
                  uri:
                    image.path,

                  fileName:
                    `halaman-${Date.now()}-${index + 1}.${extension}`,

                  mimeType,
                  sizeBytes:
                    getPickedAssetSizeBytes(
                      image.size
                    ),
                };
              }
            );

        if (
          pickedPages.length === 0
        ) {
          return;
        }

        const combinedPages = [
          ...productPages,
          ...pickedPages,
        ];

        const nextPages =
          combinedPages.slice(
            0,
            STORE_MEDIA_UPLOAD_LIMITS
              .maxImagePages
          );

        if (
          combinedPages.length >
          STORE_MEDIA_UPLOAD_LIMITS
            .maxImagePages
        ) {
          setErrorMessage(
            `Maksimal ${STORE_MEDIA_UPLOAD_LIMITS.maxImagePages} gambar per produk. Gambar selebihnya tidak ditambahkan.`
          );
        }

        setProductPages(
          nextPages
        );

        setProductFile(
          nextPages[0] ??
          null
        );
      }
      catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "";

        if (
          message
            .toLowerCase()
            .includes(
              "cancel"
            )
        ) {
          return;
        }

        setErrorMessage(
          "Gambar produk belum dapat dipilih."
        );
      }

      return;
    }


    /*
     * PDF / OFFICE_PICKER_V1
     *
     * Office hanya dipilih di client.
     * Publish Office tetap diblok sampai
     * converter server-side tersedia.
     */
    const pickerTypes =
      productFileKind === "office"
        ? [
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          ]
        : [
            "application/pdf",
          ];


    const result =
      await DocumentPicker
        .getDocumentAsync({
          type:
            pickerTypes,
          copyToCacheDirectory:
            true,
          multiple:
            false,
        });


    if (
      result.canceled ||
      !result.assets?.length
    ) {
      return;
    }


    const asset =
      result.assets[0];

    const fileName =
      String(
        asset.name ?? ""
      ).trim();

    const extension =
      fileName
        .split(".")
        .pop()
        ?.toLowerCase() ??
      "";

    if (
      productFileKind === "office"
    ) {
      const allowedOfficeExtensions =
        new Set([
          "doc",
          "docx",
        ]);

      if (
        !allowedOfficeExtensions.has(
          extension
        )
      ) {
        setProductFile(null);

        setErrorMessage(
          "File Word harus berformat DOC atau DOCX."
        );

        return;
      }
    } else if (
      extension !== "pdf"
    ) {
      setProductFile(null);

      setErrorMessage(
        "File produk harus berformat PDF."
      );

      return;
    }


    setProductFile({
      uri:
        asset.uri,
      fileName:
        fileName ||
        `produk-${Date.now()}.${extension || "bin"}`,
      mimeType:
        asset.mimeType ??
        (
          productFileKind === "pdf"
            ? "application/pdf"
            : "application/octet-stream"
        ),
      sizeBytes:
        getPickedAssetSizeBytes(
          asset.size
        ),
    });
  }

  async function choosePreviewPdf() {
    setErrorMessage("");

    try {
      const result =
        await DocumentPicker
          .getDocumentAsync({
            type: [
              "application/pdf",
            ],
            copyToCacheDirectory:
              true,
            multiple:
              false,
          });

      if (
        result.canceled ||
        !result.assets ||
        result.assets.length === 0
      ) {
        return;
      }

      const asset =
        result.assets[0];

      const fileName =
        String(
          asset.name ?? ""
        ).trim();

      const extension =
        fileName
          .split(".")
          .pop()
          ?.toLowerCase()
          .replace(
            /[^a-z0-9]/g,
            ""
          ) ?? "";

      if (extension !== "pdf") {
        setPreviewPdfFile(null);

        setErrorMessage(
          "File pratinjau harus berformat PDF."
        );

        return;
      }

      setPreviewPdfFile({
        uri:
          asset.uri,

        fileName:
          fileName ||
          `preview-${Date.now()}.pdf`,

        mimeType:
          asset.mimeType ??
          "application/pdf",
        sizeBytes:
          getPickedAssetSizeBytes(
            asset.size
          ),
      });
    }
    catch (error) {
      console.warn(
        "Pilih PDF pratinjau gagal:",
        error
      );

      setErrorMessage(
        "PDF pratinjau belum dapat dipilih."
      );
    }
  }


  async function uploadWordWithPreview(
    userId: string,
    productId: string,
    wordAsset: PickedAsset,
    previewAsset: PickedAsset
  ): Promise<{
    pdfPath: string;
    originalPath: string;
    originalFileName: string;
    originalMimeType: string;
    originalSizeBytes: number;
    previewSizeBytes: number;
  }> {
    const wordExtension =
      getExtension(
        wordAsset,
        ""
      );

    if (
      wordExtension !== "doc" &&
      wordExtension !== "docx"
    ) {
      throw new Error(
        "File Word harus berformat DOC atau DOCX."
      );
    }

    const previewExtension =
      getExtension(
        previewAsset,
        ""
      );

    if (
      previewExtension !== "pdf"
    ) {
      throw new Error(
        "File pratinjau harus berformat PDF."
      );
    }


    const batchId =
      Date.now();

    const originalFileName =
      wordAsset.fileName ??
      `document-${batchId}.${wordExtension}`;

    const cleanOriginalName =
      safeFileName(
        originalFileName
      );

    const previewFileName =
      previewAsset.fileName ??
      `preview-${batchId}.pdf`;

    const cleanPreviewName =
      safeFileName(
        previewFileName
      );


    const originalPath =
      buildStoreProductOriginalPath(
        userId,
        productId,
        cleanOriginalName,
        batchId
      );

    const pdfPath =
      buildStoreProductFilePath(
        userId,
        productId,
        cleanPreviewName,
        batchId
      );


    const originalMimeType =
      wordExtension === "docx"
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : "application/msword";


    const wordBuffer =
      await fetchStoreUploadBuffer(wordAsset, "productOriginalBytes", "File Word");

    if (
      wordBuffer.byteLength <= 0
    ) {
      throw new Error(
        "File Word kosong atau tidak dapat dibaca."
      );
    }


    const previewBuffer =
      await fetchStoreUploadBuffer(previewAsset, "productFileBytes", "PDF pratinjau");

    if (
      previewBuffer.byteLength <= 0
    ) {
      throw new Error(
        "PDF pratinjau kosong atau tidak dapat dibaca."
      );
    }


    let originalUploaded =
      false;

    try {
      const {
        error:
          originalUploadError,
      } =
        await supabase.storage
          .from(
            STORE_MEDIA_BUCKETS.productOriginals
          )
          .upload(
            originalPath,
            wordBuffer,
            {
              contentType:
                originalMimeType,

              upsert:
                false,
            }
          );

      if (
        originalUploadError
      ) {
        throw originalUploadError;
      }

      originalUploaded =
        true;

      updateUploadProgress(45);


      const {
        error:
          previewUploadError,
      } =
        await supabase.storage
          .from(
            STORE_MEDIA_BUCKETS.productFiles
          )
          .upload(
            pdfPath,
            previewBuffer,
            {
              contentType:
                "application/pdf",

              upsert:
                false,
            }
          );

      if (
        previewUploadError
      ) {
        throw previewUploadError;
      }

      updateUploadProgress(80);


      return {
        pdfPath,
        originalPath,
        originalFileName,
        originalMimeType,
        originalSizeBytes:
          wordBuffer.byteLength,
        previewSizeBytes:
          previewBuffer.byteLength,
      };
    }
    catch (error) {
      if (
        originalUploaded
      ) {
        await supabase.storage
          .from(
            "store-product-originals"
          )
          .remove([
            originalPath,
          ]);
      }

      throw error;
    }
  }

  async function handleUpload() {
    if (submitting) return;

    setMessage("");
    setErrorMessage("");

    const cleanTitle = title.trim();
    const cleanSubject =
      (
        subject === "Lainnya"
          ? customSubject
          : subject
      ).trim();
    const cleanDescription =
      description.trim();

    if (cleanTitle.length < 3) {
      setErrorMessage(
        "Judul minimal 3 karakter."
      );
      return;
    }

    if (cleanSubject.length < 2) {
      setErrorMessage(
        "Mata pelajaran belum diisi."
      );
      return;
    }

    if (
      !editProductId &&
      !productFile
    ) {
      setErrorMessage(
        "Pilih file produk terlebih dahulu."
      );
      return;
    }

    if (
      productFileKind === "image" &&
      productPages.length >
        STORE_MEDIA_UPLOAD_LIMITS
          .maxImagePages
    ) {
      setErrorMessage(
        `Produk gambar maksimal ${STORE_MEDIA_UPLOAD_LIMITS.maxImagePages} halaman.`
      );
      return;
    }

    /*
     * WORD_MANUAL_PREVIEW_GUARD_V1
     *
     * Produk Word hanya menerima DOC/DOCX.
     * Word asli digunakan untuk download,
     * sedangkan PDF pratinjau digunakan untuk viewer.
     */
    if (
      productFileKind === "office" &&
      productFile
    ) {
      const officeExtension =
        getExtension(
          productFile,
          ""
        );

      if (
        officeExtension !== "doc" &&
        officeExtension !== "docx"
      ) {
        setErrorMessage(
          "File Word harus berformat DOC atau DOCX."
        );
        return;
      }
    }

    if (
      editProductId &&
      productFileKind ===
        "image" &&
      productPages.length ===
        0
    ) {
      setErrorMessage(
        "Produk gambar minimal memiliki 1 halaman."
      );
      return;
    }

    const priceAmount =
      pricingType === "paid"
        ? Number(
            price.replace(/[^0-9]/g, "")
          )
        : null;

    if (
      pricingType === "paid" &&
      (!priceAmount || priceAmount <= 0)
    ) {
      setErrorMessage(
        "Harga produk berbayar belum benar."
      );
      return;
    }

    if (
      productFileKind === "office" &&
      !productFile
    ) {
      setErrorMessage(
        "Pilih file Word terlebih dahulu."
      );

      return;
    }

    if (
      productFileKind === "office" &&
      !previewPdfFile
    ) {
      setErrorMessage(
        "Pilih PDF pratinjau terlebih dahulu."
      );

      return;
    }

    setSubmitting(true);
    setUploadProgress(0);

    let productId: string | null = null;
    let thumbnailPath: string | null = null;
    let filePath: string | null = null;

    const createdMediaAssetIds:
      string[] = [];

    const stagedMediaChanges:
      StagedStoreProductMediaChange[] = [];

    let editMediaChangesCommitted =
      false;

    let originalFilePath:
      string | null = null;

    let originalFileName:
      string | null = null;

    let originalMimeType:
      string | null = null;

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      const user = session?.user;

      if (!user) {
        throw new Error(
          "Sesi login tidak ditemukan."
        );
      }

      updateUploadProgress(5);

      if (editProductId) {
        const {
          data: existing,
          error: existingError,
        } = await supabase
          .from("store_products")
          .select(
            "id,creator_user_id,thumbnail_path,file_path,original_file_path,original_file_name,original_mime_type"
          )
          .eq("id", editProductId)
          .eq("creator_user_id", user.id)
          .single();

        if (existingError) {
          throw existingError;
        }

        updateUploadProgress(10);

        let nextThumbnailPath =
          existing.thumbnail_path ?? null;

        let nextFilePath =
          existing.file_path ?? null;

        let nextOriginalFilePath =
          existing.original_file_path ??
          null;

        let nextOriginalFileName =
          existing.original_file_name ??
          null;

        let nextOriginalMimeType =
          existing.original_mime_type ??
          null;

        if (thumbnail) {
          const extension =
            getExtension(
              thumbnail,
              "jpg"
            );

          thumbnailPath =
            buildStoreThumbnailPath(
              user.id,
              editProductId,
              extension
            );

          const thumbnailBuffer =
            await fetchStoreUploadBuffer(thumbnail, "thumbnailBytes", "Cover produk");

          const {
            error: thumbnailError,
          } = await supabase.storage
            .from(STORE_MEDIA_BUCKETS.thumbnails)
            .upload(
              thumbnailPath,
              thumbnailBuffer,
              {
                contentType:
                  thumbnail.mimeType ??
                  "image/jpeg",
                upsert: false,
              }
            );

          if (thumbnailError) {
            throw thumbnailError;
          }

        updateUploadProgress(20);

          const stagedThumbnailChange =
            await stageStoreProductMediaReplacement({
              ownerUserId:
                user.id,
              productId:
                editProductId,
              bucket:
                STORE_MEDIA_BUCKETS.thumbnails,
              storagePath:
                thumbnailPath,
              mediaKind:
                "image",
              variant:
                "thumbnail",
              mimeType:
                thumbnail.mimeType ??
                "image/jpeg",
              sizeBytes:
                thumbnailBuffer.byteLength,
              visibility:
                "public_preview",
              role:
                "thumbnail",
              sortOrder:
                0,
              metadata: {
                source:
                  "product_edit",
              },
            });

          stagedMediaChanges.push(
            stagedThumbnailChange
          );

          nextThumbnailPath =
            thumbnailPath;
        }

        if (
          productFile &&
          productFileKind !== "image"
        ) {
          if (
            productFileKind ===
              "office"
          ) {
            if (!previewPdfFile) {
              throw new Error(
                "Pilih PDF pratinjau terlebih dahulu."
              );
            }

            const converted =
              await uploadWordWithPreview(
                user.id,
                editProductId,
                productFile,
                previewPdfFile
              );

            filePath =
              converted.pdfPath;

            originalFilePath =
              converted.originalPath;

            originalFileName =
              converted.originalFileName;

            originalMimeType =
              converted.originalMimeType;

            nextOriginalFilePath =
              originalFilePath;

            nextOriginalFileName =
              originalFileName;

            nextOriginalMimeType =
              originalMimeType;

            const stagedOriginalChange =
              await stageStoreProductMediaReplacement({
                ownerUserId:
                  user.id,
                productId:
                  editProductId,
                bucket:
                  STORE_MEDIA_BUCKETS.productOriginals,
                storagePath:
                  converted.originalPath,
                mediaKind:
                  "attachment",
                variant:
                  "original",
                mimeType:
                  converted.originalMimeType,
                sizeBytes:
                  converted.originalSizeBytes,
                visibility:
                  "private",
                role:
                  "original",
                sortOrder:
                  0,
                metadata: {
                  source:
                    "product_edit",
                  original_file_name:
                    converted.originalFileName,
                },
              });

            stagedMediaChanges.push(
              stagedOriginalChange
            );

            const stagedPreviewChange =
              await stageStoreProductMediaReplacement({
                ownerUserId:
                  user.id,
                productId:
                  editProductId,
                bucket:
                  STORE_MEDIA_BUCKETS.productFiles,
                storagePath:
                  converted.pdfPath,
                mediaKind:
                  "pdf",
                variant:
                  "preview",
                mimeType:
                  "application/pdf",
                sizeBytes:
                  converted.previewSizeBytes,
                visibility:
                  "private",
                role:
                  "preview",
                sortOrder:
                  0,
                metadata: {
                  source:
                    "product_edit",
                },
              });

            stagedMediaChanges.push(
              stagedPreviewChange
            );
          } else {
            nextOriginalFilePath =
              null;

            nextOriginalFileName =
              null;

            nextOriginalMimeType =
              null;
            const rawFileName =
              productFile.fileName ??
              `produk-${Date.now()}`;

            const cleanFileName =
              safeFileName(
                rawFileName
              );

            filePath =
              buildStoreProductFilePath(
                user.id,
                editProductId,
                cleanFileName
              );

            const fileBuffer =
              await fetchStoreUploadBuffer(productFile, "productFileBytes", "File PDF");

            const {
              error: fileError,
            } =
              await supabase.storage
                .from(
                  STORE_MEDIA_BUCKETS.productFiles
                )
                .upload(
                  filePath,
                  fileBuffer,
                  {
                    contentType:
                      productFile.mimeType ??
                      "application/octet-stream",
                    upsert:
                      false,
                  }
                );

            if (fileError) {
              throw fileError;
            }

            const stagedPdfChange =
              await stageStoreProductMediaReplacement({
                ownerUserId:
                  user.id,
                productId:
                  editProductId,
                bucket:
                  STORE_MEDIA_BUCKETS.productFiles,
                storagePath:
                  filePath,
                mediaKind:
                  "pdf",
                variant:
                  "original",
                mimeType:
                  productFile.mimeType ??
                  "application/octet-stream",
                sizeBytes:
                  fileBuffer.byteLength,
                visibility:
                  "private",
                role:
                  "original",
                sortOrder:
                  0,
                metadata: {
                  source:
                    "product_edit",
                },
              });

            stagedMediaChanges.push(
              stagedPdfChange
            );

            const stagedPreviewRemoval =
              await stageStoreProductMediaRemoval(
                editProductId,
                "preview",
                0
              );

            if (stagedPreviewRemoval) {
              stagedMediaChanges.push(
                stagedPreviewRemoval
              );
            }

        updateUploadProgress(80);
          }

          const {
            data: previousPageMediaLinks,
            error: previousPageMediaLinksError,
          } = await supabase
            .from("store_product_media")
            .select("sort_order")
            .eq(
              "product_id",
              editProductId
            )
            .eq(
              "role",
              "page"
            );

          if (previousPageMediaLinksError) {
            throw previousPageMediaLinksError;
          }

          const previousPageSortOrders =
            [
              ...new Set(
                (
                  previousPageMediaLinks ??
                  []
                )
                  .map(row =>
                    Number(
                      row.sort_order
                    )
                  )
                  .filter(
                    value =>
                      Number.isFinite(
                        value
                      ) &&
                      value >= 0
                  )
                  .map(value =>
                    Math.trunc(
                      value
                    )
                  )
              ),
            ];

          for (
            const pageSortOrder of
            previousPageSortOrders
          ) {
            const stagedPageRemoval =
              await stageStoreProductMediaRemoval(
                editProductId,
                "page",
                pageSortOrder
              );

            if (stagedPageRemoval) {
              stagedMediaChanges.push(
                stagedPageRemoval
              );
            }
          }

          nextFilePath =
            filePath;
        }

        let editImageSync:
          {
            firstStoragePath: string;
            staleStorage: Array<{
              bucket: string;
              storagePath: string;
            }>;
          } |
          null = null;

        let updatedId:
          string | null = null;

        if (
          productFileKind ===
            "image"
        ) {
          if (
            productPages.length === 0
          ) {
            throw new Error(
              "Produk gambar minimal memiliki 1 halaman."
            );
          }

          editImageSync =
            await syncEditedImagePages(
              user.id,
              existing.id,
              productPages,
              {
                title:
                  cleanTitle,
                productType,
                subject:
                  cleanSubject,
                classLevel,
                pricingType,
                priceAmount,
                description:
                  cleanDescription,
                thumbnailPath:
                  nextThumbnailPath,
              }
            );

          updateUploadProgress(85);

          nextOriginalFilePath =
            null;
          nextOriginalFileName =
            null;
          nextOriginalMimeType =
            null;

          nextFilePath =
            editImageSync
              .firstStoragePath;

          updatedId =
            existing.id;
        } else {
          const {
            data: updated,
            error: updateError,
          } = await supabase
            .from("store_products")
            .update({
              title:
                cleanTitle,
              product_type:
                productType,
              subject:
                cleanSubject,
              class_level:
                classLevel,
              pricing_type:
                pricingType,
              price_amount:
                priceAmount,
              original_price_amount:
                null,
              description:
                cleanDescription,
              thumbnail_path:
                nextThumbnailPath,
              file_path:
                nextFilePath,
              original_file_path:
                nextOriginalFilePath,
              original_file_name:
                nextOriginalFileName,
              original_mime_type:
                nextOriginalMimeType,
              status:
                "published",
            })
            .eq(
              "id",
              editProductId
            )
            .eq(
              "creator_user_id",
              user.id
            )
            .select("id")
            .single();

          if (updateError) {
            throw updateError;
          }

          if (!updated?.id) {
            throw new Error(
              "Produk tidak berhasil diperbarui."
            );
          }

          updatedId =
            updated.id;
        }

        if (!updatedId) {
          throw new Error(
            "Produk tidak berhasil diperbarui."
          );
        }

        editMediaChangesCommitted =
          true;

        for (
          const stagedChange of
          stagedMediaChanges
        ) {
          try {
            await finalizeStagedStoreProductMediaChange(
              stagedChange
            );
          } catch (
            finalizeMediaError
          ) {
            console.warn(
              "Finalisasi metadata media lama belum selesai:",
              finalizeMediaError
            );
          }
        }

        /*
         * NON_IMAGE_STALE_PAGES_CLEANUP_V1
         *
         * Jika produk image berubah menjadi PDF/Word,
         * store_product_pages lama tidak lagi menjadi
         * source of truth.
         *
         * Metadata dihapus hanya SETELAH update produk
         * berhasil. Cleanup Storage dilakukan setelah
         * delete metadata berhasil.
         */
        if (
          productFileKind !==
            "image"
        ) {
          const {
            data: stalePageRows,
            error:
              stalePageRowsError,
          } =
            await supabase
              .from(
                "store_product_pages"
              )
              .select(
                "storage_path"
              )
              .eq(
                "product_id",
                editProductId
              );

          if (stalePageRowsError) {
            console.warn(
              "Halaman legacy belum dapat diaudit:",
              stalePageRowsError
            );
          } else if (
            (stalePageRows ?? [])
              .length > 0
          ) {
            const stalePagePaths =
              Array.from(
                new Set(
                  (
                    stalePageRows ??
                    []
                  )
                    .map(
                      row =>
                        String(
                          row.storage_path ??
                            ""
                        ).trim()
                    )
                    .filter(
                      path =>
                        Boolean(path) &&
                        path !==
                          nextFilePath
                    )
                )
              );

            const {
              error:
                deletePageRowsError,
            } =
              await supabase
                .from(
                  "store_product_pages"
                )
                .delete()
                .eq(
                  "product_id",
                  editProductId
                );

            if (
              deletePageRowsError
            ) {
              console.warn(
                "Metadata halaman legacy belum terhapus:",
                deletePageRowsError
              );
            } else if (
              stalePagePaths.length >
              0
            ) {
              const {
                error:
                  staleStorageError,
              } =
                await supabase.storage
                  .from(
                    "store-product-files"
                  )
                  .remove(
                    stalePagePaths
                  );

              if (
                staleStorageError
              ) {
                console.warn(
                  "File halaman legacy belum terhapus dari Storage:",
                  staleStorageError
                );
              }
            }
          }
        }

        /*
         * Cleanup hanya object yang RPC
         * nyatakan benar-benar stale.
         */
        if (editImageSync) {
          const staleProductFiles =
            Array.from(
              new Set(
                editImageSync
                  .staleStorage
                  .filter(
                    item =>
                      item.bucket ===
                      STORE_MEDIA_BUCKETS
                        .productFiles
                  )
                  .map(
                    item =>
                      item.storagePath
                  )
              )
            );

          if (
            staleProductFiles.length > 0
          ) {
            const {
              error:
                cleanupPagesError,
            } =
              await supabase.storage
                .from(
                  STORE_MEDIA_BUCKETS
                    .productFiles
                )
                .remove(
                  staleProductFiles
                );

            if (cleanupPagesError) {
              console.warn(
                "Storage halaman stale belum terhapus:",
                cleanupPagesError
              );
            }
          }

          const staleOriginalFiles =
            Array.from(
              new Set(
                editImageSync
                  .staleStorage
                  .filter(
                    item =>
                      item.bucket ===
                      STORE_MEDIA_BUCKETS
                        .productOriginals
                  )
                  .map(
                    item =>
                      item.storagePath
                  )
              )
            );

          if (
            staleOriginalFiles.length > 0
          ) {
            const {
              error:
                cleanupOriginalError,
            } =
              await supabase.storage
                .from(
                  STORE_MEDIA_BUCKETS
                    .productOriginals
                )
                .remove(
                  staleOriginalFiles
                );

            if (cleanupOriginalError) {
              console.warn(
                "Storage original stale belum terhapus:",
                cleanupOriginalError
              );
            }
          }
        }

        if (
          thumbnail &&
          existing.thumbnail_path &&
          existing.thumbnail_path !==
            nextThumbnailPath
        ) {
          const {
            error: cleanupThumbnailError,
          } = await supabase.storage
            .from("store-thumbnails")
            .remove([
              existing.thumbnail_path,
            ]);

          if (cleanupThumbnailError) {
            console.warn(
              "Thumbnail lama belum terhapus:",
              cleanupThumbnailError
            );
          }
        }

        if (
          productFile &&
          !(
            productFileKind ===
              "image" &&
            productPages.length >
              0
          ) &&
          existing.file_path &&
          existing.file_path !==
            nextFilePath
        ) {
          const {
            error: cleanupFileError,
          } = await supabase.storage
            .from("store-product-files")
            .remove([
              existing.file_path,
            ]);

          if (cleanupFileError) {
            console.warn(
              "File lama belum terhapus:",
              cleanupFileError
            );
          }
        }

        if (
          productFileKind !==
            "image" &&
          existing.original_file_path &&
          existing.original_file_path !==
            nextOriginalFilePath
        ) {
          const {
            error:
              cleanupOriginalFileError,
          } =
            await supabase.storage
              .from(
                "store-product-originals"
              )
              .remove([
                existing.original_file_path,
              ]);

          if (
            cleanupOriginalFileError
          ) {
            console.warn(
              "File Word lama belum terhapus:",
              cleanupOriginalFileError
            );
          }
        }

        updateUploadProgress(100);

        setMessage(
          "Perubahan produk berhasil disimpan."
        );

        onUploaded();
        return;
      }

      if (!productFile) {
        throw new Error(
          "File produk belum dipilih."
        );
      }

      const {
        data: profile,
      } = await supabase
        .from("app_profiles")
        .select("full_name")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      const creatorName =
        profile?.full_name?.trim() ||
        user.email
          ?.split("@")[0]
          ?.toUpperCase() ||
        "KREATOR";

      const {
        data: created,
        error: createError,
      } = await supabase
        .from("store_products")
        .insert({
          creator_user_id: user.id,
          creator_name: creatorName,
          title: cleanTitle,
          product_type: productType,
          subject: cleanSubject,
          class_level: classLevel,
          pricing_type: pricingType,
          price_amount: priceAmount,
          original_price_amount: null,
          description:
            cleanDescription,
          status: "draft",
        })
        .select("id")
        .single();

      if (createError) {
        throw createError;
      }

      productId = created.id;

      updateUploadProgress(10);

      if (thumbnail) {
        const extension =
          getExtension(
            thumbnail,
            "jpg"
          );

        thumbnailPath =
          buildStoreThumbnailPath(
            user.id,
            created.id,
            extension
          );

        const thumbnailBuffer =
          await fetchStoreUploadBuffer(thumbnail, "thumbnailBytes", "Cover produk");

        const {
          error: thumbnailError,
        } = await supabase.storage
          .from(STORE_MEDIA_BUCKETS.thumbnails)
          .upload(
            thumbnailPath,
            thumbnailBuffer,
            {
              contentType:
                thumbnail.mimeType ??
                "image/jpeg",
              upsert: false,
            }
          );

        if (thumbnailError) {
          throw thumbnailError;
        }

        const thumbnailMediaAssetId =
          await registerStoreProductMediaAsset({
            ownerUserId:
              user.id,
            productId:
              created.id,
            bucket:
              STORE_MEDIA_BUCKETS.thumbnails,
            storagePath:
              thumbnailPath,
            mediaKind:
              "image",
            variant:
              "thumbnail",
            mimeType:
              thumbnail.mimeType ??
              "image/jpeg",
            sizeBytes:
              thumbnailBuffer.byteLength,
            visibility:
              "public_preview",
            role:
              "thumbnail",
            sortOrder:
              0,
            metadata: {
              source:
                "product_upload",
            },
          });

        createdMediaAssetIds.push(
          thumbnailMediaAssetId
        );

        updateUploadProgress(20);
      }

      if (
        productFileKind ===
          "office"
      ) {
        if (!previewPdfFile) {
          throw new Error(
            "Pilih PDF pratinjau terlebih dahulu."
          );
        }

        const converted =
          await uploadWordWithPreview(
            user.id,
            created.id,
            productFile,
            previewPdfFile
          );

        filePath =
          converted.pdfPath;

        originalFilePath =
          converted.originalPath;

        originalFileName =
          converted.originalFileName;

        originalMimeType =
          converted.originalMimeType;

        const originalMediaAssetId =
          await registerStoreProductMediaAsset({
            ownerUserId:
              user.id,
            productId:
              created.id,
            bucket:
              STORE_MEDIA_BUCKETS.productOriginals,
            storagePath:
              converted.originalPath,
            mediaKind:
              "attachment",
            variant:
              "original",
            mimeType:
              converted.originalMimeType,
            sizeBytes:
              converted.originalSizeBytes,
            visibility:
              "private",
            role:
              "original",
            sortOrder:
              0,
            metadata: {
              source:
                "product_upload",
            },
          });

        createdMediaAssetIds.push(
          originalMediaAssetId
        );

        const previewMediaAssetId =
          await registerStoreProductMediaAsset({
            ownerUserId:
              user.id,
            productId:
              created.id,
            bucket:
              STORE_MEDIA_BUCKETS.productFiles,
            storagePath:
              converted.pdfPath,
            mediaKind:
              "pdf",
            variant:
              "preview",
            mimeType:
              "application/pdf",
            sizeBytes:
              converted.previewSizeBytes,
            visibility:
              "private",
            role:
              "preview",
            sortOrder:
              0,
            metadata: {
              source:
                "product_upload",
            },
          });

        createdMediaAssetIds.push(
          previewMediaAssetId
        );
      } else {
        const rawFileName =
          productFile.fileName ??
          `produk-${Date.now()}`;

        const cleanFileName =
          safeFileName(
            rawFileName
          );

        filePath =
          buildStoreProductFilePath(
            user.id,
            created.id,
            cleanFileName
          );

        const fileBuffer =
          await fetchStoreUploadBuffer(productFile, "productFileBytes", productFileKind === "image" ? "Gambar produk" : "File PDF");

        const {
          error: fileError,
        } =
          await supabase.storage
            .from(
              STORE_MEDIA_BUCKETS.productFiles
            )
            .upload(
              filePath,
              fileBuffer,
              {
                contentType:
                  productFile.mimeType ??
                  "application/octet-stream",
                upsert:
                  false,
              }
            );

        if (fileError) {
          throw fileError;
        }

        const primaryMediaAssetId =
          await registerStoreProductMediaAsset({
            ownerUserId:
              user.id,
            productId:
              created.id,
            bucket:
              STORE_MEDIA_BUCKETS.productFiles,
            storagePath:
              filePath,
            mediaKind:
              productFileKind === "image"
                ? "image"
                : "pdf",
            variant:
              productFileKind === "image"
                ? "page"
                : "original",
            mimeType:
              productFile.mimeType ??
              "application/octet-stream",
            sizeBytes:
              fileBuffer.byteLength,
            visibility:
              "private",
            role:
              productFileKind === "image"
                ? "page"
                : "original",
            sortOrder:
              productFileKind === "image"
                ? 1
                : 0,
            metadata: {
              source:
                "product_upload",
            },
          });

        createdMediaAssetIds.push(
          primaryMediaAssetId
        );

        updateUploadProgress(
          productFileKind === "image"
            ? 40
            : 80
        );
      }

      if (
        productFileKind ===
          "image" &&
        productPages.length >
          0 &&
        filePath
      ) {
        await syncProductImagePages(
          user.id,
          created.id,
          filePath,
          productPages,
          createdMediaAssetIds
        );

        updateUploadProgress(85);
      }


      const {
        error: publishError,
      } = await supabase
        .from("store_products")
        .update({
          thumbnail_path:
            thumbnailPath,
          file_path: filePath,
          original_file_path:
            originalFilePath,
          original_file_name:
            originalFileName,
          original_mime_type:
            originalMimeType,
          status: "published",
        })
        .eq("id", productId);

      if (publishError) {
        throw publishError;
      }

      updateUploadProgress(100);

      setMessage(
        "Produk berhasil dipublikasikan."
      );

      onUploaded();
    } catch (error) {
      console.error(
        editProductId
          ? "Edit produk gagal:"
          : "Upload produk gagal:",
        error
      );

      if (
        editProductId &&
        !editMediaChangesCommitted &&
        stagedMediaChanges.length > 0
      ) {
        for (
          const stagedChange of
          [...stagedMediaChanges].reverse()
        ) {
          try {
            await rollbackStagedStoreProductMediaChange(
              stagedChange
            );
          } catch (
            stagedRollbackError
          ) {
            console.warn(
              "Rollback edit metadata media gagal:",
              stagedRollbackError
            );
          }
        }
      }

      const shouldCleanupUploadedStorage =
        !editProductId ||
        !editMediaChangesCommitted;

      if (
        shouldCleanupUploadedStorage &&
        thumbnailPath
      ) {
        await supabase.storage
          .from("store-thumbnails")
          .remove([thumbnailPath]);
      }

      if (
        shouldCleanupUploadedStorage &&
        filePath
      ) {
        await supabase.storage
          .from("store-product-files")
          .remove([filePath]);
      }

      if (
        shouldCleanupUploadedStorage &&
        originalFilePath
      ) {
        await supabase.storage
          .from(
            "store-product-originals"
          )
          .remove([
            originalFilePath,
          ]);
      }

      if (
        productId &&
        createdMediaAssetIds.length > 0
      ) {
        try {
          await rollbackStoreProductMediaAssets(
            productId,
            createdMediaAssetIds
          );
        } catch (
          mediaRollbackError
        ) {
          console.warn(
            "Rollback metadata media gagal:",
            mediaRollbackError
          );
        }
      }

      if (productId) {
        await supabase
          .from("store_products")
          .delete()
          .eq("id", productId);
      }

      setErrorMessage(
        error instanceof Error
          ? error.message
          : editProductId
            ? "Edit produk gagal."
            : "Upload produk gagal."
      );
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  }

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={["top", "bottom"]}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
      >
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={onClose}
            hitSlop={8}
          >
            <ArrowLeft
              size={20}
              color="#0F172A"
            />
          </Pressable>

          <View style={styles.headerText}>
            <Text style={styles.title}>
              {editProductId
                ? "Edit Produk"
                : "Upload Produk"}
            </Text>

            <Text style={styles.subtitle}>
              {editProductId
                ? "Perbarui informasi produk Anda"
                : "Publikasikan media pembelajaran Anda"}
            </Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={
            styles.content
          }
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.field}>
            <Text style={styles.label}>
              Judul Produk
            </Text>

            <TextInput
              value={title}
              onChangeText={setTitle}
              style={styles.input}
              placeholder="Contoh: LKPD PAI Kelas 6"
              placeholderTextColor="#94A3B8"
              maxLength={180}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>
              Jenis Produk
            </Text>

            <Pressable
              style={
                styles.fileTypeSelector
              }
              onPress={() => {
                setShowProductTypeMenu(
                  value => !value
                );

                setShowSubjectMenu(false);
                setShowClassLevelMenu(false);
                setShowProductFileKindMenu(false);
              }}
            >
              <Text
                style={
                  styles.fileTypeValue
                }
              >
                {productType}
              </Text>

              {showProductTypeMenu ? (
              <ChevronUp
                size={18}
                strokeWidth={1.8}
                color="#64748B"
              />
            ) : (
              <ChevronDown
                size={18}
                strokeWidth={1.8}
                color="#64748B"
              />
            )}
            </Pressable>

            {showProductTypeMenu ? (
              <View
                style={
                  styles.fileTypeMenu
                }
              >
                {PRODUCT_TYPES.map(
                  (item, index) => (
                    <View key={item}>
                      {index > 0 ? (
                        <View
                          style={
                            styles.dropdownDivider
                          }
                        />
                      ) : null}

                      <Pressable
                        style={
                          styles.dropdownOption
                        }
                        onPress={() => {
                          setProductType(
                            item
                          );

                          setShowProductTypeMenu(
                            false
                          );
                        }}
                      >
                        <Text
                          style={
                            styles.dropdownOptionText
                          }
                        >
                          {item}
                        </Text>
                      </Pressable>
                    </View>
                  )
                )}
              </View>
            ) : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>
              Mata Pelajaran
            </Text>

            <Pressable
              style={
                styles.fileTypeSelector
              }
              onPress={() => {
                setShowSubjectMenu(
                  value => !value
                );

                setShowProductTypeMenu(false);
                setShowClassLevelMenu(false);
                setShowProductFileKindMenu(false);
              }}
            >
              <Text
                style={[
                  styles.fileTypeValue,

                  !subject &&
                    styles.fileTypePlaceholder,
                ]}
                numberOfLines={1}
              >
                {subject ||
                  "Pilih mata pelajaran"}
              </Text>

              {showSubjectMenu ? (
              <ChevronUp
                size={18}
                strokeWidth={1.8}
                color="#64748B"
              />
            ) : (
              <ChevronDown
                size={18}
                strokeWidth={1.8}
                color="#64748B"
              />
            )}
            </Pressable>

            {showSubjectMenu ? (
              <View
                style={
                  styles.fileTypeMenu
                }
              >
                {SUBJECTS.map(
                  (item, index) => (
                    <View key={item}>
                      {index > 0 ? (
                        <View
                          style={
                            styles.dropdownDivider
                          }
                        />
                      ) : null}

                      <Pressable
                        style={
                          styles.dropdownOption
                        }
                        onPress={() => {
                          setSubject(item);

                          if (
                            item !== "Lainnya"
                          ) {
                            setCustomSubject("");
                          }

                          setShowSubjectMenu(
                            false
                          );
                        }}
                      >
                        <Text
                          style={
                            styles.dropdownOptionText
                          }
                        >
                          {item}
                        </Text>
                      </Pressable>
                    </View>
                  )
                )}
              </View>
            ) : null}

            {subject === "Lainnya" ? (
              <TextInput
                value={customSubject}
                onChangeText={
                  setCustomSubject
                }
                style={[
                  styles.input,
                  styles.customSubjectInput,
                ]}
                placeholder="Contoh: Geografi, Kimia, Fisika"
                placeholderTextColor="#94A3B8"
                maxLength={120}
              />
            ) : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>
              Kelas
            </Text>

            <Pressable
              style={
                styles.fileTypeSelector
              }
              onPress={() => {
                setShowClassLevelMenu(
                  value => !value
                );

                setShowProductTypeMenu(false);
                setShowSubjectMenu(false);
                setShowProductFileKindMenu(false);
              }}
            >
              <Text
                style={
                  styles.fileTypeValue
                }
              >
                {classLevel}
              </Text>

              {showClassLevelMenu ? (
              <ChevronUp
                size={18}
                strokeWidth={1.8}
                color="#64748B"
              />
            ) : (
              <ChevronDown
                size={18}
                strokeWidth={1.8}
                color="#64748B"
              />
            )}
            </Pressable>

            {showClassLevelMenu ? (
              <View
                style={
                  styles.fileTypeMenu
                }
              >
                {CLASS_LEVELS.map(
                  (item, index) => (
                    <View key={item}>
                      {index > 0 ? (
                        <View
                          style={
                            styles.dropdownDivider
                          }
                        />
                      ) : null}

                      <Pressable
                        style={
                          styles.dropdownOption
                        }
                        onPress={() => {
                          setClassLevel(item);

                          setShowClassLevelMenu(
                            false
                          );
                        }}
                      >
                        <Text
                          style={
                            styles.dropdownOptionText
                          }
                        >
                          {item}
                        </Text>
                      </Pressable>
                    </View>
                  )
                )}
              </View>
            ) : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>
              Harga
            </Text>

            <Pressable
              style={
                styles.fileTypeSelector
              }
              onPress={() => {
                setShowPricingTypeMenu(
                  value => !value
                );

                setShowProductTypeMenu(false);
                setShowSubjectMenu(false);
                setShowClassLevelMenu(false);
                setShowProductFileKindMenu(false);
              }}
            >
              <Text
                style={
                  styles.fileTypeValue
                }
              >
                {pricingType === "free"
                  ? "Gratis"
                  : "Berbayar"}
              </Text>

              {showPricingTypeMenu ? (
              <ChevronUp
                size={18}
                strokeWidth={1.8}
                color="#64748B"
              />
            ) : (
              <ChevronDown
                size={18}
                strokeWidth={1.8}
                color="#64748B"
              />
            )}
            </Pressable>

            {showPricingTypeMenu ? (
              <View
                style={
                  styles.fileTypeMenu
                }
              >
                <Pressable
                  style={
                    styles.dropdownOption
                  }
                  onPress={() => {
                    setPricingType("free");
                    setPrice("");
                    setShowPricingTypeMenu(
                      false
                    );
                  }}
                >
                  <Text
                    style={
                      styles.dropdownOptionText
                    }
                  >
                    Gratis
                  </Text>
                </Pressable>

                <View
                  style={
                    styles.dropdownDivider
                  }
                />

                <Pressable
                  style={
                    styles.dropdownOption
                  }
                  onPress={() => {
                    setPricingType("paid");

                    setShowPricingTypeMenu(
                      false
                    );
                  }}
                >
                  <Text
                    style={
                      styles.dropdownOptionText
                    }
                  >
                    Berbayar
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {pricingType === "paid" ? (
              <TextInput
                value={price}
                onChangeText={setPrice}
                style={[
                  styles.input,
                  styles.priceInput,
                  styles.compactPriceInput,
                ]}
                placeholder="Contoh: 15000"
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
              />
            ) : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>
              Cover Produk
            </Text>

            <Pressable
              style={
                styles.thumbnailPickerCard
              }
              onPress={chooseThumbnail}
            >
              <View
                style={
                  styles.thumbnailPreview
                }
              >
                {thumbnail ? (
                  <Image
                    source={{
                      uri: thumbnail.uri,
                    }}
                    style={
                      styles.thumbnailPreviewImage
                    }
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={
                      styles.thumbnailPlaceholder
                    }
                  >
                    <ImageIcon
                      size={24}
                      color="#64748B"
                      strokeWidth={1.6}
                    />

                    <Text
                      style={
                        styles.thumbnailRatio
                      }
                    >
                      1:1
                    </Text>
                  </View>
                )}
              </View>

              <View
                style={
                  styles.thumbnailPickerInfo
                }
              >
                <Text
                  style={
                    styles.thumbnailPickerTitle
                  }
                >
                  {thumbnail
                    ? "Cover siap"
                    : editProductId
                      ? "Ganti cover"
                      : "Pilih cover"}
                </Text>

                <Text
                  style={
                    styles.thumbnailSizeText
                  }
                >
                  Rasio 1:1
                </Text>

                <Text
                  style={
                    styles.thumbnailSizeText
                  }
                >
                  1080 × 1080 px
                </Text>

                <Text
                  style={
                    styles.thumbnailHint
                  }
                >
                  Tekan untuk memilih dan mengatur posisi gambar
                </Text>
              </View>
            </Pressable>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>
              Jenis File
            </Text>

            <Pressable
              style={
                styles.fileTypeSelector
              }
              onPress={() => {
                setShowProductFileKindMenu(
                  value => !value
                );

                setShowProductTypeMenu(false);
                setShowSubjectMenu(false);
                setShowClassLevelMenu(false);
                setShowPricingTypeMenu(false);
              }}
            >
              <Text
                style={[
                  styles.fileTypeValue,
                  !productFileKind &&
                    styles.fileTypePlaceholder,
                ]}
              >
                {productFileKind === "pdf"
                  ? "PDF"
                  : productFileKind === "image"
                    ? "Gambar"
                    : productFileKind === "office"
                      ? "Word"
                      : "Pilih jenis file"}
              </Text>

              {showProductFileKindMenu ? (
                <ChevronUp
                  size={18}
                  strokeWidth={1.8}
                  color="#64748B"
                />
              ) : (
                <ChevronDown
                  size={18}
                  strokeWidth={1.8}
                  color="#64748B"
                />
              )}
            </Pressable>

            {showProductFileKindMenu ? (
              <View
                style={
                  styles.fileTypeMenu
                }
              >
                <Pressable
                  style={
                    styles.fileTypeOption
                  }
                  onPress={() =>
                    selectProductFileKind(
                      "pdf"
                    )
                  }
                >
                  <View
                    style={
                      styles.fileTypeOptionIcon
                    }
                  >
                    <FileText
                      size={19}
                      color="#DC2626"
                    />
                  </View>

                  <View
                    style={
                      styles.fileTypeOptionInfo
                    }
                  >
                    <Text
                      style={
                        styles.fileTypeOptionTitle
                      }
                    >
                      PDF
                    </Text>

                    <Text
                      style={
                        styles.fileTypeOptionSub
                      }
                    >
                      Dokumen PDF
                    </Text>
                  </View>
                </Pressable>

                <View
                  style={
                    styles.fileTypeDivider
                  }
                />

                <Pressable
                  style={
                    styles.fileTypeOption
                  }
                  onPress={() =>
                    selectProductFileKind(
                      "office"
                    )
                  }
                >
                  <View
                    style={
                      styles.fileTypeOptionIcon
                    }
                  >
                    <Files
                      size={19}
                      color="#F97316"
                    />
                  </View>

                  <View
                    style={
                      styles.fileTypeOptionInfo
                    }
                  >
                    <Text
                      style={
                        styles.fileTypeOptionTitle
                      }
                    >
                      Word
                    </Text>

                    <Text
                      style={
                        styles.fileTypeOptionSub
                      }
                    >
                      DOC, DOCX
                    </Text>
                  </View>
                </Pressable>

                <View
                  style={
                    styles.fileTypeDivider
                  }
                />

                <Pressable
                  style={
                    styles.fileTypeOption
                  }
                  onPress={() =>
                    selectProductFileKind(
                      "image"
                    )
                  }
                >
                  <View
                    style={
                      styles.fileTypeOptionIcon
                    }
                  >
                    <ImageIcon
                      size={19}
                      color="#2563EB"
                    />
                  </View>

                  <View
                    style={
                      styles.fileTypeOptionInfo
                    }
                  >
                    <Text
                      style={
                        styles.fileTypeOptionTitle
                      }
                    >
                      Gambar
                    </Text>

                    <Text
                      style={
                        styles.fileTypeOptionSub
                      }
                    >
                      JPG, PNG atau WEBP
                    </Text>
                  </View>
                </Pressable>
              </View>
            ) : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>
              {productFileKind ===
              "image"
                ? "Isi Produk"
                : "File Produk"}
            </Text>

            {productFileKind ===
            "image" ? (
              <>
                <Pressable
                  style={
                    styles.filePicker
                  }
                  onPress={
                    chooseProductFile
                  }
                >
                  <View
                    style={
                      styles.fileIcon
                    }
                  >
                    <ImageIcon
                      size={20}
                      color="#2563EB"
                    />
                  </View>

                  <View
                    style={
                      styles.fileInfo
                    }
                  >
                    <Text
                      style={
                        styles.fileTitle
                      }
                    >
                      {productPages.length >
                      0
                        ? `${productPages.length} halaman dipilih`
                        : "Pilih beberapa gambar"}
                    </Text>

                    <Text
                      style={
                        styles.fileName
                      }
                    >
                      JPG, PNG atau WEBP • maksimal 15 halaman
                    </Text>
                  </View>
                </Pressable>

                <Text
                  style={
                    styles.productPageHint
                  }
                >
                  Tekan dan tahan gambar, lalu geser ke kiri atau kanan untuk mengubah urutan halaman.
                </Text>

                {productPages.length >
                0 ? (
                  <ScrollView
                    horizontal
                    nestedScrollEnabled
                    showsHorizontalScrollIndicator={
                      false
                    }
                    contentContainerStyle={
                      styles.productPageList
                    }
                  >
                    {productPages.map(
                      (
                        page,
                        index
                      ) => (
                        <DraggableProductPageCard
                          key={
                            page.storagePath ??
                            page.uri
                          }
                          page={page}
                          index={index}
                          totalPages={
                            productPages.length
                          }
                          onMove={
                            moveProductPage
                          }
                          onRemove={() => {
                            if (
                              editProductId &&
                              productPages.length <=
                                1
                            ) {
                              setErrorMessage(
                                "Produk gambar minimal memiliki 1 halaman."
                              );

                              return;
                            }

                            removeProductPage(
                              index
                            );
                          }}
                        />
                      )
                    )}
                  </ScrollView>
                ) : null}
              </>
            ) : (
              <Pressable
                style={[
                  styles.filePicker,

                  !productFileKind &&
                    styles.filePickerDisabled,
                ]}
                onPress={
                  chooseProductFile
                }
              >
                <View
                  style={
                    styles.fileIcon
                  }
                >
                  <FileText
                    size={20}
                    color="#2563EB"
                  />
                </View>

                <View
                  style={
                    styles.fileInfo
                  }
                >
                  <Text
                    style={
                      styles.fileTitle
                    }
                  >
                    {productFile
                      ? "File baru dipilih"
                      : editProductId
                        ? "File produk saat ini"
                        : productFileKind ===
                            "pdf"
                          ? "Pilih PDF"
                          : "Pilih jenis file dahulu"}
                  </Text>

                  <Text
                    style={
                      styles.fileName
                    }
                    numberOfLines={1}
                  >
                    {productFile?.fileName ??
                      (editProductId
                        ? "Tetap gunakan file lama"
                        : productFileKind ===
                            "office"
                          ? "Pilih file Word"
                          : "PDF saja")}
                  </Text>
                </View>
              </Pressable>
            )}

            {productFileKind ===
            "office" ? (
              <View style={styles.field}>
                <Text style={styles.label}>
                  PDF Pratinjau
                </Text>

                <Pressable
                  style={styles.filePicker}
                  onPress={
                    choosePreviewPdf
                  }
                >
                  <View
                    style={
                      styles.fileIcon
                    }
                  >
                    <FileText
                      size={20}
                      color="#2563EB"
                    />
                  </View>

                  <View
                    style={
                      styles.fileInfo
                    }
                  >
                    <Text
                      style={
                        styles.fileTitle
                      }
                    >
                      {previewPdfFile
                        ? "PDF pratinjau dipilih"
                        : "Pilih PDF pratinjau"}
                    </Text>

                    <Text
                      style={
                        styles.fileName
                      }
                      numberOfLines={1}
                    >
                      {previewPdfFile
                        ?.fileName ??
                        "PDF untuk tampilan rapi di Diginaz"}
                    </Text>
                  </View>
                </Pressable>
              </View>
            ) : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>
              Deskripsi
            </Text>

            <TextInput
              value={description}
              onChangeText={setDescription}
              style={[
                styles.input,
                styles.description,
              ]}
              placeholder="Jelaskan isi dan manfaat produk..."
              placeholderTextColor="#94A3B8"
              multiline
              maxLength={4000}
              textAlignVertical="top"
            />
          </View>

          {errorMessage ? (
            <Text style={styles.errorText}>
              {errorMessage}
            </Text>
          ) : null}

          {message ? (
            <Text style={styles.successText}>
              {message}
            </Text>
          ) : null}

          <Pressable
            onPress={handleUpload}
            disabled={submitting}
            style={[
              styles.submitButton,
              submitting &&
                styles.submitButtonDisabled,
            ]}
          >
            {submitting ? (
              <>
                <ActivityIndicator
                  size="small"
                  color="#FFFFFF"
                />

                <Text
                  style={styles.submitText}
                >
                  {`${uploadProgress ?? 0}%`}
                </Text>
              </>
            ) : (
              <>
                <Upload
                  size={17}
                  color="#FFFFFF"
                />

                <Text
                  style={styles.submitText}
                >
                  {editProductId ? "Simpan Perubahan" : "Publikasikan Produk"}
                </Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  flex: {
    flex: 1,
  },

  header: {
    height: 68,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },

  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },

  headerText: {
    flex: 1,
  },

  title: {
    fontFamily:
      "PlusJakartaSans_700Bold",
    fontSize: 15,
    color: "#0F172A",
  },

  subtitle: {
    marginTop: 2,
    fontFamily:
      "PlusJakartaSans_400Regular",
    fontSize: 9,
    color: "#94A3B8",
  },

  content: {
    padding: 16,
    paddingBottom: 36,
    gap: 7,
  },

  field: {
    gap: 3,
  },

  label: {
    fontFamily:
      "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: "#334155",
  },

  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
    fontFamily:
      "PlusJakartaSans_400Regular",
    fontSize: 12,
    color: "#0F172A",
  },

  priceInput: {
    marginTop: 3,
  },

  description: {
    minHeight: 112,
    paddingTop: 13,
    paddingBottom: 13,
  },

  pills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },

  pill: {
    minHeight: 34,
    paddingHorizontal: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },

  pillActive: {
    borderColor: "#2563EB",
    backgroundColor: "#EFF6FF",
  },

  pillText: {
    fontFamily:
      "PlusJakartaSans_500Medium",
    fontSize: 9.5,
    color: "#64748B",
  },

  pillTextActive: {
    fontFamily:
      "PlusJakartaSans_600SemiBold",
    color: "#2563EB",
  },

  thumbnailPickerCard: {
    minHeight: 126,
    padding: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  thumbnailPreview: {
    width: 88,
    height: 88,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  thumbnailPreviewImage: {
    width: "100%",
    height: "100%",
  },

  thumbnailPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },

  thumbnailRatio: {
    fontFamily:
      "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: "#64748B",
  },

  thumbnailPickerInfo: {
    flex: 1,
  },

  thumbnailPickerTitle: {
    fontFamily:
      "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: "#0F172A",
  },

  thumbnailSizeText: {
    marginTop: 2,
    fontFamily:
      "PlusJakartaSans_500Medium",
    fontSize: 12,
    color: "#475569",
  },

  thumbnailHint: {
    marginTop: 5,
    fontFamily:
      "PlusJakartaSans_400Regular",
    fontSize: 11,
    lineHeight: 15,
    color: "#94A3B8",
  },

  productPageHint: {
    marginTop: 7,
    fontFamily:
      "PlusJakartaSans_400Regular",
    fontSize: 11,
    lineHeight: 16,
    color: "#64748B",
  },

  productPageList: {
    paddingTop: 10,
    paddingBottom: 3,
    gap: 10,
  },

  productPageCard: {
    width: 96,
    minHeight: 150,
    padding: 5,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    position: "relative",
  },

  productPageCardDragging: {
    borderColor: "#2563EB",
    borderWidth: 2,
    backgroundColor: "#EFF6FF",
    elevation: 10,
    zIndex: 20,
  },

  productPageDragSurface: {
    alignItems: "center",
  },

  productPageImageWrap: {
    position: "relative",
  },

  productPageDragBadge: {
    position: "absolute",
    left: 5,
    right: 5,
    top: 5,
    minHeight: 24,
    borderRadius: 7,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },

  productPageDragBadgeText: {
    fontFamily:
      "PlusJakartaSans_600SemiBold",
    fontSize: 9,
    color: "#FFFFFF",
  },

  productPageImage: {
    width: 84,
    aspectRatio: 210 / 297,
    alignSelf: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 5,
  },

  productPageNumber: {
    marginTop: 4,
    textAlign: "center",
    fontFamily:
      "PlusJakartaSans_500Medium",
    fontSize: 9,
    color: "#475569",
  },

  productPageRemove: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor:
      "rgba(15, 23, 42, 0.78)",
  },

  productPageRemoveText: {
    marginTop: -2,
    fontFamily:
      "PlusJakartaSans_600SemiBold",
    fontSize: 16,
    color: "#FFFFFF",
  },

  filePicker: {
    minHeight: 54,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },

  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },

  fileInfo: {
    flex: 1,
  },

  fileTitle: {
    fontFamily:
      "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: "#0F172A",
  },

  dropdownOption: {
    minHeight: 40,
    paddingHorizontal: 14,
    justifyContent: "center",
  },

  dropdownOptionText: {
    fontFamily:
      "PlusJakartaSans_500Medium",
    fontSize: 12,
    color: "#0F172A",
  },

  dropdownDivider: {
    height:
      StyleSheet.hairlineWidth,
    backgroundColor: "#E2E8F0",
    marginHorizontal: 14,
  },

  customSubjectInput: {
    marginTop: 3,
  },

  compactPriceInput: {
    marginTop: 3,
  },

  fileTypeSelector: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  fileTypeValue: {
    fontFamily:
      "PlusJakartaSans_500Medium",
    fontSize: 12,
    color: "#0F172A",
  },

  fileTypePlaceholder: {
    color: "#94A3B8",
  },

  fileTypeChevron: {
    fontFamily:
      "PlusJakartaSans_600SemiBold",
    fontSize: 10,
    color: "#64748B",
  },

  fileTypeMenu: {
    marginTop: 3,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },

  fileTypeOption: {
    minHeight: 54,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
  },

  fileTypeOptionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },

  fileTypeOptionInfo: {
    flex: 1,
    marginLeft: 10,
  },

  fileTypeOptionTitle: {
    fontFamily:
      "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: "#0F172A",
  },

  fileTypeOptionSub: {
    marginTop: 2,
    fontFamily:
      "PlusJakartaSans_400Regular",
    fontSize: 12,
    color: "#94A3B8",
  },

  fileTypeDivider: {
    height:
      StyleSheet.hairlineWidth,
    backgroundColor: "#E2E8F0",
    marginLeft: 56,
  },

  filePickerDisabled: {
    opacity: 0.55,
  },

  fileName: {
    marginTop: 3,
    fontFamily:
      "PlusJakartaSans_400Regular",
    fontSize: 12,
    color: "#94A3B8",
  },

  errorText: {
    fontFamily:
      "PlusJakartaSans_400Regular",
    fontSize: 9.5,
    color: "#DC2626",
  },

  successText: {
    fontFamily:
      "PlusJakartaSans_500Medium",
    fontSize: 9.5,
    color: "#16A34A",
  },

  submitButton: {
    height: 50,
    borderRadius: 14,
    backgroundColor: "#2563EB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  submitButtonDisabled: {
    opacity: 0.55,
  },

  submitText: {
    fontFamily:
      "PlusJakartaSans_600SemiBold",
    fontSize: 11,
    color: "#FFFFFF",
  },
});

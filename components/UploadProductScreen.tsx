import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ImageCropPicker from "react-native-image-crop-picker";
import { ImagePickerCompat as ImagePicker } from "../lib/nativePickers";
import { DocumentPickerCompat as DocumentPicker } from "../lib/nativePickers";

import { supabase } from "../lib/supabase";

type Props = {
  onClose: () => void;
  onUploaded: () => void;
  editProductId?: string | null;
};

type PickedAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;

  // EDIT_EXISTING_PAGE:
  // Jika terisi, halaman ini sudah ada di Storage.
  storagePath?: string | null;
};

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

        for (
          const row of pageRows ?? []
        ) {
          const storagePath =
            String(
              row.storage_path ?? ""
            ).trim();

          if (!storagePath) {
            continue;
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
              3600
            );

          if (
            signedError ||
            !signed?.signedUrl
          ) {
            throw (
              signedError ??
              new Error(
                "Preview halaman produk tidak dapat disiapkan."
              )
            );
          }

          loadedPages.push({
            uri: signed.signedUrl,

            fileName:
              row.original_name ??
              `Halaman ${row.page_number}`,

            mimeType:
              row.mime_type ??
              "image/jpeg",

            storagePath,
          });
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


  async function syncProductImagePages(
    userId: string,
    productId: string,
    firstStoragePath: string,
    pages: PickedAsset[]
  ) {
    if (
      pages.length === 0
    ) {
      return;
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
          `${userId}/${productId}/pages/` +
          `page-${String(
            index + 1
          ).padStart(
            3,
            "0"
          )}-${batchId}-${cleanName}`;

        const buffer =
          await fetch(
            page.uri
          ).then(
            response =>
              response.arrayBuffer()
          );

        const {
          error: uploadError,
        } =
          await supabase.storage
            .from(
              "store-product-files"
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


  // EDIT_SLIDES_SYNC_V1
  async function syncEditedImagePages(
    userId: string,
    productId: string,
    pages: PickedAsset[]
  ): Promise<{
    firstStoragePath: string;
    stalePaths: string[];
  }> {
    if (pages.length === 0) {
      throw new Error(
        "Produk gambar minimal memiliki 1 halaman."
      );
    }

    const {
      data: previousRows,
      error: previousRowsError,
    } = await supabase
      .from("store_product_pages")
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
            row.storage_path ?? ""
          ).trim()
        )
        .filter(Boolean);

    const currentPaths:
      string[] = [];

    const uploadedPaths:
      string[] = [];

    const rows: Array<{
      product_id: string;
      page_number: number;
      storage_path: string;
      mime_type: string;
      original_name: string | null;
    }> = [];

    let databaseWasUpdated =
      false;

    try {
      const batchId =
        Date.now();

      for (
        let index = 0;
        index < pages.length;
        index++
      ) {
        const page =
          pages[index];

        let storagePath =
          page.storagePath
            ?.trim() ??
          "";

        // storagePath hanya boleh dipakai
        // jika memang berasal dari produk ini.
        if (
          storagePath &&
          !previousPaths.includes(
            storagePath
          )
        ) {
          storagePath = "";
        }

        // Halaman baru: baru upload.
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
            `${userId}/${productId}/pages/` +
            `page-${String(
              index + 1
            ).padStart(
              3,
              "0"
            )}-${batchId}-${cleanName}`;

          const buffer =
            await fetch(
              page.uri
            ).then(
              response =>
                response.arrayBuffer()
            );

          const {
            error: uploadError,
          } =
            await supabase.storage
              .from(
                "store-product-files"
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

          uploadedPaths.push(
            storagePath
          );
        }

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

      databaseWasUpdated =
        true;

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

      return {
        firstStoragePath:
          currentPaths[0],

        stalePaths,
      };
    }
    catch (error) {
      // Kalau DB belum berubah,
      // upload baru aman dibersihkan.
      if (
        !databaseWasUpdated &&
        uploadedPaths.length > 0
      ) {
        try {
          await supabase.storage
            .from(
              "store-product-files"
            )
            .remove(
              uploadedPaths
            );
        }
        catch {
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
                };
              }
            );

        if (
          pickedPages.length === 0
        ) {
          return;
        }

        const nextPages =
          [
            ...productPages,
            ...pickedPages,
          ].slice(
            0,
            20
          );

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
      `${userId}/${productId}/` +
      `original-${batchId}-${cleanOriginalName}`;

    const pdfPath =
      `${userId}/${productId}/` +
      `file-${batchId}-${cleanPreviewName}`;


    const originalMimeType =
      wordExtension === "docx"
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : "application/msword";


    const wordBuffer =
      await fetch(
        wordAsset.uri
      ).then(
        response =>
          response.arrayBuffer()
      );

    if (
      wordBuffer.byteLength <= 0
    ) {
      throw new Error(
        "File Word kosong atau tidak dapat dibaca."
      );
    }


    const previewBuffer =
      await fetch(
        previewAsset.uri
      ).then(
        response =>
          response.arrayBuffer()
      );

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
            "store-product-originals"
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


      const {
        error:
          previewUploadError,
      } =
        await supabase.storage
          .from(
            "store-product-files"
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


      return {
        pdfPath,
        originalPath,
        originalFileName,
        originalMimeType,
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

    /*
     * WORD_TO_PDF_GUARD_V1
     *
     * DOC/DOCX sudah memakai jalur converter.
     * Excel dan PowerPoint belum diaktifkan.
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

    let productId: string | null = null;
    let thumbnailPath: string | null = null;
    let filePath: string | null = null;

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
            `${user.id}/${editProductId}/` +
            `thumbnail-${Date.now()}.${extension}`;

          const thumbnailBuffer =
            await fetch(thumbnail.uri)
              .then((response) =>
                response.arrayBuffer()
              );

          const {
            error: thumbnailError,
          } = await supabase.storage
            .from("store-thumbnails")
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
              `${user.id}/${editProductId}/` +
              `file-${Date.now()}-${cleanFileName}`;

            const fileBuffer =
              await fetch(
                productFile.uri
              ).then(
                response =>
                  response.arrayBuffer()
              );

            const {
              error: fileError,
            } =
              await supabase.storage
                .from(
                  "store-product-files"
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
          }

          nextFilePath =
            filePath;
        }

        let editImageSync:
          {
            firstStoragePath: string;
            stalePaths: string[];
          } |
          null = null;

        if (
          productFileKind ===
            "image"
        ) {
          if (
            productPages.length ===
            0
          ) {
            throw new Error(
              "Produk gambar minimal memiliki 1 halaman."
            );
          }

          editImageSync =
            await syncEditedImagePages(
              user.id,
              existing.id,
              productPages
            );

          nextOriginalFilePath =
            null;

          nextOriginalFileName =
            null;

          nextOriginalMimeType =
            null;

          nextFilePath =
            editImageSync
              .firstStoragePath;
        }


        const {
          data: updated,
          error: updateError,
        } = await supabase
          .from("store_products")
          .update({
            title: cleanTitle,
            product_type: productType,
            subject: cleanSubject,
            class_level: classLevel,
            pricing_type: pricingType,
            price_amount: priceAmount,
            original_price_amount: null,
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
            status: "published",
          })
          .eq("id", editProductId)
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

        // Baru bersihkan file slide yang
        // benar-benar dihapus setelah save sukses.
        if (
          editImageSync &&
          editImageSync.stalePaths.length >
            0
        ) {
          const {
            error: cleanupPagesError,
          } =
            await supabase.storage
              .from(
                "store-product-files"
              )
              .remove(
                editImageSync.stalePaths
              );

          if (cleanupPagesError) {
            console.warn(
              "Slide lama belum terhapus dari Storage:",
              cleanupPagesError
            );
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

      if (thumbnail) {
        const extension =
          getExtension(
            thumbnail,
            "jpg"
          );

        thumbnailPath =
          `${user.id}/${productId}/` +
          `thumbnail-${Date.now()}.${extension}`;

        const thumbnailBuffer =
          await fetch(thumbnail.uri)
            .then((response) =>
              response.arrayBuffer()
            );

        const {
          error: thumbnailError,
        } = await supabase.storage
          .from("store-thumbnails")
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
      } else {
        const rawFileName =
          productFile.fileName ??
          `produk-${Date.now()}`;

        const cleanFileName =
          safeFileName(
            rawFileName
          );

        filePath =
          `${user.id}/${productId}/` +
          `file-${Date.now()}-${cleanFileName}`;

        const fileBuffer =
          await fetch(
            productFile.uri
          ).then(
            response =>
              response.arrayBuffer()
          );

        const {
          error: fileError,
        } =
          await supabase.storage
            .from(
              "store-product-files"
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
          productPages
        );
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

      if (thumbnailPath) {
        await supabase.storage
          .from("store-thumbnails")
          .remove([thumbnailPath]);
      }

      if (filePath) {
        await supabase.storage
          .from("store-product-files")
          .remove([filePath]);
      }

      if (originalFilePath) {
        await supabase.storage
          .from(
            "store-product-originals"
          )
          .remove([
            originalFilePath,
          ]);
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
                      JPG, PNG atau WEBP • maksimal 20 halaman
                    </Text>
                  </View>
                </Pressable>

                <Text
                  style={
                    styles.productPageHint
                  }
                >
                  Setiap gambar menjadi satu halaman. Preview menggunakan rasio A4 dan gambar tidak dipotong.
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
                        <View
                          key={
                            page.uri +
                            index
                          }
                          style={
                            styles.productPageCard
                          }
                        >
                          <Image
                            source={{
                              uri:
                                page.uri,
                            }}
                            style={
                              styles.productPageImage
                            }
                            resizeMode="contain"
                          />

                          <Text
                            style={
                              styles.productPageNumber
                            }
                          >
                            Halaman {index + 1}
                          </Text>

                          <Pressable
                            onPress={() => {
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
                            hitSlop={8}
                            style={
                              styles.productPageRemove
                            }
                          >
                            <Text
                              style={
                                styles.productPageRemoveText
                              }
                            >
                              ×
                            </Text>
                          </Pressable>
                        </View>
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
              <ActivityIndicator
                size="small"
                color="#FFFFFF"
              />
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


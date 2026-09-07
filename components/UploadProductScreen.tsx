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
} from "react-native";
import {
  ArrowLeft,
  FileText,
  Image as ImageIcon,
  Upload,
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
  "Guru",
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
  const [classLevel, setClassLevel] =
    useState("Kelas 1");

  const [pricingType, setPricingType] =
    useState<"free" | "paid">("free");

  const [price, setPrice] = useState("");
  const [description, setDescription] =
    useState("");

  const [thumbnail, setThumbnail] =
    useState<PickedAsset | null>(null);

  const [productFile, setProductFile] =
    useState<PickedAsset | null>(null);

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

        if (!active) {
          return;
        }

        setTitle(data.title ?? "");
        setProductType(
          data.product_type ?? "LKPD"
        );
        setSubject(data.subject ?? "");
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

  async function chooseThumbnail() {
    setErrorMessage("");

    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setErrorMessage(
        "Izin galeri diperlukan untuk memilih thumbnail."
      );
      return;
    }

    const result =
      await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 5],
        quality: 0.9,
      });

    if (
      result.canceled ||
      result.assets.length === 0
    ) {
      return;
    }

    const asset = result.assets[0];

    setThumbnail({
      uri: asset.uri,
      fileName:
        asset.fileName ??
        `thumbnail-${Date.now()}.jpg`,
      mimeType:
        asset.mimeType ??
        "image/jpeg",
    });
  }

  async function chooseProductFile() {
    setErrorMessage("");

    const result =
      await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "application/vnd.ms-powerpoint",
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/zip",
          "application/x-zip-compressed",
          "application/octet-stream",
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });

    if (
      result.canceled ||
      !result.assets?.length
    ) {
      return;
    }

    const asset = result.assets[0];

    setProductFile({
      uri: asset.uri,
      fileName: asset.name,
      mimeType:
        asset.mimeType ??
        "application/octet-stream",
    });
  }

  async function handleUpload() {
    if (submitting) return;

    setMessage("");
    setErrorMessage("");

    const cleanTitle = title.trim();
    const cleanSubject = subject.trim();
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

    setSubmitting(true);

    let productId: string | null = null;
    let thumbnailPath: string | null = null;
    let filePath: string | null = null;

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
            "id,creator_user_id,thumbnail_path,file_path"
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

        if (productFile) {
          const rawFileName =
            productFile.fileName ??
            `produk-${Date.now()}`;

          const cleanFileName =
            safeFileName(rawFileName);

          filePath =
            `${user.id}/${editProductId}/` +
            `file-${Date.now()}-${cleanFileName}`;

          const fileBuffer =
            await fetch(productFile.uri)
              .then((response) =>
                response.arrayBuffer()
              );

          const {
            error: fileError,
          } = await supabase.storage
            .from("store-product-files")
            .upload(
              filePath,
              fileBuffer,
              {
                contentType:
                  productFile.mimeType ??
                  "application/octet-stream",
                upsert: false,
              }
            );

          if (fileError) {
            throw fileError;
          }

          nextFilePath =
            filePath;
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

      const rawFileName =
        productFile.fileName ??
        `produk-${Date.now()}`;

      const cleanFileName =
        safeFileName(rawFileName);

      filePath =
        `${user.id}/${productId}/` +
        `file-${Date.now()}-${cleanFileName}`;

      const fileBuffer =
        await fetch(productFile.uri)
          .then((response) =>
            response.arrayBuffer()
          );

      const {
        error: fileError,
      } = await supabase.storage
        .from("store-product-files")
        .upload(
          filePath,
          fileBuffer,
          {
            contentType:
              productFile.mimeType ??
              "application/octet-stream",
            upsert: false,
          }
        );

      if (fileError) {
        throw fileError;
      }

      const {
        error: publishError,
      } = await supabase
        .from("store_products")
        .update({
          thumbnail_path:
            thumbnailPath,
          file_path: filePath,
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

            <View style={styles.pills}>
              {PRODUCT_TYPES.map(
                (item) => (
                  <Pressable
                    key={item}
                    onPress={() =>
                      setProductType(item)
                    }
                    style={[
                      styles.pill,
                      productType === item &&
                        styles.pillActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        productType === item &&
                          styles.pillTextActive,
                      ]}
                    >
                      {item}
                    </Text>
                  </Pressable>
                )
              )}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>
              Mata Pelajaran
            </Text>

            <TextInput
              value={subject}
              onChangeText={setSubject}
              style={styles.input}
              placeholder="Pendidikan Agama Islam"
              placeholderTextColor="#94A3B8"
              maxLength={120}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>
              Kelas
            </Text>

            <View style={styles.pills}>
              {CLASS_LEVELS.map(
                (item) => (
                  <Pressable
                    key={item}
                    onPress={() =>
                      setClassLevel(item)
                    }
                    style={[
                      styles.pill,
                      classLevel === item &&
                        styles.pillActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        classLevel === item &&
                          styles.pillTextActive,
                      ]}
                    >
                      {item}
                    </Text>
                  </Pressable>
                )
              )}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>
              Harga
            </Text>

            <View style={styles.pills}>
              <Pressable
                onPress={() =>
                  setPricingType("free")
                }
                style={[
                  styles.pill,
                  pricingType === "free" &&
                    styles.pillActive,
                ]}
              >
                <Text
                  style={[
                    styles.pillText,
                    pricingType === "free" &&
                      styles.pillTextActive,
                  ]}
                >
                  Gratis
                </Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  setPricingType("paid")
                }
                style={[
                  styles.pill,
                  pricingType === "paid" &&
                    styles.pillActive,
                ]}
              >
                <Text
                  style={[
                    styles.pillText,
                    pricingType === "paid" &&
                      styles.pillTextActive,
                  ]}
                >
                  Berbayar
                </Text>
              </Pressable>
            </View>

            {pricingType === "paid" ? (
              <TextInput
                value={price}
                onChangeText={setPrice}
                style={[
                  styles.input,
                  styles.priceInput,
                ]}
                placeholder="Contoh: 15000"
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
              />
            ) : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>
              Thumbnail
            </Text>

            <Pressable
              style={styles.filePicker}
              onPress={chooseThumbnail}
            >
              <View style={styles.fileIcon}>
                <ImageIcon
                  size={20}
                  color="#2563EB"
                />
              </View>

              <View style={styles.fileInfo}>
                <Text style={styles.fileTitle}>
                  {thumbnail
                    ? "Thumbnail baru dipilih"
                    : editProductId
                      ? "Thumbnail saat ini"
                      : "Pilih thumbnail"}
                </Text>

                <Text
                  style={styles.fileName}
                  numberOfLines={1}
                >
                  {thumbnail?.fileName ??
                    (editProductId
                      ? "Tetap gunakan thumbnail lama"
                      : "PNG, JPG atau WEBP")}
                </Text>
              </View>
            </Pressable>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>
              File Produk
            </Text>

            <Pressable
              style={styles.filePicker}
              onPress={chooseProductFile}
            >
              <View style={styles.fileIcon}>
                <FileText
                  size={20}
                  color="#2563EB"
                />
              </View>

              <View style={styles.fileInfo}>
                <Text style={styles.fileTitle}>
                  {productFile
                    ? "File baru dipilih"
                    : editProductId
                      ? "File produk saat ini"
                      : "Pilih file produk"}
                </Text>

                <Text
                  style={styles.fileName}
                  numberOfLines={1}
                >
                  {productFile?.fileName ??
                    (editProductId
                      ? "Tetap gunakan file lama"
                      : "PDF, PPT, Word, Excel atau ZIP")}
                </Text>
              </View>
            </Pressable>
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
    gap: 20,
  },

  field: {
    gap: 8,
  },

  label: {
    fontFamily:
      "PlusJakartaSans_600SemiBold",
    fontSize: 10.5,
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
    fontSize: 11,
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

  filePicker: {
    minHeight: 68,
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
    fontSize: 10.5,
    color: "#0F172A",
  },

  fileName: {
    marginTop: 3,
    fontFamily:
      "PlusJakartaSans_400Regular",
    fontSize: 8.5,
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


import {
  launchCamera,
  launchImageLibrary,
} from "react-native-image-picker";

import {
  pick,
  keepLocalCopy,
  errorCodes,
  isErrorWithCode,
} from "@react-native-documents/picker";

type ExpoImageOptions = {
  mediaTypes?: unknown;
  allowsEditing?: boolean;
  aspect?: number[];
  quality?: number;
};

type ExpoDocumentOptions = {
  type?: string | string[];
  multiple?: boolean;
  copyToCacheDirectory?: boolean;
};

function normalizeImageAsset(asset: any) {
  if (!asset?.uri) {
    return null;
  }

  return {
    uri: asset.uri,
    fileName: asset.fileName ?? null,
    mimeType: asset.type ?? null,
    fileSize:
      typeof asset.fileSize === "number"
        ? asset.fileSize
        : null,
    width:
      typeof asset.width === "number"
        ? asset.width
        : 0,
    height:
      typeof asset.height === "number"
        ? asset.height
        : 0,
  };
}

export const ImagePickerCompat = {
  async requestCameraPermissionsAsync() {
    return {
      granted: true,
      status: "granted",
      canAskAgain: true,
      expires: "never",
    };
  },

  async requestMediaLibraryPermissionsAsync() {
    return {
      granted: true,
      status: "granted",
      canAskAgain: true,
      expires: "never",
    };
  },

  async launchCameraAsync(options: ExpoImageOptions = {}) {
    const result = await launchCamera({
      mediaType: "photo",
      quality: (
        typeof options.quality === "number"
          ? options.quality
          : 1
      ) as any,
      saveToPhotos: false,
    });

    if (result.didCancel) {
      return {
        canceled: true,
        assets: [],
      };
    }

    if (result.errorCode) {
      throw new Error(
        result.errorMessage ??
          `Camera error: ${result.errorCode}`
      );
    }

    const asset = normalizeImageAsset(
      result.assets?.[0]
    );

    return {
      canceled: !asset,
      assets: asset ? [asset] : [],
    };
  },

  async launchImageLibraryAsync(
    options: ExpoImageOptions = {}
  ) {
    const result = await launchImageLibrary({
      mediaType: "photo",
      selectionLimit: 1,
      quality: (
        typeof options.quality === "number"
          ? options.quality
          : 1
      ) as any,
    });

    if (result.didCancel) {
      return {
        canceled: true,
        assets: [],
      };
    }

    if (result.errorCode) {
      throw new Error(
        result.errorMessage ??
          `Gallery error: ${result.errorCode}`
      );
    }

    const asset = normalizeImageAsset(
      result.assets?.[0]
    );

    return {
      canceled: !asset,
      assets: asset ? [asset] : [],
    };
  },
};

export const DocumentPickerCompat = {
  async getDocumentAsync(
    options: ExpoDocumentOptions = {}
  ) {
    try {
      const result = await pick({
        type: options.type,
        allowMultiSelection:
          options.multiple === true,
      } as any);

      let readableResult:
        any[] =
        result;

      if (
        options.copyToCacheDirectory ===
          true &&
        result.length > 0
      ) {
        const copies =
          await keepLocalCopy({
            files:
              result.map(
                (
                  file: any,
                  index: number
                ) => ({
                  uri:
                    file.uri,
                  fileName:
                    file.name ??
                    `dokumen-${Date.now()}-${index + 1}`,
                })
              ) as any,
            destination:
              "cachesDirectory",
          });

        readableResult =
          result.map(
            (
              file: any,
              index: number
            ) => {
              const copy =
                copies[index];

              if (!copy) {
                throw new Error(
                  "Salinan lokal dokumen tidak tersedia."
                );
              }

              if (
                copy.status ===
                  "error"
              ) {
                throw new Error(
                  copy.copyError ||
                    "Dokumen gagal disalin ke cache aplikasi."
                );
              }

              return {
                ...file,
                uri:
                  copy.localUri,
              };
            }
          );
      }

      const assets = readableResult.map((file: any) => ({
        uri: file.uri,
        name:
          file.name ??
          `dokumen-${Date.now()}`,
        mimeType: file.type ?? null,
        size:
          typeof file.size === "number"
            ? file.size
            : null,
      }));

      return {
        canceled: false,
        assets,
      };
    } catch (error) {
      if (
        isErrorWithCode(error) &&
        error.code === errorCodes.OPERATION_CANCELED
      ) {
        return {
          canceled: true,
          assets: [],
        };
      }

      throw error;
    }
  },
};


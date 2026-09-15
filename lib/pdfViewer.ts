import {
  NativeModules,
} from "react-native";

export type PdfRenderedPage = {
  uri: string;
  width: number;
  height: number;
  pageCount: number;
};

type PdfViewerNativeModule = {
  getPageCount: (
    localPath: string
  ) => Promise<number>;

  renderPage: (
    localPath: string,
    pageIndex: number,
    width: number
  ) => Promise<PdfRenderedPage>;
};

const nativeModule =
  NativeModules.PdfViewerModule as
    | PdfViewerNativeModule
    | undefined;

export const pdfViewer = {
  available:
    Boolean(
      nativeModule
    ),

  async getPageCount(
    localPath: string
  ) {
    if (!nativeModule) {
      throw new Error(
        "PDF Viewer Android belum tersedia."
      );
    }

    return nativeModule.getPageCount(
      localPath
    );
  },

  async renderPage(
    localPath: string,
    pageIndex: number,
    width = 1200
  ) {
    if (!nativeModule) {
      throw new Error(
        "PDF Viewer Android belum tersedia."
      );
    }

    return nativeModule.renderPage(
      localPath,
      pageIndex,
      width
    );
  },
};
package com.diginaz.store

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.io.FileOutputStream

class PdfViewerModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String =
    "PdfViewerModule"

  @ReactMethod
  fun getPageCount(
    localPath: String,
    promise: Promise
  ) {
    try {
      val file = resolveFile(localPath)

      val descriptor =
        ParcelFileDescriptor.open(
          file,
          ParcelFileDescriptor.MODE_READ_ONLY
        )

      val renderer =
        PdfRenderer(descriptor)

      try {
        promise.resolve(
          renderer.pageCount
        )
      } finally {
        renderer.close()
      }
    } catch (error: Exception) {
      promise.reject(
        "PDF_PAGE_COUNT_FAILED",
        "PDF tidak dapat dibaca: ${error.message}",
        error
      )
    }
  }

  @ReactMethod
  fun renderPage(
    localPath: String,
    pageIndex: Int,
    requestedWidth: Int,
    promise: Promise
  ) {
    try {
      val file = resolveFile(localPath)

      val descriptor =
        ParcelFileDescriptor.open(
          file,
          ParcelFileDescriptor.MODE_READ_ONLY
        )

      val renderer =
        PdfRenderer(descriptor)

      try {
        if (
          pageIndex < 0 ||
          pageIndex >= renderer.pageCount
        ) {
          throw IllegalArgumentException(
            "Nomor halaman PDF tidak valid."
          )
        }

        val page =
          renderer.openPage(
            pageIndex
          )

        try {
          val maxWidth =
            requestedWidth
              .coerceIn(
                600,
                1600
              )

          val maxHeight =
            2200

          val widthScale =
            maxWidth.toFloat() /
              page.width.toFloat()

          val heightScale =
            maxHeight.toFloat() /
              page.height.toFloat()

          val scale =
            minOf(
              widthScale,
              heightScale,
              2.0f
            )

          val bitmapWidth =
            (
              page.width *
                scale
            )
              .toInt()
              .coerceAtLeast(1)

          val bitmapHeight =
            (
              page.height *
                scale
            )
              .toInt()
              .coerceAtLeast(1)

          val cacheDirectory =
            File(
              reactContext.cacheDir,
              "diginaz-pdf-viewer"
            )

          if (
            !cacheDirectory.exists() &&
            !cacheDirectory.mkdirs()
          ) {
            throw IllegalStateException(
              "Cache PDF tidak dapat dibuat."
            )
          }

          val cacheKey =
            (
              "${file.absolutePath}:" +
              "${file.length()}:" +
              "${file.lastModified()}:" +
              "$pageIndex:$bitmapWidth"
            )
              .hashCode()
              .toString()
              .replace(
                "-",
                "n"
              )

          val outputFile =
            File(
              cacheDirectory,
              "$cacheKey.jpg"
            )

          if (
            !outputFile.exists() ||
            outputFile.length() == 0L
          ) {
            val bitmap =
              Bitmap.createBitmap(
                bitmapWidth,
                bitmapHeight,
                Bitmap.Config.ARGB_8888
              )

            try {
              bitmap.eraseColor(
                Color.WHITE
              )

              page.render(
                bitmap,
                null,
                null,
                PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY
              )

              FileOutputStream(
                outputFile
              ).use { stream ->
                if (
                  !bitmap.compress(
                    Bitmap.CompressFormat.JPEG,
                    86,
                    stream
                  )
                ) {
                  throw IllegalStateException(
                    "Halaman PDF gagal dirender."
                  )
                }
              }
            } finally {
              bitmap.recycle()
            }
          }

          val result =
            Arguments.createMap()

          result.putString(
            "uri",
            Uri.fromFile(
              outputFile
            ).toString()
          )

          result.putInt(
            "width",
            bitmapWidth
          )

          result.putInt(
            "height",
            bitmapHeight
          )

          result.putInt(
            "pageCount",
            renderer.pageCount
          )

          promise.resolve(
            result
          )
        } finally {
          page.close()
        }
      } finally {
        renderer.close()
      }
    } catch (error: Exception) {
      promise.reject(
        "PDF_RENDER_FAILED",
        "Halaman PDF belum dapat ditampilkan: ${error.message}",
        error
      )
    }
  }

  private fun resolveFile(
    value: String
  ): File {
    val clean =
      value.trim()

    if (clean.startsWith("file://")) {
      val path =
        Uri.parse(clean).path
          ?: throw IllegalArgumentException(
            "Path PDF tidak valid."
          )

      return File(path)
    }

    return File(clean)
  }
}
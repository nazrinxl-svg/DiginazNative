import React from "react";

import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  ArrowLeft,
  BookOpen,
} from "lucide-react-native";

import {
  SafeAreaView,
} from "react-native-safe-area-context";

import ProductReviewsSection from "./ProductReviewsSection";

type Props = {
  productId: string;
  creatorUserId: string;
  productTitle: string;
  productCoverUrl?: string | null;
  productType?: string;
  productSubject?: string;
  productLevel?: string;
  onBack: () => void;
};

export default function ProductCommentsScreen({
  productId,
  creatorUserId,
  productTitle,
  productCoverUrl,
  productType,
  productSubject,
  productLevel,
  onBack,
}: Props) {
  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={["top", "bottom"]}
    >
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#FFFFFF"
      />

      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={onBack}
          hitSlop={8}
        >
          <ArrowLeft
            size={22}
            color="#0F172A"
            strokeWidth={2}
          />
        </Pressable>

        <View style={styles.headerText}>
          <Text style={styles.title}>
            Komentar
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.scroll}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
      >
        <View
          style={
            styles.productSummary
          }
        >
          <View
            style={
              styles.productCover
            }
          >
            {productCoverUrl ? (
              <Image
                source={{
                  uri: productCoverUrl,
                }}
                style={
                  styles.productCoverImage
                }
                resizeMode="cover"
              />
            ) : (
              <BookOpen
                size={24}
                color="#8FA8D8"
                strokeWidth={1.5}
              />
            )}
          </View>

          <View
            style={
              styles.productInfo
            }
          >
            <Text
              style={
                styles.productSummaryTitle
              }
              numberOfLines={2}
            >
              {productTitle}
            </Text>

            <Text
              style={
                styles.productMeta
              }
              numberOfLines={2}
            >
              {[
                productType,
                productSubject,
                productLevel,
              ]
                .filter(Boolean)
                .join(" \u00B7 ")}
            </Text>
          </View>
        </View>

        <ProductReviewsSection
          productId={productId}
          creatorUserId={creatorUserId}
        />
      </KeyboardAvoidingView>
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
      minHeight: 58,
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: "#E2E8F0",
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: "#FFFFFF",
    },

    backButton: {
      width: 38,
      height: 38,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#F8FAFC",
    },

    headerText: {
      flex: 1,
      minWidth: 0,
    },

    title: {
      fontFamily:
        "PlusJakartaSans_700Bold",
      fontSize: 17,
      color: "#0F172A",
    },

    productSummary: {
      marginHorizontal: 16,
      marginTop: 12,
      padding: 10,
      minHeight: 86,
      borderWidth: 1,
      borderColor: "#E2E8F0",
      borderRadius: 16,
      backgroundColor: "#F8FAFC",
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
    },

    productCover: {
      width: 54,
      height: 68,
      borderRadius: 10,
      overflow: "hidden",
      backgroundColor: "#EEF2F7",
      alignItems: "center",
      justifyContent: "center",
    },

    productCoverImage: {
      width: "100%",
      height: "100%",
    },

    productInfo: {
      flex: 1,
      minWidth: 0,
    },

    productSummaryTitle: {
      fontFamily:
        "PlusJakartaSans_700Bold",
      fontSize: 13,
      lineHeight: 18,
      color: "#0F172A",
    },

    productMeta: {
      marginTop: 5,
      fontFamily:
        "PlusJakartaSans_400Regular",
      fontSize: 10,
      lineHeight: 14,
      color: "#64748B",
    },

    scroll: {
      flex: 1,
    },

    content: {
      paddingBottom: 32,
    },
  });

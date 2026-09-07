import React, {
  useEffect,
  useState,
} from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  MessageCircle,
  Star,
} from "lucide-react-native";

import { supabase } from "../lib/supabase";

type ReviewRow = {
  id: string;
  product_key: string;
  reviewer_user_id: string;
  reviewer_name: string;
  rating: number;
  comment: string;
  created_at: string;
  updated_at: string;
};

type ReplyRow = {
  id: string;
  review_id: string;
  author_user_id: string;
  author_name: string;
  body: string;
  created_at: string;
  updated_at: string;
};

type Props = {
  productId: string;
  creatorUserId: string;
};

const STARS = [1, 2, 3, 4, 5];

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString(
    "id-ID",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  );
}

export default function ProductReviewsSection({
  productId,
  creatorUserId,
}: Props) {
  const [currentUserId, setCurrentUserId] =
    useState<string | null>(null);

  const [reviews, setReviews] =
    useState<ReviewRow[]>([]);

  const [replies, setReplies] =
    useState<ReplyRow[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [rating, setRating] =
    useState(5);

  const [comment, setComment] =
    useState("");

  const [submittingReview, setSubmittingReview] =
    useState(false);

  const [replyDrafts, setReplyDrafts] =
    useState<Record<string, string>>({});

  const [
    replyingReviewId,
    setReplyingReviewId,
  ] = useState<string | null>(null);

  async function loadReviews() {
    setLoading(true);
    setErrorMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      const userId =
        user?.id ?? null;

      setCurrentUserId(userId);

      const {
        data: reviewData,
        error: reviewError,
      } = await supabase
        .from("store_product_reviews")
        .select(
          "id,product_key,reviewer_user_id,reviewer_name,rating,comment,created_at,updated_at"
        )
        .eq("product_key", productId)
        .order("created_at", {
          ascending: false,
        });

      if (reviewError) {
        throw reviewError;
      }

      const reviewRows =
        (reviewData ?? []) as unknown as ReviewRow[];

      setReviews(reviewRows);

      const own =
        userId
          ? reviewRows.find(
              (review) =>
                review.reviewer_user_id ===
                userId
            )
          : undefined;

      if (own) {
        setRating(
          Number(own.rating)
        );

        setComment(
          own.comment
        );
      } else {
        setRating(5);
        setComment("");
      }

      const reviewIds =
        reviewRows.map(
          (review) => review.id
        );

      if (reviewIds.length === 0) {
        setReplies([]);
        return;
      }

      const {
        data: replyData,
        error: replyError,
      } = await supabase
        .from("store_review_replies")
        .select(
          "id,review_id,author_user_id,author_name,body,created_at,updated_at"
        )
        .in("review_id", reviewIds)
        .order("created_at", {
          ascending: true,
        });

      if (replyError) {
        throw replyError;
      }

      setReplies(
        (replyData ?? []) as unknown as ReplyRow[]
      );
    } catch (error) {
      console.error(
        "Gagal memuat ulasan:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Ulasan gagal dimuat."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReviews();
  }, [productId]);

  const isOwner =
    currentUserId === creatorUserId;

  const ownReview =
    currentUserId
      ? reviews.find(
          (review) =>
            review.reviewer_user_id ===
            currentUserId
        )
      : undefined;

  async function submitReview() {
    if (
      !currentUserId ||
      isOwner ||
      submittingReview
    ) {
      return;
    }

    const cleanComment =
      comment.trim();

    if (!cleanComment) {
      setErrorMessage(
        "Tulis komentar atau ulasan terlebih dahulu."
      );
      return;
    }

    setSubmittingReview(true);
    setErrorMessage("");

    try {
      if (ownReview) {
        const {
          error,
        } = await supabase
          .from("store_product_reviews")
          .update({
            rating,
            comment: cleanComment,
          })
          .eq("id", ownReview.id);

        if (error) {
          throw error;
        }
      } else {
        const {
          error,
        } = await supabase
          .from("store_product_reviews")
          .insert({
            product_key: productId,
            rating,
            comment: cleanComment,
          });

        if (error) {
          throw error;
        }

        const {
          error: eventError,
        } = await supabase
          .from("store_product_events")
          .insert({
            product_id: productId,
            user_id: currentUserId,
            event_type:
              "review_submit",
            source: "mobile_store",
            metadata: {
              rating,
            },
          });

        if (eventError) {
          console.warn(
            "Event review_submit gagal:",
            eventError.message
          );
        }
      }

      await loadReviews();
    } catch (error) {
      console.error(
        "Simpan ulasan gagal:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Ulasan gagal disimpan."
      );
    } finally {
      setSubmittingReview(false);
    }
  }

  async function submitReply(
    reviewId: string
  ) {
    if (
      !currentUserId ||
      !isOwner ||
      replyingReviewId
    ) {
      return;
    }

    const body =
      (
        replyDrafts[reviewId] ??
        ""
      ).trim();

    if (!body) {
      setErrorMessage(
        "Tulis balasan terlebih dahulu."
      );
      return;
    }

    setReplyingReviewId(reviewId);
    setErrorMessage("");

    try {
      const {
        error,
      } = await supabase
        .from("store_review_replies")
        .insert({
          review_id: reviewId,
          body,
        });

      if (error) {
        throw error;
      }

      setReplyDrafts(
        (current) => ({
          ...current,
          [reviewId]: "",
        })
      );

      await loadReviews();
    } catch (error) {
      console.error(
        "Balas ulasan gagal:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Balasan gagal dikirim."
      );
    } finally {
      setReplyingReviewId(null);
    }
  }

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          Ulasan & Komentar
        </Text>

        <Text style={styles.reviewCount}>
          {reviews.length > 0
            ? `${reviews.length} ulasan`
            : "Belum ada ulasan"}
        </Text>
      </View>

      {!isOwner ? (
        <View style={styles.form}>
          <View style={styles.starPicker}>
            {STARS.map(
              (value) => (
                <Pressable
                  key={value}
                  hitSlop={6}
                  onPress={() =>
                    setRating(value)
                  }
                >
                  <Star
                    size={27}
                    color="#F3B63F"
                    fill={
                      value <= rating
                        ? "#F3B63F"
                        : "transparent"
                    }
                    strokeWidth={1.8}
                  />
                </Pressable>
              )
            )}
          </View>

          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="Tulis komentar atau ulasan produk..."
            placeholderTextColor="#94A3B8"
            multiline
            maxLength={2000}
            textAlignVertical="top"
            style={styles.commentInput}
          />

          <Pressable
            onPress={submitReview}
            disabled={submittingReview}
            style={[
              styles.submitButton,
              submittingReview &&
                styles.buttonDisabled,
            ]}
          >
            {submittingReview ? (
              <ActivityIndicator
                size="small"
                color="#FFFFFF"
              />
            ) : (
              <Text
                style={
                  styles.submitButtonText
                }
              >
                {ownReview
                  ? "Perbarui Ulasan"
                  : "Kirim Ulasan"}
              </Text>
            )}
          </Pressable>
        </View>
      ) : null}

      {errorMessage ? (
        <Text style={styles.errorText}>
          {errorMessage}
        </Text>
      ) : null}

      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator
            size="small"
            color="#2563EB"
          />

          <Text style={styles.loadingText}>
            Memuat ulasan...
          </Text>
        </View>
      ) : reviews.length === 0 ? (
        <View style={styles.emptyState}>
          <MessageCircle
            size={22}
            color="#CBD5E1"
          />

          <Text style={styles.emptyText}>
            Belum ada komentar atau ulasan.
          </Text>
        </View>
      ) : (
        <View style={styles.reviewList}>
          {reviews.map(
            (review) => {
              const reviewReplies =
                replies.filter(
                  (reply) =>
                    reply.review_id ===
                    review.id
                );

              const hasCreatorReply =
                reviewReplies.some(
                  (reply) =>
                    reply.author_user_id ===
                    creatorUserId
                );

              return (
                <View
                  key={review.id}
                  style={styles.reviewItem}
                >
                  <View
                    style={
                      styles.reviewHeader
                    }
                  >
                    <View style={styles.avatar}>
                      <Text
                        style={
                          styles.avatarText
                        }
                      >
                        {review.reviewer_name
                          .trim()
                          .charAt(0)
                          .toUpperCase() ||
                          "P"}
                      </Text>
                    </View>

                    <View
                      style={
                        styles.reviewerInfo
                      }
                    >
                      <Text
                        style={
                          styles.reviewerName
                        }
                        numberOfLines={1}
                      >
                        {
                          review.reviewer_name
                        }
                      </Text>

                      <Text
                        style={
                          styles.reviewDate
                        }
                      >
                        {formatDate(
                          review.created_at
                        )}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={
                      styles.reviewStars
                    }
                  >
                    {STARS.map(
                      (value) => (
                        <Star
                          key={value}
                          size={14}
                          color="#F3B63F"
                          fill={
                            value <=
                            review.rating
                              ? "#F3B63F"
                              : "transparent"
                          }
                          strokeWidth={1.7}
                        />
                      )
                    )}
                  </View>

                  <Text
                    style={styles.reviewComment}
                  >
                    {review.comment}
                  </Text>

                  {reviewReplies.map(
                    (reply) => (
                      <View
                        key={reply.id}
                        style={
                          styles.creatorReply
                        }
                      >
                        <View
                          style={
                            styles.creatorReplyTop
                          }
                        >
                          <Text
                            style={
                              styles.creatorName
                            }
                          >
                            {
                              reply.author_name
                            }
                          </Text>

                          <View
                            style={
                              styles.creatorBadge
                            }
                          >
                            <Text
                              style={
                                styles.creatorBadgeText
                              }
                            >
                              Kreator
                            </Text>
                          </View>
                        </View>

                        <Text
                          style={
                            styles.replyBody
                          }
                        >
                          {reply.body}
                        </Text>
                      </View>
                    )
                  )}

                  {isOwner &&
                  !hasCreatorReply ? (
                    <View
                      style={
                        styles.replyForm
                      }
                    >
                      <TextInput
                        value={
                          replyDrafts[
                            review.id
                          ] ?? ""
                        }
                        onChangeText={(
                          value
                        ) =>
                          setReplyDrafts(
                            (
                              current
                            ) => ({
                              ...current,
                              [review.id]:
                                value,
                            })
                          )
                        }
                        placeholder="Balas komentar..."
                        placeholderTextColor="#94A3B8"
                        multiline
                        maxLength={1000}
                        style={
                          styles.replyInput
                        }
                      />

                      <Pressable
                        onPress={() =>
                          submitReply(
                            review.id
                          )
                        }
                        disabled={
                          replyingReviewId ===
                          review.id
                        }
                        style={
                          styles.replyButton
                        }
                      >
                        {replyingReviewId ===
                        review.id ? (
                          <ActivityIndicator
                            size="small"
                            color="#2563EB"
                          />
                        ) : (
                          <Text
                            style={
                              styles.replyButtonText
                            }
                          >
                            Balas
                          </Text>
                        )}
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            }
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginHorizontal: 16,
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  sectionTitle: {
    fontFamily:
      "PlusJakartaSans_700Bold",
    fontSize: 14,
    color: "#0F172A",
  },

  reviewCount: {
    fontFamily:
      "PlusJakartaSans_400Regular",
    fontSize: 9.5,
    color: "#94A3B8",
  },

  form: {
    marginTop: 14,
  },

  starPicker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  commentInput: {
    minHeight: 92,
    marginTop: 12,
    paddingHorizontal: 13,
    paddingTop: 12,
    paddingBottom: 12,
    borderWidth: 1,
    borderColor: "#DDE3EC",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    fontFamily:
      "PlusJakartaSans_400Regular",
    fontSize: 11.5,
    lineHeight: 18,
    color: "#0F172A",
  },

  submitButton: {
    alignSelf: "flex-start",
    minWidth: 112,
    height: 40,
    marginTop: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },

  submitButtonText: {
    fontFamily:
      "PlusJakartaSans_600SemiBold",
    fontSize: 10.5,
    color: "#FFFFFF",
  },

  buttonDisabled: {
    opacity: 0.55,
  },

  errorText: {
    marginTop: 10,
    fontFamily:
      "PlusJakartaSans_400Regular",
    fontSize: 10,
    color: "#DC2626",
  },

  loadingState: {
    minHeight: 90,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  loadingText: {
    fontFamily:
      "PlusJakartaSans_400Regular",
    fontSize: 10,
    color: "#64748B",
  },

  emptyState: {
    minHeight: 95,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  emptyText: {
    fontFamily:
      "PlusJakartaSans_400Regular",
    fontSize: 10,
    color: "#94A3B8",
  },

  reviewList: {
    marginTop: 16,
  },

  reviewItem: {
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: "#E8EDF3",
  },

  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EFF6FF",
  },

  avatarText: {
    fontFamily:
      "PlusJakartaSans_700Bold",
    fontSize: 11,
    color: "#2563EB",
  },

  reviewerInfo: {
    flex: 1,
    marginLeft: 9,
  },

  reviewerName: {
    fontFamily:
      "PlusJakartaSans_600SemiBold",
    fontSize: 11,
    color: "#0F172A",
  },

  reviewDate: {
    marginTop: 2,
    fontFamily:
      "PlusJakartaSans_400Regular",
    fontSize: 8.5,
    color: "#94A3B8",
  },

  reviewStars: {
    marginTop: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },

  reviewComment: {
    marginTop: 8,
    fontFamily:
      "PlusJakartaSans_400Regular",
    fontSize: 11.5,
    lineHeight: 18,
    color: "#475569",
  },

  creatorReply: {
    marginTop: 11,
    marginLeft: 14,
    padding: 11,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    borderLeftWidth: 3,
    borderLeftColor: "#2563EB",
  },

  creatorReplyTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  creatorName: {
    fontFamily:
      "PlusJakartaSans_600SemiBold",
    fontSize: 9.5,
    color: "#0F172A",
  },

  creatorBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "#EFF6FF",
  },

  creatorBadgeText: {
    fontFamily:
      "PlusJakartaSans_600SemiBold",
    fontSize: 7.5,
    color: "#2563EB",
  },

  replyBody: {
    marginTop: 5,
    fontFamily:
      "PlusJakartaSans_400Regular",
    fontSize: 10.5,
    lineHeight: 16,
    color: "#475569",
  },

  replyForm: {
    marginTop: 10,
  },

  replyInput: {
    minHeight: 64,
    padding: 10,
    borderWidth: 1,
    borderColor: "#DDE3EC",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    fontFamily:
      "PlusJakartaSans_400Regular",
    fontSize: 10.5,
    lineHeight: 16,
    color: "#0F172A",
  },

  replyButton: {
    alignSelf: "flex-end",
    minWidth: 64,
    height: 32,
    marginTop: 7,
    paddingHorizontal: 12,
    borderRadius: 9,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },

  replyButtonText: {
    fontFamily:
      "PlusJakartaSans_600SemiBold",
    fontSize: 9.5,
    color: "#2563EB",
  },
});

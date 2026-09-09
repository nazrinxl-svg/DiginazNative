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
  Send,
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

const DUMMY_REVIEWS: ReviewRow[] = [
  {
    id: "dummy-review-1",
    product_key: "__dummy__",
    reviewer_user_id: "dummy-user-1",
    reviewer_name: "Mila Rahma",
    rating: 5,
    comment:
      "Materinya rapi dan mudah dipahami. File ini bisa langsung dicetak ukuran A4?",
    created_at: "2026-09-08T10:15:00.000Z",
    updated_at: "2026-09-08T10:15:00.000Z",
  },
  {
    id: "dummy-review-2",
    product_key: "__dummy__",
    reviewer_user_id: "dummy-user-2",
    reviewer_name: "Andi Saputra",
    rating: 5,
    comment:
      "Kalau untuk kelas 4 masih cocok digunakan, Kak?",
    created_at: "2026-09-07T08:30:00.000Z",
    updated_at: "2026-09-07T08:30:00.000Z",
  },
  {
    id: "dummy-review-3",
    product_key: "__dummy__",
    reviewer_user_id: "dummy-user-3",
    reviewer_name: "Rina Wulandari",
    rating: 4,
    comment:
      "Ada versi yang bisa diedit juga? Desainnya bagus dan tidak terlalu ramai.",
    created_at: "2026-09-06T13:45:00.000Z",
    updated_at: "2026-09-06T13:45:00.000Z",
  },
  {
    id: "dummy-review-4",
    product_key: "__dummy__",
    reviewer_user_id: "dummy-user-4",
    reviewer_name: "Budi Pratama",
    rating: 5,
    comment:
      "Gambarnya jelas dan petunjuk kegiatannya mudah diikuti anak.",
    created_at: "2026-09-05T11:20:00.000Z",
    updated_at: "2026-09-05T11:20:00.000Z",
  },
];

function createDummyReplies(
  creatorUserId: string
): ReplyRow[] {
  return [
    {
      id: "dummy-reply-1",
      review_id: "dummy-review-1",
      author_user_id: creatorUserId,
      author_name: "Pembuat Produk",
      body:
        "Bisa, file sudah disiapkan dengan ukuran yang nyaman untuk dicetak.",
      created_at: "2026-09-08T11:00:00.000Z",
      updated_at: "2026-09-08T11:00:00.000Z",
    },
    {
      id: "dummy-reply-2",
      review_id: "dummy-review-2",
      author_user_id: creatorUserId,
      author_name: "Pembuat Produk",
      body:
        "Bisa. Tinggal disesuaikan kembali dengan materi yang sedang dipelajari.",
      created_at: "2026-09-07T09:10:00.000Z",
      updated_at: "2026-09-07T09:10:00.000Z",
    },
  ];
}

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

  const usingDummyReviews = true;

  const visibleReviews =
    usingDummyReviews
      ? DUMMY_REVIEWS
      : reviews;

  const visibleReplies =
    usingDummyReviews
      ? createDummyReplies(creatorUserId)
      : replies;

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
          {visibleReviews.length > 0
            ? `${visibleReviews.length} komentar`
            : "Belum ada komentar"}
        </Text>
      </View>

      {!isOwner ? (
        <View style={styles.form}>
          <View style={styles.ratingRow}>
            <Text style={styles.ratingLabel}>
              Nilai produk
            </Text>

            <View style={styles.starPicker}>
              {STARS.map((value) => (
                <Pressable
                  key={value}
                  hitSlop={6}
                  onPress={() =>
                    setRating(value)
                  }
                >
                  <Star
                    size={18}
                    color="#F3B63F"
                    fill={
                      value <= rating
                        ? "#F3B63F"
                        : "transparent"
                    }
                    strokeWidth={1.8}
                  />
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.composerRow}>
            <View style={styles.composerIcon}>
              <MessageCircle
                size={16}
                color="#64748B"
                strokeWidth={1.8}
              />
            </View>

            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder="Tambahkan komentar..."
              placeholderTextColor="#94A3B8"
              multiline
              maxLength={2000}
              style={styles.commentInput}
            />

            <Pressable
              onPress={submitReview}
              disabled={submittingReview}
              style={[
                styles.sendButton,
                submittingReview &&
                  styles.sendButtonDisabled,
              ]}
            >
              {submittingReview ? (
                <ActivityIndicator
                  size="small"
                  color="#FFFFFF"
                />
              ) : (
                <Send
                  size={16}
                  color="#FFFFFF"
                  strokeWidth={2}
                />
              )}
            </Pressable>
          </View>

          {ownReview ? (
            <Text style={styles.editingHint}>
              Mengirim akan memperbarui ulasanmu.
            </Text>
          ) : null}
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
            Memuat komentar...
          </Text>
        </View>
      ) : visibleReviews.length === 0 ? (
        <View style={styles.emptyState}>
          <MessageCircle
            size={22}
            color="#CBD5E1"
          />

          <Text style={styles.emptyText}>
            Belum ada komentar.
          </Text>
        </View>
      ) : (
        <View style={styles.reviewList}>
          {visibleReviews.map((review) => {
            const reviewReplies =
              visibleReplies.filter(
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
                <View style={styles.reviewRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {review.reviewer_name
                        .trim()
                        .charAt(0)
                        .toUpperCase() || "P"}
                    </Text>
                  </View>

                  <View style={styles.reviewContent}>
                    <View style={styles.reviewTopLine}>
                      <Text
                        style={styles.reviewerName}
                        numberOfLines={1}
                      >
                        {review.reviewer_name}
                      </Text>

                      <View style={styles.reviewStars}>
                        {STARS.map((value) => (
                          <Star
                            key={value}
                            size={11}
                            color="#F3B63F"
                            fill={
                              value <=
                              review.rating
                                ? "#F3B63F"
                                : "transparent"
                            }
                            strokeWidth={1.8}
                          />
                        ))}
                      </View>
                    </View>

                    <Text style={styles.reviewComment}>
                      {review.comment}
                    </Text>

                    <View style={styles.reviewMetaRow}>
                      <Text style={styles.reviewDate}>
                        {formatDate(
                          review.created_at
                        )}
                      </Text>

                      {reviewReplies.length > 0 ||
                      (isOwner &&
                        !hasCreatorReply) ? (
                        <>
                          <Text style={styles.metaDot}>
                            {"\u00B7"}
                          </Text>

                          <Text
                            style={
                              styles.replyMetaText
                            }
                          >
                            {reviewReplies.length > 0
                              ? `${reviewReplies.length} balasan`
                              : "Balas"}
                          </Text>
                        </>
                      ) : null}
                    </View>

                    {reviewReplies.map((reply) => (
                      <View
                        key={reply.id}
                        style={styles.creatorReply}
                      >
                        <View style={styles.replyAvatar}>
                          <Text
                            style={
                              styles.replyAvatarText
                            }
                          >
                            {reply.author_name
                              .trim()
                              .charAt(0)
                              .toUpperCase() || "K"}
                          </Text>
                        </View>

                        <View style={styles.replyContent}>
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
                              {reply.author_name}
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

                          <Text style={styles.replyBody}>
                            {reply.body}
                          </Text>

                          <Text style={styles.replyDate}>
                            {formatDate(
                              reply.created_at
                            )}
                          </Text>
                        </View>
                      </View>
                    ))}

                    {isOwner &&
                    !hasCreatorReply ? (
                      <View style={styles.replyForm}>
                        <TextInput
                          value={
                            replyDrafts[
                              review.id
                            ] ?? ""
                          }
                          onChangeText={(value) =>
                            setReplyDrafts(
                              (current) => ({
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
                          style={styles.replyInput}
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
                          style={[
                            styles.replyButton,
                            replyingReviewId ===
                              review.id &&
                              styles.sendButtonDisabled,
                          ]}
                        >
                          {replyingReviewId ===
                          review.id ? (
                            <ActivityIndicator
                              size="small"
                              color="#FFFFFF"
                            />
                          ) : (
                            <Send
                              size={14}
                              color="#FFFFFF"
                              strokeWidth={2}
                            />
                          )}
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginHorizontal: 16,
    marginTop: 14,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },

  sectionTitle: {
    fontFamily:
      "PlusJakartaSans_700Bold",
    fontSize: 14,
    color: "#0F172A",
  },

  reviewCount: {
    fontFamily:
      "PlusJakartaSans_500Medium",
    fontSize: 9.5,
    color: "#94A3B8",
  },

  form: {
    marginTop: 11,
    marginBottom: 4,
  },

  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },

  ratingLabel: {
    fontFamily:
      "PlusJakartaSans_500Medium",
    fontSize: 10,
    color: "#64748B",
  },

  starPicker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  composerRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 5,
    paddingRight: 5,
    paddingVertical: 4,
    borderRadius: 22,
    backgroundColor: "#F1F5F9",
  },

  composerIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },

  commentInput: {
    flex: 1,
    minHeight: 36,
    maxHeight: 94,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily:
      "PlusJakartaSans_400Regular",
    fontSize: 11,
    lineHeight: 16,
    color: "#0F172A",
  },

  sendButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563EB",
  },

  sendButtonDisabled: {
    opacity: 0.5,
  },

  editingHint: {
    marginTop: 5,
    marginLeft: 10,
    fontFamily:
      "PlusJakartaSans_400Regular",
    fontSize: 8.5,
    color: "#94A3B8",
  },

  errorText: {
    marginTop: 8,
    fontFamily:
      "PlusJakartaSans_400Regular",
    fontSize: 9.5,
    color: "#DC2626",
  },

  loadingState: {
    minHeight: 90,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
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
    marginTop: 7,
  },

  reviewItem: {
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF1F5",
  },

  reviewRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E2E8F0",
  },

  avatarText: {
    fontFamily:
      "PlusJakartaSans_700Bold",
    fontSize: 11,
    color: "#475569",
  },

  reviewContent: {
    flex: 1,
    marginLeft: 10,
  },

  reviewTopLine: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 7,
  },

  reviewerName: {
    fontFamily:
      "PlusJakartaSans_500Medium",
    fontSize: 10.5,
    color: "#7C8594",
  },

  reviewStars: {
    flexDirection: "row",
    alignItems: "center",
    gap: 1,
  },

  reviewComment: {
    marginTop: 3,
    fontFamily:
      "PlusJakartaSans_400Regular",
    fontSize: 14,
    lineHeight: 20,
    color: "#111827",
  },

  reviewMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
    gap: 6,
  },

  reviewDate: {
    fontFamily:
      "PlusJakartaSans_400Regular",
    fontSize: 9,
    color: "#9CA3AF",
  },

  metaDot: {
    fontFamily:
      "PlusJakartaSans_400Regular",
    fontSize: 9,
    color: "#CBD5E1",
  },

  replyMetaText: {
    fontFamily:
      "PlusJakartaSans_600SemiBold",
    fontSize: 9,
    color: "#7C8594",
  },

  creatorReply: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 12,
    marginLeft: 2,
  },

  replyAvatar: {
    width: 27,
    height: 27,
    borderRadius: 13.5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DBEAFE",
  },

  replyAvatarText: {
    fontFamily:
      "PlusJakartaSans_700Bold",
    fontSize: 9,
    color: "#2563EB",
  },

  replyContent: {
    flex: 1,
    marginLeft: 8,
  },

  creatorReplyTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  creatorName: {
    fontFamily:
      "PlusJakartaSans_500Medium",
    fontSize: 9.5,
    color: "#7C8594",
  },

  creatorBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 999,
    backgroundColor: "#EFF6FF",
  },

  creatorBadgeText: {
    fontFamily:
      "PlusJakartaSans_600SemiBold",
    fontSize: 7,
    color: "#2563EB",
  },

  replyBody: {
    marginTop: 2,
    fontFamily:
      "PlusJakartaSans_400Regular",
    fontSize: 14,
    lineHeight: 20,
    color: "#111827",
  },

  replyDate: {
    marginTop: 4,
    fontFamily:
      "PlusJakartaSans_400Regular",
    fontSize: 8.5,
    color: "#9CA3AF",
  },

  replyForm: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    paddingLeft: 11,
    paddingRight: 4,
    paddingVertical: 3,
    borderRadius: 19,
    backgroundColor: "#F1F5F9",
  },

  replyInput: {
    flex: 1,
    minHeight: 32,
    maxHeight: 76,
    paddingVertical: 6,
    paddingRight: 8,
    fontFamily:
      "PlusJakartaSans_400Regular",
    fontSize: 10,
    lineHeight: 15,
    color: "#0F172A",
  },

  replyButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563EB",
  },
});

import React, {
  useEffect,
  useState,
} from "react";
import {
  ActivityIndicator,
  Modal,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  MessageCircle,
  Send,
  Smile,
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
  sticker_key?: string | null;
  created_at: string;
  updated_at: string;
};

type ReplyRow = {
  id: string;
  review_id: string;
  author_user_id: string;
  author_name: string;
  body: string;
  sticker_key?: string | null;
  created_at: string;
  updated_at: string;
};

type Props = {
  productId: string;
  creatorUserId: string;
};

const STARS = [1, 2, 3, 4, 5];

const QUICK_EMOJIS = [
  "\u{1F600}",
  "\u{1F603}",
  "\u{1F604}",
  "\u{1F601}",
  "\u{1F606}",
  "\u{1F605}",
  "\u{1F602}",
  "\u{1F923}",
  "\u{1F60A}",
  "\u{1F607}",
  "\u{1F642}",
  "\u{1F609}",
  "\u{1F60D}",
  "\u{1F970}",
  "\u{1F618}",
  "\u{1F60E}",
  "\u{1F914}",
  "\u{1F62E}",
  "\u{1F622}",
  "\u{1F62D}",
  "\u{1F621}",
  "\u{1F973}",
  "\u{1F44D}",
  "\u{1F44F}",
  "\u{1F64F}",
  "\u{1F91D}",
  "\u{1F4AA}",
  "\u{1F525}",
  "\u{2764}\u{FE0F}",
  "\u{1F499}",
  "\u{1F49A}",
  "\u{1F49B}",
  "\u{1F49C}",
  "\u{1F90D}",
  "\u{2728}",
  "\u{1F31F}",
  "\u{1F389}",
  "\u{1F38A}",
  "\u{2705}",
  "\u{1F4AF}",
  "\u{1F4A1}",
  "\u{1F4DA}",
  "\u{1F58A}\u{FE0F}",
  "\u{1F4D6}",
  "\u{1F3AF}",
  "\u{1F680}",
  "\u{2615}",
  "\u{1F339}",
  "\u{1F33A}",
  "\u{1F33F}",
  "\u{1F319}",
  "\u{2600}\u{FE0F}",
  "\u{1F44C}",
  "\u{1F91F}",
  "\u{1F917}",
  "\u{1F60C}",
];

const STICKERS = [
  {
    key: "mantap",
    emoji: "\u{1F44D}",
    label: "Mantap!",
  },
  {
    key: "suka",
    emoji: "\u{2764}\u{FE0F}",
    label: "Suka!",
  },
  {
    key: "haha",
    emoji: "\u{1F602}",
    label: "Haha",
  },
  {
    key: "wow",
    emoji: "\u{1F62E}",
    label: "Wow!",
  },
  {
    key: "makasih",
    emoji: "\u{1F64F}",
    label: "Makasih",
  },
  {
    key: "semangat",
    emoji: "\u{1F525}",
    label: "Semangat!",
  },
  {
    key: "bagus",
    emoji: "\u{2728}",
    label: "Bagus!",
  },
  {
    key: "setuju",
    emoji: "\u{2705}",
    label: "Setuju",
  },
  {
    key: "doa",
    emoji: "\u{1F932}",
    label: "Doa",
  },
  {
    key: "selamat",
    emoji: "\u{1F389}",
    label: "Selamat!",
  },
] as const;

type StickerKey =
  (typeof STICKERS)[number]["key"];

function stickerForKey(
  key?: string | null
) {
  return STICKERS.find(
    sticker =>
      sticker.key === key
  );
}

function StickerCard({
  stickerKey,
}: {
  stickerKey: string;
}) {
  const sticker =
    stickerForKey(stickerKey);

  if (!sticker) {
    return null;
  }

  return (
    <View
      style={
        styles.stickerMessage
      }
    >
      <Text
        style={
          styles.stickerMessageEmoji
        }
      >
        {sticker.emoji}
      </Text>

      <Text
        style={
          styles.stickerMessageLabel
        }
      >
        {sticker.label}
      </Text>
    </View>
  );
}

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

function formatDate(
  value: string
) {
  const timestamp =
    new Date(value).getTime();

  if (
    Number.isNaN(timestamp)
  ) {
    return "";
  }

  const diffMs =
    Math.max(
      0,
      Date.now() - timestamp
    );

  const seconds =
    Math.floor(
      diffMs / 1000
    );

  if (seconds < 45) {
    return "baru saja";
  }

  const minutes =
    Math.floor(
      seconds / 60
    );

  if (minutes < 60) {
    return `${minutes} mnt`;
  }

  const hours =
    Math.floor(
      minutes / 60
    );

  if (hours < 24) {
    return `${hours} j`;
  }

  const days =
    Math.floor(
      hours / 24
    );

  if (days < 7) {
    return `${days} h`;
  }

  const weeks =
    Math.floor(
      days / 7
    );

  if (weeks < 5) {
    return `${weeks} mgg`;
  }

  const months =
    Math.floor(
      days / 30
    );

  if (months < 12) {
    return `${months} bln`;
  }

  const years =
    Math.floor(
      days / 365
    );

  return `${years} thn`;
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

  const commentInputRef =
    React.useRef<TextInput>(null);

  const [
    showEmojiPicker,
    setShowEmojiPicker,
  ] = useState(false);

  const [
    pickerTab,
    setPickerTab,
  ] = useState<
    "emoji" | "sticker"
  >("emoji");

  const [
    commentStickerKey,
    setCommentStickerKey,
  ] = useState<StickerKey | null>(
    null
  );

  const [
    replyStickerKeys,
    setReplyStickerKeys,
  ] = useState<
    Record<string, StickerKey | null>
  >({});

  const [
    ,
    setRelativeTimeTick,
  ] = useState(0);

  useEffect(() => {
    const timer =
      setInterval(
        () => {
          setRelativeTimeTick(
            current =>
              current + 1
          );
        },
        30000
      );

    return () => {
      clearInterval(timer);
    };
  }, []);

  const [submittingReview, setSubmittingReview] =
    useState(false);

  const [replyDrafts, setReplyDrafts] =
    useState<Record<string, string>>({});

  const [
    replyingReviewId,
    setReplyingReviewId,
  ] = useState<string | null>(null);

  const [
    activeReplyReviewId,
    setActiveReplyReviewId,
  ] = useState<string | null>(null);

  const [
    editingReviewId,
    setEditingReviewId,
  ] = useState<string | null>(null);

  const [
    editingReplyId,
    setEditingReplyId,
  ] = useState<string | null>(null);

  const [
    deletingItemKey,
    setDeletingItemKey,
  ] = useState<string | null>(null);

  const [
    pendingDelete,
    setPendingDelete,
  ] = useState<{
    type: "review" | "reply";
    id: string;
  } | null>(null);

  const [
    openActionKey,
    setOpenActionKey,
  ] = useState<string | null>(null);

  async function loadReviews(
    silent = false
  ) {
    if (!silent) {
      setLoading(true);
    }

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
          "id,product_key,reviewer_user_id,reviewer_name,rating,comment,sticker_key,created_at,updated_at"
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

      setRating(5);
      setComment("");

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
          "id,review_id,author_user_id,author_name,body,sticker_key,created_at,updated_at"
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
      if (!silent) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    loadReviews();
  }, [productId]);

  const isOwner =
    currentUserId === creatorUserId;

  const usingDummyReviews = false;

  const visibleReviews =
    usingDummyReviews
      ? DUMMY_REVIEWS
      : reviews;

  const visibleReplies =
    usingDummyReviews
      ? createDummyReplies(creatorUserId)
      : replies;

  function selectSticker(
    stickerKey: StickerKey
  ) {
    if (activeReplyReviewId) {
      setReplyStickerKeys(
        current => ({
          ...current,
          [activeReplyReviewId]:
            stickerKey,
        })
      );

      return;
    }

    setCommentStickerKey(
      stickerKey
    );
  }

  function toggleEmojiPanel() {
    setShowEmojiPicker(
      current => {
        const next =
          !current;

        if (next) {
          Keyboard.dismiss();
        }

        return next;
      }
    );
  }

  function appendEmoji(
    emoji: string
  ) {
    if (activeReplyReviewId) {
      setReplyDrafts(
        current => ({
          ...current,
          [activeReplyReviewId]:
            (
              (
                current[
                  activeReplyReviewId
                ] ?? ""
              ) +
              emoji
            ).slice(
              0,
              1000
            ),
        })
      );

      return;
    }

    setComment(
      current =>
        (
          current +
          emoji
        ).slice(
          0,
          2000
        )
    );
  }

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

    if (
      !cleanComment &&
      !commentStickerKey
    ) {
      setErrorMessage(
        "Tulis komentar atau pilih stiker terlebih dahulu."
      );
      return;
    }

    setSubmittingReview(true);
    setErrorMessage("");

    try {
      const {
        error,
      } = await supabase
        .from("store_product_reviews")
        .insert({
          product_key: productId,
          rating,
          comment: cleanComment,
          sticker_key:
            commentStickerKey,
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

      /*
       * MULTI_COMMENT:
       * komentar yang baru dikirim selesai,
       * composer kembali kosong.
       */
      setComment("");
      setCommentStickerKey(null);
      setRating(5);
      setPickerTab("emoji");
      setShowEmojiPicker(false);

      await loadReviews(true);
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
      replyingReviewId
    ) {
      return;
    }

    const body =
      (
        replyDrafts[reviewId] ??
        ""
      ).trim();

    const replyStickerKey =
      replyStickerKeys[
        reviewId
      ] ?? null;

    if (
      !body &&
      !replyStickerKey
    ) {
      setErrorMessage(
        "Tulis balasan atau pilih stiker terlebih dahulu."
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
          sticker_key:
            replyStickerKey,
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

      setReplyStickerKeys(
        current => ({
          ...current,
          [reviewId]: null,
        })
      );

      setPickerTab("emoji");
      setShowEmojiPicker(false);

      setActiveReplyReviewId(
        null
      );

      await loadReviews(true);
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

  function focusCommentComposer() {
    requestAnimationFrame(
      () => {
        requestAnimationFrame(
          () => {
            commentInputRef
              .current
              ?.focus();
          }
        );
      }
    );
  }

  function startEditReview(
    review: ReviewRow
  ) {
    if (
      !currentUserId ||
      review.reviewer_user_id !==
        currentUserId
    ) {
      return;
    }

    setOpenActionKey(null);
    setEditingReplyId(null);
    setEditingReviewId(review.id);
    setActiveReplyReviewId(null);

    setComment(
      review.comment
    );

    setCommentStickerKey(
      stickerForKey(
        review.sticker_key
      )?.key ?? null
    );

    setShowEmojiPicker(false);
    setPickerTab("emoji");
    setErrorMessage("");

    focusCommentComposer();
  }

  function startEditReply(
    reply: ReplyRow
  ) {
    if (
      !currentUserId ||
      reply.author_user_id !==
        currentUserId
    ) {
      return;
    }

    setOpenActionKey(null);
    setEditingReviewId(null);
    setEditingReplyId(reply.id);

    setActiveReplyReviewId(
      reply.review_id
    );

    setReplyDrafts(
      current => ({
        ...current,
        [reply.review_id]:
          reply.body,
      })
    );

    setReplyStickerKeys(
      current => ({
        ...current,
        [reply.review_id]:
          stickerForKey(
            reply.sticker_key
          )?.key ?? null,
      })
    );

    setShowEmojiPicker(false);
    setPickerTab("emoji");
    setErrorMessage("");

    focusCommentComposer();
  }

  function cancelEdit() {
    if (editingReviewId) {
      setComment("");
      setCommentStickerKey(null);
    }

    if (
      editingReplyId &&
      activeReplyReviewId
    ) {
      const reviewId =
        activeReplyReviewId;

      setReplyDrafts(
        current => ({
          ...current,
          [reviewId]: "",
        })
      );

      setReplyStickerKeys(
        current => ({
          ...current,
          [reviewId]: null,
        })
      );
    }

    setEditingReviewId(null);
    setEditingReplyId(null);
    setActiveReplyReviewId(null);

    setPickerTab("emoji");
    setShowEmojiPicker(false);
    setErrorMessage("");
  }

  async function updateOwnReview(
    reviewId: string
  ) {
    if (
      !currentUserId ||
      editingReviewId !== reviewId ||
      submittingReview
    ) {
      return;
    }

    const target =
      reviews.find(
        item =>
          item.id === reviewId
      );

    if (
      !target ||
      target.reviewer_user_id !==
        currentUserId
    ) {
      return;
    }

    const cleanComment =
      comment.trim();

    if (
      !cleanComment &&
      !commentStickerKey
    ) {
      setErrorMessage(
        "Komentar tidak boleh kosong."
      );
      return;
    }

    setSubmittingReview(true);
    setErrorMessage("");

    try {
      const {
        error,
      } = await supabase
        .from(
          "store_product_reviews"
        )
        .update({
          comment:
            cleanComment,
          sticker_key:
            commentStickerKey,
        })
        .eq(
          "id",
          reviewId
        )
        .eq(
          "reviewer_user_id",
          currentUserId
        );

      if (error) {
        throw error;
      }

      setEditingReviewId(null);
      setComment("");
      setCommentStickerKey(null);
      setPickerTab("emoji");
      setShowEmojiPicker(false);

      await loadReviews(true);
    } catch (error) {
      console.error(
        "Edit komentar gagal:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Komentar gagal diedit."
      );
    } finally {
      setSubmittingReview(false);
    }
  }

  async function updateOwnReply(
    replyId: string,
    reviewId: string
  ) {
    if (
      !currentUserId ||
      editingReplyId !== replyId ||
      replyingReviewId
    ) {
      return;
    }

    const target =
      replies.find(
        item =>
          item.id === replyId
      );

    if (
      !target ||
      target.author_user_id !==
        currentUserId
    ) {
      return;
    }

    const body =
      (
        replyDrafts[
          reviewId
        ] ?? ""
      ).trim();

    const stickerKey =
      replyStickerKeys[
        reviewId
      ] ?? null;

    if (
      !body &&
      !stickerKey
    ) {
      setErrorMessage(
        "Balasan tidak boleh kosong."
      );
      return;
    }

    setReplyingReviewId(
      reviewId
    );

    setErrorMessage("");

    try {
      const {
        error,
      } = await supabase
        .from(
          "store_review_replies"
        )
        .update({
          body,
          sticker_key:
            stickerKey,
        })
        .eq(
          "id",
          replyId
        )
        .eq(
          "author_user_id",
          currentUserId
        );

      if (error) {
        throw error;
      }

      setReplyDrafts(
        current => ({
          ...current,
          [reviewId]: "",
        })
      );

      setReplyStickerKeys(
        current => ({
          ...current,
          [reviewId]: null,
        })
      );

      setEditingReplyId(null);
      setActiveReplyReviewId(null);
      setPickerTab("emoji");
      setShowEmojiPicker(false);

      await loadReviews(true);
    } catch (error) {
      console.error(
        "Edit balasan gagal:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Balasan gagal diedit."
      );
    } finally {
      setReplyingReviewId(null);
    }
  }

  async function performDeleteReview(
    reviewId: string
  ) {
    if (!currentUserId) {
      return;
    }

    const target =
      reviews.find(
        item =>
          item.id === reviewId
      );

    if (
      !target ||
      target.reviewer_user_id !==
        currentUserId
    ) {
      return;
    }

    const busyKey =
      `review:${reviewId}`;

    setDeletingItemKey(
      busyKey
    );

    try {
      const {
        error,
      } = await supabase
        .from(
          "store_product_reviews"
        )
        .delete()
        .eq(
          "id",
          reviewId
        )
        .eq(
          "reviewer_user_id",
          currentUserId
        );

      if (error) {
        throw error;
      }

      if (
        editingReviewId ===
        reviewId
      ) {
        cancelEdit();
      }

      await loadReviews(true);
    } catch (error) {
      console.error(
        "Hapus komentar gagal:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Komentar gagal dihapus."
      );
    } finally {
      setDeletingItemKey(null);
    }
  }

  function confirmDeleteReview(
    review: ReviewRow
  ) {
    if (
      !currentUserId ||
      review.reviewer_user_id !==
        currentUserId
    ) {
      return;
    }

    setPendingDelete({
      type: "review",
      id: review.id,
    });
  }

  async function performDeleteReply(
    replyId: string
  ) {
    if (!currentUserId) {
      return;
    }

    const target =
      replies.find(
        item =>
          item.id === replyId
      );

    if (
      !target ||
      target.author_user_id !==
        currentUserId
    ) {
      return;
    }

    const busyKey =
      `reply:${replyId}`;

    setDeletingItemKey(
      busyKey
    );

    try {
      const {
        error,
      } = await supabase
        .from(
          "store_review_replies"
        )
        .delete()
        .eq(
          "id",
          replyId
        )
        .eq(
          "author_user_id",
          currentUserId
        );

      if (error) {
        throw error;
      }

      if (
        editingReplyId ===
        replyId
      ) {
        cancelEdit();
      }

      await loadReviews(true);
    } catch (error) {
      console.error(
        "Hapus balasan gagal:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Balasan gagal dihapus."
      );
    } finally {
      setDeletingItemKey(null);
    }
  }

  function confirmDeleteReply(
    reply: ReplyRow
  ) {
    if (
      !currentUserId ||
      reply.author_user_id !==
        currentUserId
    ) {
      return;
    }

    setPendingDelete({
      type: "reply",
      id: reply.id,
    });
  }

  const activeComposerStickerKey =
    activeReplyReviewId
      ? (
          replyStickerKeys[
            activeReplyReviewId
          ] ?? null
        )
      : commentStickerKey;

  const activeComposerSticker =
    stickerForKey(
      activeComposerStickerKey
    );

  const activeComposerText =
    activeReplyReviewId
      ? (
          replyDrafts[
            activeReplyReviewId
          ] ?? ""
        )
      : comment;

  const activeComposerHasContent =
    Boolean(
      activeComposerText.trim() ||
      activeComposerStickerKey
    );

  const activeComposerBusy =
    activeReplyReviewId
      ? (
          replyingReviewId ===
          activeReplyReviewId
        )
      : submittingReview;

  function clearCurrentSticker() {
    if (activeReplyReviewId) {
      setReplyStickerKeys(
        current => ({
          ...current,
          [activeReplyReviewId]:
            null,
        })
      );

      return;
    }

    setCommentStickerKey(null);
  }

  return (
    <View style={styles.section}>
      <ScrollView
        style={
          styles.reviewScroll
        }
        contentContainerStyle={
          styles.reviewScrollContent
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
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
                    <View
                      style={
                        styles.reviewTopLine
                      }
                    >
                      <Text
                        style={
                          styles.reviewAuthor
                        }
                        numberOfLines={1}
                      >
                        {review.reviewer_name}
                      </Text>
                    </View>

                    <Pressable
                      onLongPress={() => {
                        if (
                          review.reviewer_user_id !==
                          currentUserId
                        ) {
                          return;
                        }

                        const key =
                          `review:${review.id}`;

                        setOpenActionKey(
                          current =>
                            current === key
                              ? null
                              : key
                        );
                      }}
                      delayLongPress={450}
                    >
                    {review.comment.trim() ? (
                      <Text
                        style={
                          styles.reviewComment
                        }
                      >
                        {review.comment}
                      </Text>
                    ) : null}

                    {review.sticker_key ? (
                      <StickerCard
                        stickerKey={
                          review.sticker_key
                        }
                      />
                    ) : null}

                    </Pressable>

                    <View style={styles.reviewMetaRow}>
                      <Text style={styles.reviewDate}>
                        {formatDate(
                          review.created_at
                        )}
                      </Text>

                      {currentUserId ? (
                        <>
                          <Pressable
                            onPress={() => {
                              const sameReply =
                                activeReplyReviewId ===
                                review.id;

                              if (
                                editingReviewId ||
                                editingReplyId
                              ) {
                                cancelEdit();
                              }

                              setActiveReplyReviewId(
                                sameReply
                                  ? null
                                  : review.id
                              );

                              setShowEmojiPicker(
                                false
                              );

                              if (!sameReply) {
                                requestAnimationFrame(
                                  () => {
                                    requestAnimationFrame(
                                      () => {
                                        commentInputRef
                                          .current
                                          ?.focus();
                                      }
                                    );
                                  }
                                );
                              }
                            }}
                            hitSlop={6}
                          >
                            <Text
                              style={
                                styles.replyMetaText
                              }
                            >
                              Balas
                            </Text>
                          </Pressable>

                          {review.reviewer_user_id ===
                          currentUserId &&
                          openActionKey ===
                            `review:${review.id}` ? (
                            <>
                              <Pressable
                                onPress={() =>
                                  startEditReview(
                                    review
                                  )
                                }
                                hitSlop={6}
                              >
                                <Text
                                  style={
                                    styles.replyMetaText
                                  }
                                >
                                  Edit
                                </Text>
                              </Pressable>

                              <Pressable
                                onPress={() =>
                                  confirmDeleteReview(
                                    review
                                  )
                                }
                                disabled={
                                  deletingItemKey ===
                                  `review:${review.id}`
                                }
                                hitSlop={6}
                              >
                                <Text
                                  style={
                                    styles.deleteMetaText
                                  }
                                >
                                  {deletingItemKey ===
                                  `review:${review.id}`
                                    ? "..."
                                    : "Hapus"}
                                </Text>
                              </Pressable>
                            </>
                          ) : null}

                          {reviewReplies.length > 0 ? (
                            <>
                              <Text
                                style={
                                  styles.replyMetaText
                                }
                              >
                                {reviewReplies.length} balasan
                              </Text>
                            </>
                          ) : null}
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

                            {reply.author_user_id ===
                            creatorUserId ? (
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
                            ) : null}
                          </View>

                          <Pressable
                            onLongPress={() => {
                              if (
                                reply.author_user_id !==
                                currentUserId
                              ) {
                                return;
                              }

                              const key =
                                `reply:${reply.id}`;

                              setOpenActionKey(
                                current =>
                                  current === key
                                    ? null
                                    : key
                              );
                            }}
                            delayLongPress={450}
                          >
                          {reply.body.trim() ? (
                            <Text
                              style={
                                styles.replyBody
                              }
                            >
                              {reply.body}
                            </Text>
                          ) : null}

                          {reply.sticker_key ? (
                            <StickerCard
                              stickerKey={
                                reply.sticker_key
                              }
                            />
                          ) : null}

                          </Pressable>

                          <View
                            style={
                              styles.reviewMetaRow
                            }
                          >
                            <Text
                              style={
                                styles.replyDate
                              }
                            >
                              {formatDate(
                                reply.created_at
                              )}
                            </Text>

                            {reply.author_user_id ===
                            currentUserId &&
                            openActionKey ===
                              `reply:${reply.id}` ? (
                              <>
                                <Pressable
                                  onPress={() =>
                                    startEditReply(
                                      reply
                                    )
                                  }
                                  hitSlop={6}
                                >
                                  <Text
                                    style={
                                      styles.replyMetaText
                                    }
                                  >
                                    Edit
                                  </Text>
                                </Pressable>

                                <Pressable
                                  onPress={() =>
                                    confirmDeleteReply(
                                      reply
                                    )
                                  }
                                  disabled={
                                    deletingItemKey ===
                                    `reply:${reply.id}`
                                  }
                                  hitSlop={6}
                                >
                                  <Text
                                    style={
                                      styles.deleteMetaText
                                    }
                                  >
                                    {deletingItemKey ===
                                    `reply:${reply.id}`
                                      ? "..."
                                      : "Hapus"}
                                  </Text>
                                </Pressable>
                              </>
                            ) : null}
                          </View>
                        </View>
                      </View>
                    ))}


                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}
      </ScrollView>

      {!isOwner ||
      activeReplyReviewId ||
      editingReviewId ||
      editingReplyId ? (
        <View style={styles.form}>
          {editingReviewId ||
          editingReplyId ? (
            <View
              style={
                styles.editingBar
              }
            >
              <Text
                style={
                  styles.editingBarText
                }
              >
                {editingReplyId
                  ? "Mengedit balasan"
                  : "Mengedit komentar"}
              </Text>

              <Pressable
                onPress={
                  cancelEdit
                }
                hitSlop={6}
              >
                <Text
                  style={
                    styles.editingBarCancel
                  }
                >
                  Batal
                </Text>
              </Pressable>
            </View>
          ) : null}


          <View
            style={
              styles.commentComposer
            }
          >
            {activeComposerSticker ? (
            <View
              style={
                styles.selectedSticker
              }
            >
              <Text
                style={
                  styles.selectedStickerEmoji
                }
              >
                {
                  activeComposerSticker.emoji
                }
              </Text>

              <Text
                style={
                  styles.selectedStickerLabel
                }
              >
                {
                  activeComposerSticker.label
                }
              </Text>

              <Pressable
                onPress={
                  clearCurrentSticker
                }
                style={
                  styles.selectedStickerClose
                }
                hitSlop={6}
              >
                <Text
                  style={
                    styles.selectedStickerCloseText
                  }
                >
                  {"\u00D7"}
                </Text>
              </Pressable>
            </View>
          ) : null}

          <View
              style={
                styles.commentInputShell
              }
            >
              <TextInput
                ref={commentInputRef}
                value={
                  activeReplyReviewId
                    ? (
                        replyDrafts[
                          activeReplyReviewId
                        ] ?? ""
                      )
                    : comment
                }
                onChangeText={(value) => {
                  if (
                    activeReplyReviewId
                  ) {
                    setReplyDrafts(
                      current => ({
                        ...current,
                        [
                          activeReplyReviewId
                        ]: value,
                      })
                    );

                    return;
                  }

                  setComment(value);
                }}
                onFocus={() =>
                  setShowEmojiPicker(
                    false
                  )
                }
                placeholder={
                  editingReplyId
                    ? "Edit balasan..."
                    : editingReviewId
                      ? "Edit komentar..."
                      : activeReplyReviewId
                        ? "Tulis balasan..."
                        : "Tambahkan komentar..."
                }
                placeholderTextColor="#9CA3AF"
                multiline
                maxLength={
                  activeReplyReviewId
                    ? 1000
                    : 2000
                }
                style={
                  styles.commentInput
                }
              />

              <Pressable
                onPress={
                  toggleEmojiPanel
                }
                hitSlop={4}
                style={({ pressed }) => [
                  styles.commentComposerIconButton,
                  showEmojiPicker &&
                    styles.commentComposerIconButtonActive,
                  pressed &&
                    styles.commentComposerPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Emoji"
              >
                <Smile
                  size={21}
                  strokeWidth={1.8}
                  color={
                    showEmojiPicker
                      ? "#2563EB"
                      : "#475569"
                  }
                />
              </Pressable>

              <Pressable
                onPress={() => {
                  if (
                    editingReplyId &&
                    activeReplyReviewId
                  ) {
                    void updateOwnReply(
                      editingReplyId,
                      activeReplyReviewId
                    );
                    return;
                  }

                  if (editingReviewId) {
                    void updateOwnReview(
                      editingReviewId
                    );
                    return;
                  }

                  if (
                    activeReplyReviewId
                  ) {
                    void submitReply(
                      activeReplyReviewId
                    );
                    return;
                  }

                  void submitReview();
                }}
                disabled={
                  !activeComposerHasContent ||
                  activeComposerBusy
                }
                style={[
                  styles.sendButton,
                  (
                    !activeComposerHasContent ||
                    activeComposerBusy
                  ) &&
                    styles.sendButtonDisabled,
                ]}
              >
                {activeComposerBusy ? (
                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />
                ) : (
                  <Send
                    size={18}
                    color="#FFFFFF"
                    strokeWidth={1.9}
                  />
                )}
              </Pressable>
            </View>
          </View>

          {showEmojiPicker ? (
            <View
              style={
                styles.emojiPicker
              }
            >
              <View
                style={
                  styles.pickerTabs
                }
              >
                <Pressable
                  onPress={() =>
                    setPickerTab("emoji")
                  }
                  style={[
                    styles.pickerTab,
                    pickerTab ===
                      "emoji" &&
                      styles.pickerTabActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.pickerTabText,
                      pickerTab ===
                        "emoji" &&
                        styles.pickerTabTextActive,
                    ]}
                  >
                    Emoji
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() =>
                    setPickerTab("sticker")
                  }
                  style={[
                    styles.pickerTab,
                    pickerTab ===
                      "sticker" &&
                      styles.pickerTabActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.pickerTabText,
                      pickerTab ===
                        "sticker" &&
                        styles.pickerTabTextActive,
                    ]}
                  >
                    Stiker
                  </Text>
                </Pressable>
              </View>

              {pickerTab === "emoji" ? (
                <View
                  style={
                    styles.emojiGrid
                  }
                >
                  {QUICK_EMOJIS.map(
                    emoji => (
                      <Pressable
                        key={emoji}
                        style={
                          styles.emojiButton
                        }
                        onPress={() =>
                          appendEmoji(
                            emoji
                          )
                        }
                      >
                        <Text
                          style={
                            styles.emojiText
                          }
                        >
                          {emoji}
                        </Text>
                      </Pressable>
                    )
                  )}
                </View>
              ) : (
                <View
                  style={
                    styles.stickerGrid
                  }
                >
                  {STICKERS.map(
                    sticker => (
                      <Pressable
                        key={
                          sticker.key
                        }
                        onPress={() =>
                          selectSticker(
                            sticker.key
                          )
                        }
                        style={[
                          styles.stickerButton,
                          activeComposerStickerKey ===
                            sticker.key &&
                            styles.stickerButtonSelected,
                        ]}
                      >
                        <Text
                          style={
                            styles.stickerEmoji
                          }
                        >
                          {sticker.emoji}
                        </Text>

                        <Text
                          style={
                            styles.stickerLabel
                          }
                        >
                          {sticker.label}
                        </Text>
                      </Pressable>
                    )
                  )}
                </View>
              )}
            </View>
          ) : null}
        </View>
      ) : null}

      <Modal
        transparent
        statusBarTranslucent
        animationType="fade"
        visible={
          pendingDelete !== null
        }
        onRequestClose={() => {
          if (!deletingItemKey) {
            setPendingDelete(null);
          }
        }}
      >
        <View
          style={
            styles.deleteModalBackdrop
          }
        >
          <View
            style={
              styles.deleteModalCard
            }
          >
            <View
              style={
                styles.deleteModalIcon
              }
            >
              <Text
                style={
                  styles.deleteModalIconText
                }
              >
                {"\u{1F5D1}\u{FE0F}"}
              </Text>
            </View>

            <Text
              style={
                styles.deleteModalTitle
              }
            >
              {pendingDelete?.type ===
              "reply"
                ? "Hapus balasan?"
                : "Hapus komentar?"}
            </Text>

            <Text
              style={
                styles.deleteModalDescription
              }
            >
              {pendingDelete?.type ===
              "reply"
                ? "Balasan ini akan dihapus secara permanen."
                : "Komentar ini dan seluruh balasannya akan dihapus secara permanen."}
            </Text>

            <View
              style={
                styles.deleteModalActions
              }
            >
              <Pressable
                style={
                  styles.deleteModalCancel
                }
                disabled={
                  Boolean(
                    deletingItemKey
                  )
                }
                onPress={() => {
                  if (!deletingItemKey) {
                    setPendingDelete(null);
                  }
                }}
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
                  styles.deleteModalConfirm
                }
                disabled={
                  Boolean(
                    deletingItemKey
                  )
                }
                onPress={() => {
                  const target =
                    pendingDelete;

                  if (
                    !target ||
                    deletingItemKey
                  ) {
                    return;
                  }

                  void (async () => {
                    if (
                      target.type ===
                      "review"
                    ) {
                      await performDeleteReview(
                        target.id
                      );
                    } else {
                      await performDeleteReply(
                        target.id
                      );
                    }

                    setPendingDelete(
                      null
                    );
                  })();
                }}
              >
                {deletingItemKey ? (
                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />
                ) : (
                  <Text
                    style={
                      styles.deleteModalConfirmText
                    }
                  >
                    Hapus
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

</View>
  );
}

const styles = StyleSheet.create({
  deleteModalBackdrop: {
    flex: 1,
    paddingHorizontal: 24,
    backgroundColor:
      "rgba(15, 23, 42, 0.48)",
    alignItems: "center",
    justifyContent: "center",
  },

  deleteModalCard: {
    width: "100%",
    maxWidth: 360,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 18,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },

  deleteModalIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    marginBottom: 14,
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
  },

  deleteModalIconText: {
    fontSize: 24,
    lineHeight: 30,
  },

  deleteModalTitle: {
    fontFamily:
      "PlusJakartaSans_700Bold",
    fontSize: 17,
    color: "#0F172A",
    textAlign: "center",
  },

  deleteModalDescription: {
    marginTop: 7,
    fontFamily:
      "PlusJakartaSans_400Regular",
    fontSize: 12,
    lineHeight: 18,
    color: "#64748B",
    textAlign: "center",
  },

  deleteModalActions: {
    width: "100%",
    marginTop: 22,
    flexDirection: "row",
    gap: 10,
  },

  deleteModalCancel: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },

  deleteModalCancelText: {
    fontFamily:
      "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: "#475569",
  },

  deleteModalConfirm: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
  },

  deleteModalConfirmText: {
    fontFamily:
      "PlusJakartaSans_700Bold",
    fontSize: 12,
    color: "#FFFFFF",
  },

  section: {
    flex: 1,
    minHeight: 0,
    backgroundColor: "#FFFFFF",
  },

  reviewScroll: {
    flex: 1,
  },

  reviewScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
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
    flexShrink: 0,
    marginTop: 0,
    marginBottom: 0,
    paddingHorizontal: 12,
    paddingTop: 7,
    paddingBottom: 7,
    borderTopWidth: 1,
    borderTopColor: "#EEF1F5",
    backgroundColor: "#FFFFFF",
  },

  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: 10,
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

  commentComposer: {
    width: "100%",
  },

  commentInputShell: {
    width: "100%",
    minHeight: 46,
    paddingLeft: 2,
    paddingRight: 4,
    borderWidth: 0,
    borderRadius: 23,
    backgroundColor: "#F3F4F6",
    flexDirection: "row",
    alignItems: "center",
  },

  commentComposerActions: {
    marginTop: 4,
    minHeight: 38,
    paddingHorizontal: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  commentComposerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },

  commentComposerIconButtonActive: {
    backgroundColor: "#E8EEF9",
  },

  commentComposerPressed: {
    opacity: 0.7,
  },

  commentComposerActionSpacer: {
    flex: 1,
  },

  emojiPicker: {
    marginTop: 6,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },

  pickerTabs: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },

  pickerTab: {
    minWidth: 72,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
  },

  pickerTabActive: {
    backgroundColor: "#E8EEF9",
  },

  pickerTabText: {
    fontFamily:
      "PlusJakartaSans_500Medium",
    fontSize: 11,
    color: "#64748B",
  },

  pickerTabTextActive: {
    fontFamily:
      "PlusJakartaSans_700Bold",
    color: "#2563EB",
  },

  emojiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignContent: "flex-start",
  },

  emojiButton: {
    width: "12.5%",
    height: 48,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  emojiText: {
    fontSize: 23,
    lineHeight: 30,
  },

  stickerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingVertical: 2,
  },

  stickerButton: {
    width: "48%",
    minHeight: 72,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },

  stickerButtonSelected: {
    borderColor: "#2563EB",
    backgroundColor: "#EFF6FF",
  },

  stickerEmoji: {
    fontSize: 29,
    lineHeight: 36,
  },

  stickerLabel: {
    marginTop: 2,
    fontFamily:
      "PlusJakartaSans_600SemiBold",
    fontSize: 10.5,
    color: "#334155",
  },

  selectedSticker: {
    marginBottom: 6,
    alignSelf: "flex-start",
    minHeight: 42,
    paddingLeft: 10,
    paddingRight: 6,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  selectedStickerEmoji: {
    fontSize: 22,
    lineHeight: 28,
  },

  selectedStickerLabel: {
    fontFamily:
      "PlusJakartaSans_600SemiBold",
    fontSize: 10.5,
    color: "#334155",
  },

  selectedStickerClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  selectedStickerCloseText: {
    fontSize: 20,
    lineHeight: 22,
    color: "#64748B",
  },

  stickerMessage: {
    alignSelf: "flex-start",
    marginTop: 7,
    minWidth: 92,
    minHeight: 76,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },

  stickerMessageEmoji: {
    fontSize: 34,
    lineHeight: 40,
  },

  stickerMessageLabel: {
    marginTop: 2,
    fontFamily:
      "PlusJakartaSans_600SemiBold",
    fontSize: 10.5,
    color: "#334155",
  },

  editingBar: {
    minHeight: 34,
    marginBottom: 6,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
  },

  editingBarText: {
    fontFamily:
      "PlusJakartaSans_500Medium",
    fontSize: 10.5,
    color: "#64748B",
  },

  editingBarCancel: {
    fontFamily:
      "PlusJakartaSans_600SemiBold",
    fontSize: 10.5,
    color: "#2563EB",
  },

  deleteMetaText: {
    fontFamily:
      "PlusJakartaSans_600SemiBold",
    fontSize: 9,
    color: "#DC2626",
  },

  commentInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 84,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 8,
    fontFamily:
      "PlusJakartaSans_400Regular",
    fontSize: 12.5,
    lineHeight: 17,
    color: "#0F172A",
  },

  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563EB",
  },

  sendButtonDisabled: {
    backgroundColor: "#93B4F4",
    opacity: 0.75,
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
    paddingVertical: 11,
    borderBottomWidth: 0,
  },

  reviewRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E5E7EB",
  },

  avatarText: {
    fontFamily:
      "PlusJakartaSans_700Bold",
    fontSize: 12,
    color: "#475569",
  },

  reviewContent: {
    flex: 1,
    marginLeft: 10,
    paddingRight: 4,
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

  reviewAuthor: {
    flexShrink: 1,
    fontFamily:
      "PlusJakartaSans_500Medium",
    fontSize: 11.5,
    lineHeight: 16,
    color: "#6B7280",
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
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  reviewDate: {
    fontFamily:
      "PlusJakartaSans_400Regular",
    fontSize: 10.5,
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
    flexShrink: 1,
    fontFamily:
      "PlusJakartaSans_500Medium",
    fontSize: 11.5,
    lineHeight: 16,
    color: "#6B7280",
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

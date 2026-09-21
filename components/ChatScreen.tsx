import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
  View,
} from "react-native";

import { DocumentPickerCompat as DocumentPicker } from "../lib/nativePickers";
import { ImagePickerCompat as ImagePicker } from "../lib/nativePickers";

import {
  ArrowLeft,
  Ban,
  Camera,
  CheckCheck,
  Paperclip,
  Reply,
  Send,
  Smile,
  Trash2,
} from "lucide-react-native";

import {
  SafeAreaView,
} from "react-native-safe-area-context";

import {
  supabase,
} from "../lib/supabase";

import {
  trackMediaObservabilityEvent,
} from "../lib/mediaObservability";

import {
  readChatMessagesLocal,
  replaceChatMessagesLocal,
} from "../lib/chatMessagesLocal";

import {
  readChatConversationLocal,
  writeChatConversationLocal,
} from "../lib/chatConversationLocal";

import ImageResizer from "@bam.tech/react-native-image-resizer";

type ConversationRow = {
  id: string;
  product_key: string;
  product_title: string;
  product_type: string | null;
  buyer_user_id: string;
  buyer_name: string;
  creator_user_id: string;
  creator_name: string;
  created_at: string;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_user_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
  reply_to_message_id: string | null;
  deleted_at: string | null;
  deleted_by_user_id: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_mime_type: string | null;
  attachment_size_bytes: number | null;
};

type PendingAttachment = {
  uri: string;
  name: string;
  mimeType: string | null;
  size: number | null;
  imageRatio: number | null;
};

const CHAT_EMOJIS = [
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
  "\u{1F618}",
  "\u{1F970}",
  "\u{1F60E}",
  "\u{1F914}",
  "\u{1F62D}",
  "\u{1F621}",
  "\u{1F44D}",
  "\u{1F44F}",
  "\u{1F64F}",
  "\u{2764}\u{FE0F}",
  "\u{1F525}",
];

const CHAT_STICKERS = [
  {
    key: "mantap",
    emoji: "👍",
    label: "Mantap",
  },
  {
    key: "suka",
    emoji: "❤️",
    label: "Suka",
  },
  {
    key: "terima-kasih",
    emoji: "🙏",
    label: "Terima kasih",
  },
  {
    key: "lucu",
    emoji: "😂",
    label: "Lucu",
  },
  {
    key: "selamat",
    emoji: "🎉",
    label: "Selamat",
  },
  {
    key: "semangat",
    emoji: "💪",
    label: "Semangat",
  },
  {
    key: "keren",
    emoji: "😍",
    label: "Keren",
  },
  {
    key: "api",
    emoji: "🔥",
    label: "Mantap!",
  },
] as const;

type Props = {
  conversationId: string;
  onBack: () => void;
};

function formatTime(value: string) {
  try {
    return new Intl.DateTimeFormat(
      "id-ID",
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    ).format(new Date(value));
  } catch {
    return "";
  }
}

export default function ChatScreen({
  conversationId,
  onBack,
}: Props) {
  const scrollRef =
    useRef<ScrollView | null>(null);

  const composerInputRef =
    useRef<TextInput | null>(null);

  const [
    emojiOpen,
    setEmojiOpen,
  ] = useState(false);

  const [
    chatPickerTab,
    setChatPickerTab,
  ] = useState<
    "emoji" | "sticker"
  >("emoji");

  const [
    pendingAttachment,
    setPendingAttachment,
  ] =
    useState<PendingAttachment | null>(
      null
    );

  const [
    currentUserId,
    setCurrentUserId,
  ] =
    useState<string | null>(null);

  const [
    conversation,
    setConversation,
  ] =
    useState<ConversationRow | null>(
      null
    );

  const [
    messages,
    setMessages,
  ] =
    useState<MessageRow[]>([]);

  const [
    replyingTo,
    setReplyingTo,
  ] =
    useState<MessageRow | null>(null);

  const [
    actionMessageId,
    setActionMessageId,
  ] =
    useState<string | null>(null);

  const [
    attachmentUrls,
    setAttachmentUrls,
  ] = useState<Record<string, string>>({});


  const [
    attachmentLoadErrors,
    setAttachmentLoadErrors,
  ] = useState<Record<string, boolean>>({});

  const [
    attachmentRatios,
    setAttachmentRatios,
  ] = useState<Record<string, number>>({});

  const [
    previewImageUrl,
    setPreviewImageUrl,
  ] = useState<string | null>(null);

  function beginReply(
    message: MessageRow
  ) {
    setActionMessageId(null);
    setReplyingTo(message);

    setTimeout(() => {
      composerInputRef.current?.focus();
    }, 80);
  }

  async function handleDeleteMessage(
    message: MessageRow
  ) {
    const {
      data,
      error,
    } =
      await supabase.rpc(
        "store_delete_message_for_everyone",
        {
          p_message_id: message.id,
        }
      );

    if (error) {
      Alert.alert(
        "Gagal menghapus pesan",
        error.message
      );
      return;
    }

    if (data !== true) {
      Alert.alert(
        "Pesan tidak dapat dihapus."
      );
      return;
    }

    const deletedAt =
      new Date().toISOString();

    setMessages((current) =>
      current.map((item) =>
        item.id === message.id
          ? {
              ...item,
              deleted_at: deletedAt,
              deleted_by_user_id:
                currentUserId,
            }
          : item
      )
    );

    setActionMessageId(null);

    if (replyingTo?.id === message.id) {
      setReplyingTo(null);
    }
  }


  function openMessageMenu(
    message: MessageRow
  ) {
    if (message.deleted_at) {
      return;
    }

    Vibration.vibrate(25);

    setActionMessageId(
      (current) =>
        current === message.id
          ? null
          : message.id
    );
  }
  const swipeReplyRef =
    useRef<{
      messageId: string;
      startX: number;
      triggered: boolean;
    } | null>(null);

  const [
    swipeReply,
    setSwipeReply,
  ] =
    useState<{
      messageId: string | null;
      offset: number;
    }>({
      messageId: null,
      offset: 0,
    });

  const [
    messageText,
    setMessageText,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    sending,
    setSending,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  useEffect(() => {
    let active = true;

    async function loadChat() {
      let hasLocalConversation =
        false;
      setLoading(true);
      setErrorMessage("");

      try {
        const {
          data: sessionData,
          error: sessionError,
        } =
          await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        const userId =
          sessionData.session?.user.id;

        if (!userId) {
          throw new Error(
            "Session pengguna tidak ditemukan."
          );
        }

        if (active) {
          setCurrentUserId(userId);
        }

        try {
          const localConversation =
            readChatConversationLocal(
              userId,
              conversationId
            );

          if (
            active &&
            localConversation
          ) {
            setConversation(
              localConversation
            );

            hasLocalConversation =
              true;

            setLoading(false);
          }
        } catch (localError) {
          console.warn(
            "Percakapan lokal SQLite tidak dapat dibaca:",
            localError
          );
        }

        try {
          const localMessages =
            readChatMessagesLocal(
              userId,
              conversationId
            );

          if (
            active &&
            localMessages.length > 0
          ) {
            setMessages(localMessages);
            setLoading(false);
          }
        } catch (localError) {
          console.warn(
            "Chat lokal SQLite tidak dapat dibaca:",
            localError
          );
        }

        const {
          data: conversationData,
          error: conversationError,
        } =
          await supabase
            .from(
              "store_conversations"
            )
            .select(
              "id,product_key,product_title,product_type,buyer_user_id,buyer_name,creator_user_id,creator_name,created_at"
            )
            .eq(
              "id",
              conversationId
            )
            .single();

        if (conversationError) {
          throw conversationError;
        }

        const {
          data: messageData,
          error: messageError,
        } =
          await supabase
            .from(
              "store_messages"
            )
            .select(
              "id,conversation_id,sender_user_id,body,created_at,read_at,reply_to_message_id,deleted_at,deleted_by_user_id,attachment_path,attachment_name,attachment_mime_type,attachment_size_bytes"
            )
            .eq(
              "conversation_id",
              conversationId
            )
            .order(
              "created_at",
              {
                ascending: true,
              }
            );

        if (messageError) {
          throw messageError;
        }

        if (!active) {
          return;
        }

        const conversationRow =
          conversationData as unknown as ConversationRow;

        const messageRows =
          (messageData ?? []) as unknown as MessageRow[];

        setCurrentUserId(userId);
        setConversation(
          conversationRow
        );
        setMessages(messageRows);

        try {
          writeChatConversationLocal(
            userId,
            conversationRow
          );
        } catch (localError) {
          console.warn(
            "Percakapan lokal SQLite tidak dapat diperbarui:",
            localError
          );
        }

        try {
          replaceChatMessagesLocal(
            userId,
            conversationId,
            messageRows
          );
        } catch (localError) {
          console.warn(
            "Chat lokal SQLite tidak dapat diperbarui:",
            localError
          );
        }

        const {
          error: markReadError,
        } =
          await supabase.rpc(
            "store_mark_conversation_read",
            {
              p_conversation_id:
                conversationId,
            }
          );

        if (markReadError) {
          console.error(
            "Gagal menandai chat dibaca:",
            markReadError
          );
        }
      } catch (error) {
        if (
          active &&
          hasLocalConversation
        ) {
          console.warn(
            "Jaringan tidak tersedia. Chat memakai data SQLite lokal."
          );
          return;
        }

        console.error(
          "Gagal memuat chat:",
          error
        );

        if (active) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Chat belum dapat dimuat."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadChat();

    const channel =
      supabase
        .channel(
          `store-chat-${conversationId}`
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table:
              "store_messages",
            filter:
              `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            const incoming =
              payload.new as unknown as MessageRow;

            void supabase.rpc(
              "store_mark_conversation_read",
              {
                p_conversation_id:
                  conversationId,
              }
            );

            setMessages(
              (current) => {
                if (
                  current.some(
                    (item) =>
                      item.id ===
                      incoming.id
                  )
                ) {
                  return current;
                }

                return [
                  ...current,
                  incoming,
                ];
              }
            );
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "store_messages",
            filter:
              `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            const updated =
              payload.new as unknown as MessageRow;

            setMessages((current) =>
              current.map((item) =>
                item.id === updated.id
                  ? updated
                  : item
              )
            );
          }
        )
        .subscribe();

    return () => {
      active = false;

      void supabase.removeChannel(
        channel
      );
    };
  }, [conversationId]);

  useEffect(() => {
    let active = true;

    async function loadAttachmentUrls() {
      const pendingMessages =
        messages.filter(
          (message) =>
            Boolean(
              message.attachment_path
            ) &&
            !attachmentUrls[
              message.id
            ] &&
            !attachmentLoadErrors[
              message.id
            ]
        );

      if (
        pendingMessages.length === 0
      ) {
        return;
      }

      const results =
        await Promise.all(
          pendingMessages.map(
            async (message) => {
              if (
                !message.attachment_path
              ) {
                return null;
              }

              const {
                data,
                error,
              } =
                await supabase.storage
                  .from(
                    "store-chat-files"
                  )
                  .createSignedUrl(
                    message.attachment_path,
                    3600
                  );

              if (
                error ||
                !data?.signedUrl
              ) {
                console.warn(
                  "[CHAT_ATTACHMENT_SIGN_FAILED]",
                  message.id,
                  error
                );

                return {
                  id: message.id,
                  url: null,
                };
              }

              return {
                id: message.id,
                url: data.signedUrl,
              };
            }
          )
        );

      if (!active) {
        return;
      }

      const nextUrls:
        Record<string, string> = {};

      const failedIds: string[] = [];

      for (const result of results) {
        if (!result) {
          continue;
        }

        if (result.url) {
          nextUrls[result.id] =
            result.url;
        } else {
          failedIds.push(
            result.id
          );
        }
      }

      if (
        Object.keys(nextUrls).length > 0
      ) {
        setAttachmentUrls(
          (current) => ({
            ...current,
            ...nextUrls,
          })
        );
      }

      if (failedIds.length > 0) {
        setAttachmentLoadErrors(
          (current) => {
            const next = {
              ...current,
            };

            for (
              const id of failedIds
            ) {
              next[id] = true;
            }

            return next;
          }
        );
      }
    }

    void loadAttachmentUrls();

    return () => {
      active = false;
    };
  }, [
    messages,
    attachmentUrls,
    attachmentLoadErrors,
  ]);
  function retryAttachment(
    messageId: string
  ) {
    setAttachmentLoadErrors(
      (current) => {
        const next = { ...current };
        delete next[messageId];
        return next;
      }
    );

    setAttachmentUrls(
      (current) => {
        const next = { ...current };
        delete next[messageId];
        return next;
      }
    );
  }

  function insertEmoji(emoji: string) {
    setMessageText(
      (current) => current + emoji
    );
  }

  function toggleEmojiPanel() {
    setEmojiOpen((current) => {
      const next = !current;

      if (next) {
        Keyboard.dismiss();
      }

      return next;
    });
  }

  async function handleTakePhoto() {
    try {
      const permission =
        await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Izin kamera diperlukan",
          "Izinkan akses kamera untuk mengambil foto."
        );
        return;
      }

      setEmojiOpen(false);

      const result =
        await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          allowsEditing: false,
          quality: 0.85,
        });

      if (result.canceled) {
        return;
      }

      const image = result.assets?.[0];

      if (!image) {
        return;
      }

      const fileName =
        image.fileName ??
        `foto-${Date.now()}.jpg`;

      setPendingAttachment({
        uri: image.uri,
        name: fileName,
        mimeType:
          image.mimeType ?? "image/jpeg",
        size:
          typeof image.fileSize === "number"
            ? image.fileSize
            : null,
        imageRatio:
          image.width > 0 &&
          image.height > 0
            ? image.width / image.height
            : null,
      });
    } catch (error) {
      Alert.alert(
        "Kamera gagal dibuka",
        error instanceof Error
          ? error.message
          : "Tidak dapat membuka kamera."
      );
    }
  }

  async function handlePickDocument() {
    try {
      const result =
        await DocumentPicker.getDocumentAsync(
          {
            type: "*/*",
            multiple: false,
            copyToCacheDirectory: true,
          }
        );

      if (result.canceled) {
        return;
      }

      const file = result.assets?.[0];

      if (!file) {
        return;
      }

      let imageRatio: number | null =
        null;

      if (
        file.mimeType?.startsWith(
          "image/"
        )
      ) {
        imageRatio =
          await new Promise<number | null>(
            (resolve) => {
              Image.getSize(
                file.uri,
                (width, height) => {
                  if (
                    width > 0 &&
                    height > 0
                  ) {
                    resolve(
                      width / height
                    );
                  } else {
                    resolve(null);
                  }
                },
                () => resolve(null)
              );
            }
          );
      }

      setPendingAttachment({
        uri: file.uri,
        name: file.name || "File",
        mimeType: file.mimeType ?? null,
        size:
          typeof file.size === "number"
            ? file.size
            : null,
        imageRatio,
      });

      setEmojiOpen(false);
    } catch (error) {
      Alert.alert(
        "Gagal memilih file",
        error instanceof Error
          ? error.message
          : "File tidak dapat dipilih."
      );
    }
  }

  async function normalizeChatImage(
    attachment: PendingAttachment
  ): Promise<PendingAttachment> {
    const mimeType =
      attachment.mimeType
        ?.toLowerCase() ?? "";

    const fileName =
      attachment.name.toLowerCase();

    const isHeic =
      mimeType === "image/heic" ||
      mimeType === "image/heif" ||
      fileName.endsWith(".heic") ||
      fileName.endsWith(".heif");

    if (!isHeic) {
      return attachment;
    }

    const converted =
      await ImageResizer.createResizedImage(
        attachment.uri,
        2048,
        2048,
        "JPEG",
        85,
        0
      );

    const jpegName =
      /\.(heic|heif)$/i.test(
        attachment.name
      )
        ? attachment.name.replace(
            /\.(heic|heif)$/i,
            ".jpg"
          )
        : `${attachment.name}.jpg`;

    return {
      ...attachment,
      uri: converted.uri,
      name: jpegName,
      mimeType: "image/jpeg",
      size:
        typeof converted.size ===
        "number"
          ? converted.size
          : null,
      imageRatio:
        converted.width > 0 &&
        converted.height > 0
          ? converted.width /
            converted.height
          : attachment.imageRatio,
    };
  }
  async function handleSend() {
    const body =
      messageText.trim();

    let attachment =
      pendingAttachment;

    if (
      (!body && !attachment) ||
      !currentUserId ||
      sending
    ) {
      return;
    }

    if (
      attachment?.size &&
      attachment.size >
        25 * 1024 * 1024
    ) {
      setErrorMessage(
        "Ukuran file maksimal 25 MB."
      );
      return;
    }

    let uploadedPath:
      string | null = null;

    let uploadedSizeBytes:
      number | null = null;

    setSending(true);
    setErrorMessage("");

    try {
      if (attachment) {
        attachment =
          await normalizeChatImage(
            attachment
          );
      }
      if (attachment) {
        const safeName =
          attachment.name
            .replace(
              /[^a-zA-Z0-9._-]+/g,
              "-"
            )
            .replace(
              /^-+|-+$/g,
              ""
            )
            .slice(-120) ||
          "attachment";

        uploadedPath =
          `${conversationId}/${currentUserId}/${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 8)}-${safeName}`;

        const arrayBuffer =
          await fetch(
            attachment.uri
          ).then(
            (response) =>
              response.arrayBuffer()
          );

        uploadedSizeBytes =
          arrayBuffer.byteLength;

        const {
          error: uploadError,
        } =
          await supabase.storage
            .from(
              "store-chat-files"
            )
            .upload(
              uploadedPath,
              arrayBuffer,
              {
                contentType:
                  attachment.mimeType ??
                  "application/octet-stream",
                upsert: false,
              }
            );

        if (uploadError) {
          throw uploadError;
        }

        void trackMediaObservabilityEvent({
          eventType:
            "upload_success",
          mediaScope:
            "chat_attachment",
          bucket:
            "store-chat-files",
          storagePath:
            uploadedPath,
          bytesTransferred:
            uploadedSizeBytes ?? 0,
          source:
            "chat_upload",
          metadata: {
            mime_type:
              attachment.mimeType ?? null,
          },
        });
      }

      const {
        data,
        error,
      } =
        await supabase
          .from("store_messages")
          .insert({
            conversation_id:
              conversationId,
            sender_user_id:
              currentUserId,
            body,
            reply_to_message_id:
              replyingTo?.id ?? null,
            attachment_path:
              uploadedPath,
            attachment_name:
              attachment?.name ??
              null,
            attachment_mime_type:
              attachment?.mimeType ??
              null,
            attachment_size_bytes:
              uploadedSizeBytes ??
              attachment?.size ??
              null,
          })
          .select(
            "id,conversation_id,sender_user_id,body,created_at,read_at,reply_to_message_id,deleted_at,deleted_by_user_id,attachment_path,attachment_name,attachment_mime_type,attachment_size_bytes"
          )
          .single();

      if (error) {
        throw error;
      }

      const inserted =
        data as unknown as MessageRow;

      setMessages(
        (current) => {
          if (
            current.some(
              (item) =>
                item.id ===
                inserted.id
            )
          ) {
            return current;
          }

          return [
            ...current,
            inserted,
          ];
        }
      );

      setMessageText("");
      setReplyingTo(null);
      setPendingAttachment(null);
      setEmojiOpen(false);
    } catch (error) {
      if (uploadedPath) {
        const {
          error: cleanupError,
        } =
          await supabase.storage
            .from(
              "store-chat-files"
            )
            .remove([
              uploadedPath,
            ]);

        if (cleanupError) {
          console.warn(
            "Cleanup attachment gagal:",
            cleanupError
          );
        }
      }

      console.error(
        "Gagal mengirim pesan:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Pesan belum dapat dikirim."
      );
    } finally {
      setSending(false);
    }
  }

  const otherName =
    conversation
      ? currentUserId ===
        conversation.creator_user_id
        ? conversation.buyer_name
        : conversation.creator_name
      : "Chat";

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={["top", "bottom"]}
    >
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#FFFFFF"
      />

      <KeyboardAvoidingView
        style={styles.page}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
        keyboardVerticalOffset={0}
      >
        <View style={styles.header}>
          <Pressable
            onPress={onBack}
            hitSlop={8}
            style={styles.backButton}
          >
            <ArrowLeft
              size={21}
              color="#0F172A"
            />
          </Pressable>

          <View style={styles.headerText}>
            <Text
              style={styles.headerTitle}
              numberOfLines={1}
            >
              {otherName}
            </Text>

            <Text
              style={
                styles.headerSubtitle
              }
              numberOfLines={1}
            >
              {conversation
                ?.product_title ??
                "Diginaz Store"}
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator
              size="small"
              color="#2563EB"
            />

            <Text style={styles.stateText}>
              Memuat percakapan...
            </Text>
          </View>
        ) : (
          <>
            <ImageBackground
              source={require("../assets/chat-background-batik-v3.jpg")}
              style={styles.chatBackground}
              resizeMode="cover"
            >
            <ScrollView
              ref={scrollRef}
              onTouchStart={() => {
                if (actionMessageId) {
                  setActionMessageId(null);
                }
              }}
              onScrollBeginDrag={() => {
                if (actionMessageId) {
                  setActionMessageId(null);
                }
              }}
              style={[
                styles.messageList,
                styles.messageListTransparent,
              ]}
              contentContainerStyle={
                styles.messageContent
              }
              keyboardShouldPersistTaps="always"
              disableScrollViewPanResponder={true}
              onContentSizeChange={() =>
                scrollRef.current
                  ?.scrollToEnd({
                    animated: true,
                  })
              }
            >
              {messages.length === 0 ? (
                <View style={styles.empty}>
                  <Text
                    style={
                      styles.emptyTitle
                    }
                  >
                    Mulai percakapan
                  </Text>

                  <Text
                    style={
                      styles.emptyText
                    }
                  >
                    Tanyakan detail produk
                    langsung kepada kreator.
                  </Text>
                </View>
              ) : (
                messages.map(
                  (message) => {
                    const mine =
                      message
                        .sender_user_id ===
                      currentUserId;

                    const deleted =
                      Boolean(
                        message.deleted_at
                      );

                    const hasAttachment =
                      Boolean(
                        message.attachment_path
                      );

                    const imageAttachment =
                      !deleted &&
                      hasAttachment &&
                      Boolean(
                        message
                          .attachment_mime_type
                          ?.startsWith(
                            "image/"
                          )
                      );

                    const repliedMessage =
                      message.reply_to_message_id
                        ? messages.find(
                            (item) =>
                              item.id ===
                              message.reply_to_message_id
                          ) ?? null
                        : null;

                    return (
                      <View
                        key={message.id}
                        style={[
                          styles.messageRow,
                          mine
                            ? styles.rowMine
                            : styles.rowOther,
                        ]}
                      >

                        <Pressable
                          onLongPress={() =>
                            openMessageMenu(message)
                          }
                          delayLongPress={350}
                          onTouchStart={(event) => {
                            if (
                              message.deleted_at
                            ) {
                              return;
                            }

                            swipeReplyRef.current = {
                              messageId: message.id,
                              startX:
                                event.nativeEvent.pageX,
                              triggered: false,
                            };
                          }}
                          onTouchMove={(event) => {
                            const swipe =
                              swipeReplyRef.current;

                            if (
                              !swipe ||
                              swipe.messageId !==
                                message.id
                            ) {
                              return;
                            }

                            const delta =
                              Math.max(
                                0,
                                Math.min(
                                  42,
                                  event.nativeEvent.pageX -
                                    swipe.startX
                                )
                              );

                            setSwipeReply({
                              messageId: message.id,
                              offset: delta,
                            });

                            if (
                              delta >= 34 &&
                              !swipe.triggered
                            ) {
                              swipe.triggered = true;

                              Vibration.vibrate(25);
                              beginReply(message);
                            }
                          }}
                          onTouchEnd={() => {
                            swipeReplyRef.current =
                              null;

                            setSwipeReply({
                              messageId: null,
                              offset: 0,
                            });
                          }}
                          onTouchCancel={() => {
                            swipeReplyRef.current =
                              null;

                            setSwipeReply({
                              messageId: null,
                              offset: 0,
                            });
                          }}
                          style={({ pressed }) => [
                            styles.bubble,
                            imageAttachment
                              ? styles.imageBubble
                              : mine
                                ? styles.bubbleMine
                                : styles.bubbleOther,
                            deleted &&
                              styles.bubbleDeleted,
                            mine &&
                              deleted &&
                              styles.bubbleDeletedMine,
                            pressed &&
                              styles.bubblePressed,
                            swipeReply.messageId ===
                              message.id && {
                              transform: [
                                {
                                  translateX:
                                    swipeReply.offset,
                                },
                              ],
                            },
                          ]}
                        >
                          {repliedMessage ? (
                            <View
                              style={[
                                styles.replyQuote,
                                mine &&
                                  styles.replyQuoteMine,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.replyQuoteText,
                                  mine &&
                                    styles.replyQuoteTextMine,
                                ]}
                                numberOfLines={2}
                              >
                                {repliedMessage.deleted_at
                                  ? "Pesan telah dihapus"
                                  : repliedMessage.body.trim()
                                    ? repliedMessage.body
                                    : repliedMessage
                                        .attachment_mime_type
                                        ?.startsWith(
                                          "image/"
                                        )
                                      ? "Foto"
                                      : repliedMessage
                                          .attachment_name ??
                                        "Lampiran"}
                              </Text>
                            </View>
                          ) : null}


                            {deleted ? (
                            <View
                              style={
                                styles.deletedMessageRow
                              }
                            >
                              <Ban
                                size={14}
                                strokeWidth={1.8}
                                color={
                                  mine
                                    ? "#64748B"
                                    : "#94A3B8"
                                }
                              />

                              <Text
                                style={[
                                  styles.deletedMessageText,
                                  mine &&
                                    styles.deletedMessageTextMine,
                                ]}
                              >
                                {mine
                                  ? "Anda menghapus pesan ini."
                                  : "Pesan ini telah dihapus."}
                              </Text>

                              <Text
                                style={[
                                  styles.deletedMessageTime,
                                  mine &&
                                    styles.deletedMessageTimeMine,
                                ]}
                              >
                                {formatTime(
                                  message.created_at
                                )}
                              </Text>
                            </View>
                          ) : (
                            <>
                              {message.attachment_path &&
                              message.attachment_name &&
                              message.attachment_mime_type ? (
                                imageAttachment ? (
                                  attachmentUrls[
                                    message.id
                                  ] &&
                                  !attachmentLoadErrors[
                                    message.id
                                  ] ? (
                                    <Pressable
                                      style={
                                        styles.sentImagePressable
                                      }
                                      onPress={() => {
                                        const url =
                                          attachmentUrls[
                                            message.id
                                          ];

                                        if (url) {
                                          setPreviewImageUrl(
                                            url
                                          );
                                        }
                                      }}
                                    >
                                      <Image
                                        source={{
                                          uri:
                                            attachmentUrls[
                                              message.id
                                            ],
                                        }}
                                        style={styles.sentImage}
                                        resizeMode="cover"
                                        onError={() => {
                                          setAttachmentLoadErrors(
                                            (current) => ({
                                              ...current,
                                              [message.id]: true,
                                            })
                                          );
                                        }}
                                      />

                                      <View
                                        style={
                                          styles.imageMetaOverlay
                                        }
                                        pointerEvents="none"
                                      >
                                        <Text
                                          style={
                                            styles.imageMetaOverlayText
                                          }
                                        >
                                          {formatTime(
                                            message.created_at
                                          )}
                                        </Text>

                                        {mine && !deleted ? (
                                          <CheckCheck
                                            size={14}
                                            strokeWidth={2}
                                            color={
                                              message.read_at
                                                ? "#53BDEB"
                                                : "#FFFFFF"
                                            }
                                          />
                                        ) : null}
                                      </View>
</Pressable>
                                  ) : (
                                    <View
                                      style={
                                        styles.attachmentLoading
                                      }
                                    >
                                      {attachmentLoadErrors[message.id] ? (
                                        <Pressable
                                          onPress={() =>
                                            retryAttachment(message.id)
                                          }
                                        >
                                          <Text
                                            style={{
                                              fontSize: 12,
                                              color: "#64748B",
                                              textAlign: "center",
                                            }}
                                          >
                                            {
                                              message.attachment_mime_type?.toLowerCase() ===
                                                "image/heic" ||
                                              message.attachment_mime_type?.toLowerCase() ===
                                                "image/heif"
                                                ? "Format HEIC belum dapat dipratinjau."
                                                : "Foto gagal dimuat. Ketuk untuk coba lagi."
                                            }
                                          </Text>
                                        </Pressable>
                                      ) : (
                                        <ActivityIndicator
                                          size="small"
                                          color="#2563EB"
                                        />
                                      )}
                                    </View>
                                  )
                                ) : (
                                  <View
                                    style={
                                      styles.sentFileRow
                                    }
                                  >
                                    <Paperclip
                                      size={18}
                                      strokeWidth={2}
                                      color={
                                        mine
                                          ? "#E0ECFF"
                                          : "#2563EB"
                                      }
                                    />

                                    <Text
                                      style={[
                                        styles.sentFileName,
                                        mine &&
                                          styles.sentFileNameMine,
                                      ]}
                                      numberOfLines={
                                        2
                                      }
                                    >
                                      {
                                        message
                                          .attachment_name
                                      }
                                    </Text>
                                  </View>
                                )
                              ) : null}

                              {message.body.trim() ? (
                                <Text
                                  style={[
                                    styles.messageBody,
                                    imageAttachment
                                      ? styles.imageCaption
                                      : mine &&
                                          styles.messageBodyMine,
                                  ]}
                                >
                                  {message.body}
                                </Text>
                              ) : null}
                            </>
                          )}

                          {!deleted && !imageAttachment ? (

                          <View style={styles.messageMeta}>
                            <Text
                              style={[
                                styles.time,
                                mine &&
                                  styles.timeMine,
                                imageAttachment &&
                                  styles.imageMessageTime,
                              ]}
                            >
                              {formatTime(
                                message.created_at
                              )}
                            </Text>

                            {mine && !deleted ? (
                              <CheckCheck
                                size={14}
                                strokeWidth={2}
                                color={
                                  message.read_at
                                    ? "#2563EB"
                                    : "#94A3B8"
                                }
                              />
                            ) : null}
                          </View>

                          ) : null}
                        </Pressable>
                      </View>
                    );
                  }
                )
              )}
            </ScrollView>
            </ImageBackground>

            {errorMessage ? (
              <Text
                style={
                  styles.errorText
                }
              >
                {errorMessage}
              </Text>
            ) : null}

            {replyingTo ? (
              <View style={styles.replyComposer}>
                <View style={styles.replyIcon}>
                  <Reply
                    size={18}
                    strokeWidth={2.2}
                    color="#2563EB"
                  />
                </View>
                <View
                  style={
                    styles.replyComposerContent
                  }
                >
                  <Text
                    style={
                      styles.replyComposerTitle
                    }
                  >
                    Membalas pesan
                  </Text>

                  <Text
                    style={
                      styles.replyComposerText
                    }
                    numberOfLines={1}
                  >
                    {replyingTo.body}
                  </Text>
                </View>

                <Pressable
                  onPress={() =>
                    setReplyingTo(null)
                  }
                  hitSlop={8}
                  style={styles.replyClose}
                >
                  <Text
                    style={
                      styles.replyCloseText
                    }
                  >
                    {"\u00D7"}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {pendingAttachment ? (
              pendingAttachment.mimeType?.startsWith(
                "image/"
              ) ? (
                <View
                  style={
                    styles.imageOnlyPreview
                  }
                >
                  <Image
                    source={{
                      uri: pendingAttachment.uri,
                    }}
                    style={[
                      styles.attachmentImagePreview,
                      {
                        aspectRatio:
                          pendingAttachment.imageRatio ??
                          1,
                      },
                    ]}
                    resizeMode="cover"
                  />

                  <Pressable
                    onPress={() =>
                      setPendingAttachment(null)
                    }
                    hitSlop={8}
                    style={({ pressed }) => [
                      styles.imagePreviewRemove,
                      pressed &&
                        styles.composerIconPressed,
                    ]}
                  >
                    <Text
                      style={
                        styles.imagePreviewRemoveText
                      }
                    >
                      {"\u00D7"}
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <View
                  style={
                    styles.attachmentPreview
                  }
                >
                  <View
                    style={
                      styles.attachmentPreviewIcon
                    }
                  >
                    <Paperclip
                      size={18}
                      strokeWidth={2}
                      color="#2563EB"
                    />
                  </View>

                  <View
                    style={
                      styles.attachmentPreviewInfo
                    }
                  >
                    <Text
                      style={
                        styles.attachmentPreviewName
                      }
                      numberOfLines={1}
                    >
                      {pendingAttachment.name}
                    </Text>

                    <Text
                      style={
                        styles.attachmentPreviewMeta
                      }
                      numberOfLines={1}
                    >
                      {pendingAttachment.mimeType ??
                        "File"}
                      {pendingAttachment.size
                        ? ` - ${Math.ceil(
                            pendingAttachment.size /
                              1024
                          )} KB`
                        : ""}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() =>
                      setPendingAttachment(null)
                    }
                    hitSlop={8}
                    style={({ pressed }) => [
                      styles.attachmentRemove,
                      pressed &&
                        styles.composerIconPressed,
                    ]}
                  >
                    <Text
                      style={
                        styles.attachmentRemoveText
                      }
                    >
                      {"\u00D7"}
                    </Text>
                  </Pressable>
                </View>
              )
            ) : null}

            {actionMessageId ? (
              <View
                style={
                  styles.messageActionBar
                }
              >
                <Pressable
                  onPress={() =>
                    setActionMessageId(null)
                  }
                  hitSlop={6}
                  style={({ pressed }) => [
                    styles.messageCancelButton,
                    pressed &&
                      styles.messageActionPressed,
                  ]}
                >
                  <Text
                    style={
                      styles.messageCancelText
                    }
                  >
                    Batal
                  </Text>
                </Pressable>

                {messages.find(
                  (item) =>
                    item.id ===
                    actionMessageId
                )?.sender_user_id ===
                currentUserId ? (
                  <Pressable
                    onPress={() => {
                      const message =
                        messages.find(
                          (item) =>
                            item.id ===
                            actionMessageId
                        );

                      if (message) {
                        void handleDeleteMessage(
                          message
                        );
                      }
                    }}
                    hitSlop={6}
                    style={({ pressed }) => [
                      styles.messageActionButton,
                      styles.messageDeleteButton,
                      pressed &&
                        styles.messageActionPressed,
                    ]}
                  >
                    <Trash2
                      size={18}
                      strokeWidth={2}
                      color="#DC2626"
                    />
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            <View
              style={styles.composer}
              onTouchStart={() => {
                if (actionMessageId) {
                  setActionMessageId(null);
                }
              }}
            >
              <View style={styles.composerMain}>
                <TextInput
                  ref={composerInputRef}
                  value={messageText}
                  onChangeText={
                    setMessageText
                  }
                  onFocus={() =>
                    setEmojiOpen(false)
                  }
                  placeholder="Tulis pesan..."
                  placeholderTextColor="#94A3B8"
                  multiline
                  maxLength={2000}
                  style={
                    styles.composerInput
                  }
                />
              </View>

              <View style={styles.composerActions}>
                <Pressable
                  onPress={toggleEmojiPanel}
                  hitSlop={4}
                  style={({ pressed }) => [
                    styles.composerIconButton,
                    emojiOpen &&
                      styles.composerIconButtonActive,
                    pressed &&
                      styles.composerIconPressed,
                  ]}
                >
                  <Smile
                    size={21}
                    strokeWidth={2}
                    color={
                      emojiOpen
                        ? "#2563EB"
                        : "#64748B"
                    }
                  />
                </Pressable>

                <Pressable
                  onPress={() => {
                    void handlePickDocument();
                  }}
                  hitSlop={4}
                  style={({ pressed }) => [
                    styles.composerIconButton,
                    pressed &&
                      styles.composerIconPressed,
                  ]}
                >
                  <Paperclip
                    size={21}
                    strokeWidth={2}
                    color="#64748B"
                  />
                </Pressable>

                <Pressable
                  onPress={() => {
                    void handleTakePhoto();
                  }}
                  hitSlop={4}
                  style={({ pressed }) => [
                    styles.composerIconButton,
                    pressed &&
                      styles.composerIconPressed,
                  ]}
                >
                  <Camera
                    size={21}
                    strokeWidth={2}
                    color="#64748B"
                  />
                </Pressable>

                <View
                  style={
                    styles.composerActionSpacer
                  }
                />

                <Pressable
                  onPress={handleSend}
                  disabled={
                    (!messageText.trim() && !pendingAttachment) || sending
                  }
                  style={[
                    styles.sendButton,
                    (
                      (!messageText.trim() && !pendingAttachment) || sending
                    ) &&
                      styles.sendDisabled,
                  ]}
                >
                  {sending ? (
                    <ActivityIndicator
                      size="small"
                      color="#FFFFFF"
                    />
                  ) : (
                    <Send
                      size={18}
                      color="#FFFFFF"
                    />
                  )}
                </Pressable>
              </View>
            </View>
            {emojiOpen ? (
              <View
                style={styles.emojiPanel}
              >
                <View
                  style={
                    styles.chatPickerTabs
                  }
                >
                  <Pressable
                    onPress={() =>
                      setChatPickerTab(
                        "emoji"
                      )
                    }
                    style={[
                      styles.chatPickerTab,
                      chatPickerTab ===
                        "emoji" &&
                        styles.chatPickerTabActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chatPickerTabText,
                        chatPickerTab ===
                          "emoji" &&
                          styles.chatPickerTabTextActive,
                      ]}
                    >
                      Emoji
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() =>
                      setChatPickerTab(
                        "sticker"
                      )
                    }
                    style={[
                      styles.chatPickerTab,
                      chatPickerTab ===
                        "sticker" &&
                        styles.chatPickerTabActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chatPickerTabText,
                        chatPickerTab ===
                          "sticker" &&
                          styles.chatPickerTabTextActive,
                      ]}
                    >
                      Stiker
                    </Text>
                  </Pressable>
                </View>

                {chatPickerTab ===
                "emoji" ? (
                  <ScrollView
                    showsVerticalScrollIndicator={
                      false
                    }
                    keyboardShouldPersistTaps="always"
                    contentContainerStyle={
                      styles.emojiGrid
                    }
                  >
                    {CHAT_EMOJIS.map(
                      (emoji) => (
                        <Pressable
                          key={emoji}
                          onPress={() =>
                            insertEmoji(
                              emoji
                            )
                          }
                          style={({
                            pressed,
                          }) => [
                            styles.emojiButton,
                            pressed &&
                              styles.composerIconPressed,
                          ]}
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
                  </ScrollView>
                ) : (
                  <ScrollView
                    showsVerticalScrollIndicator={
                      false
                    }
                    keyboardShouldPersistTaps="always"
                    contentContainerStyle={
                      styles.chatStickerGrid
                    }
                  >
                    {CHAT_STICKERS.map(
                      (sticker) => (
                        <Pressable
                          key={
                            sticker.key
                          }
                          onPress={() =>
                            insertEmoji(
                              sticker.emoji
                            )
                          }
                          style={({
                            pressed,
                          }) => [
                            styles.chatStickerButton,
                            pressed &&
                              styles.composerIconPressed,
                          ]}
                        >
                          <Text
                            style={
                              styles.chatStickerEmoji
                            }
                          >
                            {
                              sticker.emoji
                            }
                          </Text>

                          <Text
                            style={
                              styles.chatStickerLabel
                            }
                          >
                            {
                              sticker.label
                            }
                          </Text>
                        </Pressable>
                      )
                    )}
                  </ScrollView>
                )}
              </View>
            ) : null}

          </>
        )}
      </KeyboardAvoidingView>

      <Modal
        visible={Boolean(
          previewImageUrl
        )}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() =>
          setPreviewImageUrl(null)
        }
      >
        <Pressable
          style={
            styles.fullscreenPreview
          }
          onPress={() =>
            setPreviewImageUrl(null)
          }
        >
          {previewImageUrl ? (
            <Image
              source={{
                uri: previewImageUrl,
              }}
              style={
                styles.fullscreenPreviewImage
              }
              resizeMode="contain"
            />
          ) : null}

          <View
            style={
              styles.fullscreenClose
            }
            pointerEvents="none"
          >
            <Text
              style={
                styles.fullscreenCloseText
              }
            >
              {"\u00D7"}
            </Text>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: "#F8FAFC",
    },

    page: {
      flex: 1,
    },

    header: {
      minHeight: 62,
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
      borderBottomWidth: 1,
      borderBottomColor: "#E2E8F0",
      backgroundColor: "#FFFFFF",
    },

    backButton: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
    },

    headerText: {
      flex: 1,
      paddingRight: 14,
    },

    headerTitle: {
      fontFamily:
        "PlusJakartaSans_600SemiBold",
      fontSize: 13.5,
      color: "#0F172A",
    },

    headerSubtitle: {
      marginTop: 2,
      fontFamily:
        "PlusJakartaSans_400Regular",
      fontSize: 12,
      color: "#64748B",
    },

    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },

    stateText: {
      fontFamily:
        "PlusJakartaSans_400Regular",
      fontSize: 12,
      color: "#64748B",
    },

    messageList: {
      flex: 1,
    },

    messageContent: {
      flexGrow: 1,
      paddingHorizontal: 14,
      paddingTop: 14,
      paddingBottom: 18,
    },

    empty: {
      flex: 1,
      minHeight: 300,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 40,
    },

    emptyTitle: {
      fontFamily:
        "PlusJakartaSans_600SemiBold",
      fontSize: 13,
      color: "#0F172A",
    },

    emptyText: {
      marginTop: 5,
      textAlign: "center",
      fontFamily:
        "PlusJakartaSans_400Regular",
      fontSize: 12,
      lineHeight: 16,
      color: "#64748B",
    },

    chatBackground: {
      flex: 1,
    },

    messageListTransparent: {
      backgroundColor: "transparent",
    },

    messageRow: {
      width: "100%",
      marginBottom: 2,
    },

    rowMine: {
      alignItems: "flex-end",
    },

    rowOther: {
      alignItems: "flex-start",
    },

    bubble: {
      maxWidth: "78%",
      paddingHorizontal: 8,
      paddingTop: 5,
      paddingBottom: 4,
      borderRadius: 11,
    },

    bubblePressed: {
      opacity: 0.82,
      transform: [
        {
          scale: 0.985,
        },
      ],
    },

    bubbleMine: {
      backgroundColor: "#2563EB",
      borderBottomRightRadius: 4,
    },

    bubbleOther: {
      backgroundColor: "#FFFFFF",
      borderWidth: 1,
      borderColor: "#E2E8F0",
      borderBottomLeftRadius: 4,
    },
    bubbleDeleted: {
      paddingHorizontal: 9,
      paddingTop: 6,
      paddingBottom: 6,
      borderWidth: 1,
      borderColor: "#E2E8F0",
      borderRadius: 12,
      backgroundColor: "#F8FAFC",
    },
    bubbleDeletedMine: {
      borderWidth: 1,
      borderColor: "#BFDBFE",
      borderRadius: 12,
      backgroundColor: "#EFF6FF",
    },
    deletedMessageRow: {
      minHeight: 22,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    deletedMessageText: {
      flexShrink: 1,
      fontFamily:
        "PlusJakartaSans_400Regular",
      fontSize: 12.5,
      lineHeight: 18,
      fontStyle: "italic",
      color: "#64748B",
    },
    deletedMessageTextMine: {
      color: "#475569",
    },
    deletedMessageTime: {
      marginLeft: 2,
      fontFamily:
        "PlusJakartaSans_400Regular",
      fontSize: 10,
      lineHeight: 14,
      color: "#94A3B8",
    },
    deletedMessageTimeMine: {
      color: "#64748B",
    },
    messageActionBar: {
      marginHorizontal: 12,
      marginTop: 6,
      marginBottom: 6,
      paddingHorizontal: 8,
      paddingVertical: 6,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderWidth: 1,
      borderColor: "#E2E8F0",
      borderRadius: 12,
      backgroundColor: "#FFFFFF",
      elevation: 3,
      shadowColor: "#000000",
      shadowOpacity: 0.08,
      shadowRadius: 5,
      shadowOffset: {
        width: 0,
        height: 2,
      },
    },

    messageCancelButton: {
      minHeight: 34,
      paddingHorizontal: 12,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#F1F5F9",
    },

    messageCancelText: {
      fontFamily:
        "PlusJakartaSans_600SemiBold",
      fontSize: 12,
      color: "#475569",
    },

    messageActionButton: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#F8FAFC",
    },

    messageDeleteButton: {
      backgroundColor: "#FEF2F2",
    },

    messageActionPressed: {
      opacity: 0.55,
      transform: [
        {
          scale: 0.94,
        },
      ],
    },

    messageBody: {
      fontFamily:
        "PlusJakartaSans_400Regular",
      fontSize: 14,
      lineHeight: 20,
      color: "#0F172A",
    },

    messageBodyMine: {
      color: "#FFFFFF",
    },

    time: {
      alignSelf: "flex-end",
      marginTop: 0,
      fontFamily:
        "PlusJakartaSans_400Regular",
      fontSize: 10,
      lineHeight: 12,
      color: "#94A3B8",
    },

    timeMine: {
      color:
        "rgba(255,255,255,0.72)",
    },

    errorText: {
      paddingHorizontal: 14,
      paddingVertical: 5,
      backgroundColor: "#FFFFFF",
      fontFamily:
        "PlusJakartaSans_400Regular",
      fontSize: 12,
      color: "#DC2626",
    },    messageMeta: {
      marginTop: 0,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 2,
    },

    replyQuote: {
      marginBottom: 6,
      paddingVertical: 6,
      paddingHorizontal: 8,
      borderLeftWidth: 3,
      borderLeftColor: "#2563EB",
      borderRadius: 6,
      backgroundColor: "#F1F5F9",
    },

    replyQuoteMine: {
      borderLeftColor: "#BFDBFE",
      backgroundColor:
        "rgba(255,255,255,0.16)",
    },

    replyQuoteText: {
      fontFamily:
        "PlusJakartaSans_400Regular",
      fontSize: 12,
      lineHeight: 16,
      color: "#475569",
    },

    replyQuoteTextMine: {
      color: "#E0ECFF",
    },

    replyComposer: {
      marginHorizontal: 10,
      marginTop: 6,
      marginBottom: 4,
      paddingVertical: 10,
      paddingLeft: 12,
      paddingRight: 8,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderWidth: 1,
      borderColor: "#DBEAFE",
      borderRadius: 14,
      backgroundColor: "#EFF6FF",
    },
    replyComposerContent: {
      flex: 1,
      minWidth: 0,
    },

    replyIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#DBEAFE",
    },

    replyComposerTitle: {
      fontFamily:
        "PlusJakartaSans_600SemiBold",
      fontSize: 13,
      lineHeight: 18,
      color: "#2563EB",
    },

    replyComposerText: {
      marginTop: 2,
      fontFamily:
        "PlusJakartaSans_400Regular",
      fontSize: 13,
      lineHeight: 18,
      color: "#475569",
    },

    replyClose: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: "#BFDBFE",
      backgroundColor: "#FFFFFF",
    },

    replyCloseText: {
      fontSize: 20,
      lineHeight: 22,
      color: "#64748B",
    },

    attachmentPreview: {
      marginHorizontal: 10,
      marginTop: 6,
      marginBottom: 4,
      minHeight: 58,
      paddingHorizontal: 10,
      paddingVertical: 8,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderWidth: 1,
      borderColor: "#DBEAFE",
      borderRadius: 14,
      backgroundColor: "#EFF6FF",
    },

    imageOnlyPreview: {
      width: "64%",
      maxWidth: 250,
      marginHorizontal: 10,
      marginTop: 6,
      marginBottom: 6,
      alignSelf: "flex-end",
      position: "relative",
      overflow: "hidden",
      borderRadius: 14,
    },

    attachmentImagePreview: {
      width: "100%",
      borderRadius: 16,
    },

    imagePreviewRemove: {
      position: "absolute",
      top: 6,
      right: 6,
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(15,23,42,0.72)",
    },

    imagePreviewRemoveText: {
      fontSize: 20,
      lineHeight: 22,
      color: "#FFFFFF",
    },

    attachmentPreviewIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#DBEAFE",
    },

    attachmentPreviewInfo: {
      flex: 1,
      minWidth: 0,
    },

    attachmentPreviewName: {
      fontFamily:
        "PlusJakartaSans_600SemiBold",
      fontSize: 13,
      lineHeight: 18,
      color: "#0F172A",
    },

    attachmentPreviewMeta: {
      marginTop: 1,
      fontFamily:
        "PlusJakartaSans_400Regular",
      fontSize: 12,
      lineHeight: 16,
      color: "#64748B",
    },

    attachmentRemove: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
    },

    attachmentRemoveText: {
      fontSize: 22,
      lineHeight: 24,
      color: "#64748B",
    },

    emojiPanel: {
      height: 230,
      paddingTop: 8,
      paddingBottom: 6,
      borderTopWidth: 1,
      borderTopColor: "#E2E8F0",
      backgroundColor: "#FFFFFF",
    },

    chatPickerTabs: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginHorizontal: 8,
      marginBottom: 8,
    },

    chatPickerTab: {
      minWidth: 72,
      height: 32,
      paddingHorizontal: 12,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#F1F5F9",
    },

    chatPickerTabActive: {
      backgroundColor: "#E8EEF9",
    },

    chatPickerTabText: {
      fontFamily:
        "PlusJakartaSans_500Medium",
      fontSize: 11,
      color: "#64748B",
    },

    chatPickerTabTextActive: {
      fontFamily:
        "PlusJakartaSans_700Bold",
      color: "#2563EB",
    },

    chatStickerGrid: {
      paddingHorizontal: 8,
      paddingBottom: 8,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },

    chatStickerButton: {
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

    chatStickerEmoji: {
      fontSize: 29,
      lineHeight: 36,
    },

    chatStickerLabel: {
      marginTop: 2,
      fontFamily:
        "PlusJakartaSans_600SemiBold",
      fontSize: 10.5,
      color: "#334155",
    },

    emojiGrid: {
      paddingHorizontal: 10,
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

    composerIconButton: {
      width: 40,
      height: 44,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#F8FAFC",
    },

    composerIconButtonActive: {
      backgroundColor: "#EFF6FF",
    },

    composerIconPressed: {
      opacity: 0.55,
    },

    composer: {
      minHeight: 66,
      paddingHorizontal: 12,
      paddingVertical: 9,
      gap: 6,
      borderTopWidth: 1,
      borderTopColor: "#E2E8F0",
      backgroundColor: "#FFFFFF",
    },

    composerMain: {
      width: "100%",
    },

    composerActions: {
      width: "100%",
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },

    composerActionSpacer: {
      flex: 1,
    },

    composerInput: {
      width: "100%",
      minHeight: 44,
      maxHeight: 110,
      paddingHorizontal: 12,
      paddingTop: 11,
      paddingBottom: 10,
      borderWidth: 1,
      borderColor: "#E2E8F0",
      borderRadius: 14,
      backgroundColor: "#F8FAFC",
      fontFamily:
        "PlusJakartaSans_400Regular",
      fontSize: 15,
      lineHeight: 21,
      color: "#0F172A",
    },

    imageBubble: {
      width: "64%",
      maxWidth: 250,
      marginBottom: -8,
      paddingHorizontal: 0,
      paddingVertical: 0,
      borderRadius: 0,
      backgroundColor: "transparent",
      overflow: "visible",
    },

    sentImagePressable: {
      width: "100%",
      overflow: "hidden",
      borderRadius: 12,
    },

    sentImage: {
      width: "100%",
      aspectRatio: 3 / 4,
      borderRadius: 12,
    },

    imageMetaOverlay: {
      position: "absolute",
      right: 8,
      bottom: 7,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: 8,
      backgroundColor: "rgba(0, 0, 0, 0.38)",
    },

    imageMetaOverlayText: {
      fontFamily:
        "PlusJakartaSans_400Regular",
      fontSize: 11,
      lineHeight: 14,
      color: "#FFFFFF",
    },

    attachmentLoading: {
      width: "100%",
      height: 180,
      alignItems: "center",
      justifyContent: "center",
    },

    imageCaption: {
      marginTop: 6,
      color: "#0F172A",
    },

    imageMessageTime: {
      color: "#64748B",
    },

    sentFileRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },

    sentFileName: {
      flexShrink: 1,
      fontFamily:
        "PlusJakartaSans_500Medium",
      fontSize: 13,
      lineHeight: 18,
      color: "#334155",
    },

    sentFileNameMine: {
      color: "#FFFFFF",
    },

    fullscreenPreview: {
      flex: 1,
      backgroundColor:
        "rgba(0,0,0,0.96)",
      alignItems: "center",
      justifyContent: "center",
    },

    fullscreenPreviewImage: {
      width: "100%",
      height: "100%",
    },

    fullscreenClose: {
      position: "absolute",
      top: 48,
      right: 18,
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor:
        "rgba(255,255,255,0.18)",
    },

    fullscreenCloseText: {
      fontSize: 28,
      lineHeight: 30,
      color: "#FFFFFF",
    },

    sendButton: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#2563EB",
    },

    sendDisabled: {
      opacity: 0.4,
    },
  });

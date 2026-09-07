import { open } from "react-native-nitro-sqlite";

const DATABASE_NAME =
  "diginaz-local.db";

const TABLE_NAME =
  "chat_inbox_items";

export type ChatInboxLocalConversation = {
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

export type ChatInboxLocalMessage = {
  id: string;
  conversation_id: string;
  sender_user_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
  deleted_at: string | null;
  deleted_by_user_id: string | null;
};

export type ChatInboxLocalItem = {
  conversation: ChatInboxLocalConversation;
  lastMessage: ChatInboxLocalMessage | null;
};

type StoredInboxRow = {
  conversation_id: string;
  product_key: string;
  product_title: string;
  product_type: string | null;
  buyer_user_id: string;
  buyer_name: string;
  creator_user_id: string;
  creator_name: string;
  conversation_created_at: string;
  last_message_id: string | null;
  last_message_sender_user_id: string | null;
  last_message_body: string | null;
  last_message_created_at: string | null;
  last_message_read_at: string | null;
  last_message_deleted_at: string | null;
  last_message_deleted_by_user_id: string | null;
};

function openInboxDatabase() {
  const database =
    open({
      name: DATABASE_NAME,
    });

  database.execute(`
    CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
      current_user_id TEXT NOT NULL,
      conversation_id TEXT NOT NULL,

      product_key TEXT NOT NULL,
      product_title TEXT NOT NULL,
      product_type TEXT,

      buyer_user_id TEXT NOT NULL,
      buyer_name TEXT NOT NULL,
      creator_user_id TEXT NOT NULL,
      creator_name TEXT NOT NULL,
      conversation_created_at TEXT NOT NULL,

      last_message_id TEXT,
      last_message_sender_user_id TEXT,
      last_message_body TEXT,
      last_message_created_at TEXT,
      last_message_read_at TEXT,
      last_message_deleted_at TEXT,
      last_message_deleted_by_user_id TEXT,

      sort_at TEXT NOT NULL,

      PRIMARY KEY (
        current_user_id,
        conversation_id
      )
    )
  `);

  database.execute(`
    CREATE INDEX IF NOT EXISTS
      idx_chat_inbox_user_sort
    ON ${TABLE_NAME} (
      current_user_id,
      sort_at DESC
    )
  `);

  return database;
}

export function readChatInboxLocal(
  currentUserId: string
): ChatInboxLocalItem[] {
  const database =
    openInboxDatabase();

  try {
    const result =
      database.execute(
        `
          SELECT
            conversation_id,
            product_key,
            product_title,
            product_type,
            buyer_user_id,
            buyer_name,
            creator_user_id,
            creator_name,
            conversation_created_at,
            last_message_id,
            last_message_sender_user_id,
            last_message_body,
            last_message_created_at,
            last_message_read_at,
            last_message_deleted_at,
            last_message_deleted_by_user_id
          FROM ${TABLE_NAME}
          WHERE current_user_id = ?
          ORDER BY sort_at DESC
        `,
        [
          currentUserId,
        ]
      );

    return result.rows._array.map(
      (rawRow) => {
        const row =
          rawRow as unknown as StoredInboxRow;

        const lastMessage =
          row.last_message_id
            ? {
                id:
                  row.last_message_id,
                conversation_id:
                  row.conversation_id,
                sender_user_id:
                  row.last_message_sender_user_id ??
                  "",
                body:
                  row.last_message_body ??
                  "",
                created_at:
                  row.last_message_created_at ??
                  row.conversation_created_at,
                read_at:
                  row.last_message_read_at,
                deleted_at:
                  row.last_message_deleted_at,
                deleted_by_user_id:
                  row.last_message_deleted_by_user_id,
              }
            : null;

        return {
          conversation: {
            id:
              row.conversation_id,
            product_key:
              row.product_key,
            product_title:
              row.product_title,
            product_type:
              row.product_type,
            buyer_user_id:
              row.buyer_user_id,
            buyer_name:
              row.buyer_name,
            creator_user_id:
              row.creator_user_id,
            creator_name:
              row.creator_name,
            created_at:
              row.conversation_created_at,
          },
          lastMessage,
        };
      }
    );
  }
  finally {
    database.close();
  }
}

export function writeChatInboxLocal(
  currentUserId: string,
  items: ChatInboxLocalItem[]
) {
  const database =
    openInboxDatabase();

  try {
    database.execute(
      "BEGIN TRANSACTION"
    );

    database.execute(
      `
        DELETE FROM ${TABLE_NAME}
        WHERE current_user_id = ?
      `,
      [
        currentUserId,
      ]
    );

    for (const item of items) {
      const conversation =
        item.conversation;

      const lastMessage =
        item.lastMessage;

      const sortAt =
        lastMessage?.created_at ??
        conversation.created_at;

      database.execute(
        `
          INSERT INTO ${TABLE_NAME} (
            current_user_id,
            conversation_id,

            product_key,
            product_title,
            product_type,

            buyer_user_id,
            buyer_name,
            creator_user_id,
            creator_name,
            conversation_created_at,

            last_message_id,
            last_message_sender_user_id,
            last_message_body,
            last_message_created_at,
            last_message_read_at,
            last_message_deleted_at,
            last_message_deleted_by_user_id,

            sort_at
          )
          VALUES (
            ?, ?,
            ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?,
            ?
          )
        `,
        [
          currentUserId,
          conversation.id,

          conversation.product_key,
          conversation.product_title,
          conversation.product_type,

          conversation.buyer_user_id,
          conversation.buyer_name,
          conversation.creator_user_id,
          conversation.creator_name,
          conversation.created_at,

          lastMessage?.id ??
          null,

          lastMessage?.sender_user_id ??
          null,

          lastMessage?.body ??
          null,

          lastMessage?.created_at ??
          null,

          lastMessage?.read_at ??
          null,

          lastMessage?.deleted_at ??
          null,

          lastMessage?.deleted_by_user_id ??
          null,

          sortAt,
        ]
      );
    }

    database.execute(
      "COMMIT"
    );
  }
  catch (error) {
    try {
      database.execute(
        "ROLLBACK"
      );
    }
    catch {
      // Jangan tutupi error utama.
    }

    throw error;
  }
  finally {
    database.close();
  }
}
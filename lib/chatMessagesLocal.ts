import { open } from "react-native-nitro-sqlite";

const DATABASE_NAME =
  "diginaz-local.db";

const TABLE_NAME =
  "chat_messages";

export type ChatMessageLocalRow = {
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

type StoredMessageRow = {
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

function openMessagesDatabase() {
  const database =
    open({
      name: DATABASE_NAME,
    });

  database.execute(`
    CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
      current_user_id TEXT NOT NULL,
      id TEXT NOT NULL,
      conversation_id TEXT NOT NULL,

      sender_user_id TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      read_at TEXT,

      reply_to_message_id TEXT,

      deleted_at TEXT,
      deleted_by_user_id TEXT,

      attachment_path TEXT,
      attachment_name TEXT,
      attachment_mime_type TEXT,
      attachment_size_bytes INTEGER,

      sort_index INTEGER NOT NULL,

      PRIMARY KEY (
        current_user_id,
        id
      )
    )
  `);

  database.execute(`
    CREATE INDEX IF NOT EXISTS
      idx_chat_messages_user_conversation
    ON ${TABLE_NAME} (
      current_user_id,
      conversation_id,
      sort_index
    )
  `);

  database.execute(`
    CREATE INDEX IF NOT EXISTS
      idx_chat_messages_conversation_created
    ON ${TABLE_NAME} (
      current_user_id,
      conversation_id,
      created_at
    )
  `);

  return database;
}

export function readChatMessagesLocal(
  currentUserId: string,
  conversationId: string
): ChatMessageLocalRow[] {
  const database =
    openMessagesDatabase();

  try {
    const result =
      database.execute(
        `
          SELECT
            id,
            conversation_id,
            sender_user_id,
            body,
            created_at,
            read_at,
            reply_to_message_id,
            deleted_at,
            deleted_by_user_id,
            attachment_path,
            attachment_name,
            attachment_mime_type,
            attachment_size_bytes
          FROM ${TABLE_NAME}
          WHERE current_user_id = ?
            AND conversation_id = ?
          ORDER BY sort_index ASC
        `,
        [
          currentUserId,
          conversationId,
        ]
      );

    return result.rows._array.map(
      (rawRow) => {
        const row =
          rawRow as unknown as StoredMessageRow;

        return {
          id:
            row.id,
          conversation_id:
            row.conversation_id,
          sender_user_id:
            row.sender_user_id,
          body:
            row.body,
          created_at:
            row.created_at,
          read_at:
            row.read_at,
          reply_to_message_id:
            row.reply_to_message_id,
          deleted_at:
            row.deleted_at,
          deleted_by_user_id:
            row.deleted_by_user_id,
          attachment_path:
            row.attachment_path,
          attachment_name:
            row.attachment_name,
          attachment_mime_type:
            row.attachment_mime_type,
          attachment_size_bytes:
            row.attachment_size_bytes,
        };
      }
    );
  }
  finally {
    database.close();
  }
}

export function replaceChatMessagesLocal(
  currentUserId: string,
  conversationId: string,
  messages: ChatMessageLocalRow[]
) {
  const database =
    openMessagesDatabase();

  try {
    database.execute(
      "BEGIN TRANSACTION"
    );

    database.execute(
      `
        DELETE FROM ${TABLE_NAME}
        WHERE current_user_id = ?
          AND conversation_id = ?
      `,
      [
        currentUserId,
        conversationId,
      ]
    );

    messages.forEach(
      (message, index) => {
        database.execute(
          `
            INSERT INTO ${TABLE_NAME} (
              current_user_id,
              id,
              conversation_id,

              sender_user_id,
              body,
              created_at,
              read_at,

              reply_to_message_id,

              deleted_at,
              deleted_by_user_id,

              attachment_path,
              attachment_name,
              attachment_mime_type,
              attachment_size_bytes,

              sort_index
            )
            VALUES (
              ?, ?, ?,
              ?, ?, ?, ?,
              ?,
              ?, ?,
              ?, ?, ?, ?,
              ?
            )
          `,
          [
            currentUserId,
            message.id,
            message.conversation_id,

            message.sender_user_id,
            message.body,
            message.created_at,
            message.read_at,

            message.reply_to_message_id,

            message.deleted_at,
            message.deleted_by_user_id,

            message.attachment_path,
            message.attachment_name,
            message.attachment_mime_type,
            message.attachment_size_bytes,

            index,
          ]
        );
      }
    );

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
      // Pertahankan error utama.
    }

    throw error;
  }
  finally {
    database.close();
  }
}
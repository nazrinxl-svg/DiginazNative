import { open } from "react-native-nitro-sqlite";

const DATABASE_NAME =
  "diginaz-local.db";

const TABLE_NAME =
  "chat_conversations";

export type ChatConversationLocalRow = {
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

type StoredConversationRow =
  ChatConversationLocalRow;

function openConversationDatabase() {
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

      created_at TEXT NOT NULL,

      PRIMARY KEY (
        current_user_id,
        conversation_id
      )
    )
  `);

  return database;
}

export function readChatConversationLocal(
  currentUserId: string,
  conversationId: string
): ChatConversationLocalRow | null {
  const database =
    openConversationDatabase();

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
            created_at
          FROM ${TABLE_NAME}
          WHERE current_user_id = ?
            AND conversation_id = ?
          LIMIT 1
        `,
        [
          currentUserId,
          conversationId,
        ]
      );

    if (result.rows.length === 0) {
      return null;
    }

    const row =
      result.rows.item(
        0
      ) as unknown as
        StoredConversationRow & {
          conversation_id: string;
        };

    return {
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
        row.created_at,
    };
  }
  finally {
    database.close();
  }
}

export function writeChatConversationLocal(
  currentUserId: string,
  conversation: ChatConversationLocalRow
) {
  const database =
    openConversationDatabase();

  try {
    database.execute(
      `
        INSERT OR REPLACE INTO ${TABLE_NAME} (
          current_user_id,
          conversation_id,

          product_key,
          product_title,
          product_type,

          buyer_user_id,
          buyer_name,

          creator_user_id,
          creator_name,

          created_at
        )
        VALUES (
          ?, ?,
          ?, ?, ?,
          ?, ?,
          ?, ?,
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
      ]
    );
  }
  finally {
    database.close();
  }
}
// db/repos/messages.repo.ts

import { pool } from "../../db";
import { MessagesSQL } from "../queries/messages.sql";

/**
 * Liste des messages pour un user
 * → vérifie que la conversation lui appartient
 */
export async function listMessagesForConversationUser(
  conversationId: string,
  userId: string
) {
  const r = await pool.query(MessagesSQL.listForUser, [
    conversationId,
    userId,
  ]);
  return r.rows;
}

/**
 * Liste des messages pour le care/admin
 */
export async function listMessagesForConversationCare(
  conversationId: string
) {
  const r = await pool.query(MessagesSQL.listForCare, [conversationId]);
  return r.rows;
}

/**
 * Ajout d'un message (USER / CARE / BOT)
 * → transaction :
 *    - insert message
 *    - update conversation.last_message_at
 */
export async function addMessage(
  conversationId: string,
  senderRole: "USER" | "CARE" | "BOT",
  senderUserId: string | null,
  content: string
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1) Insert message
    await client.query(MessagesSQL.insertMessage, [
      conversationId,
      senderRole,
      senderUserId,
      content,
    ]);

    // 2) Update conversation metadata
    await client.query(MessagesSQL.touchConversation, [conversationId]);

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

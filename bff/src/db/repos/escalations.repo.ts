// db/repos/escalations.repo.ts

import { pool } from "../../db";
import { EscalationsSQL } from "../queries/escalations.sql";

export async function requestEscalation(
  conversationId: string,
  userId: string
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const escalation = await client.query(
      EscalationsSQL.insertEscalation,
      [conversationId, userId]
    );

    const conversation = await client.query(
      EscalationsSQL.markConversationEscalated,
      [conversationId]
    );

    await client.query("COMMIT");

    return {
      escalation: escalation.rows[0] || null,
      conversation: conversation.rows[0],
    };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

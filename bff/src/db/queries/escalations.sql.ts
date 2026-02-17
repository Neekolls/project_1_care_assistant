// db/queries/escalations.sql.ts

export const EscalationsSQL = {
  /**
   * Log d'une demande d'escalade
   * 1 escalade max par conversation
   */
  insertEscalation: `
    INSERT INTO escalations (conversation_id, requested_by_user_id)
    VALUES ($1, $2)
    ON CONFLICT (conversation_id) DO NOTHING
    RETURNING id, conversation_id, requested_by_user_id, created_at;
  `,

  /**
   * Passage de la conversation en ESCALATED
   * -> c'est LA vérité métier
   */
  markConversationEscalated: `
    UPDATE conversations
    SET status = 'ESCALATED',
        updated_at = now()
    WHERE id = $1
    RETURNING id, user_id, status, last_message_at;
  `,
};

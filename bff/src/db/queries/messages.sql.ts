// db/queries/messages.sql.ts

export const MessagesSQL = {
  /**
   * Liste des messages d'une conversation
   * - version USER : on vérifie que la conversation appartient bien au user
   */
  listForUser: `
    SELECT
      m.id,
      m.conversation_id,
      m.sender_role,
      m.sender_user_id,
      m.content,
      m.created_at
    FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE m.conversation_id = $1
      AND c.user_id = $2
    ORDER BY m.created_at ASC
  `,

  /**
   * Liste des messages d'une conversation
   * - version CARE / ADMIN : pas de restriction sur le user
   */
  listForCare: `
    SELECT
      id,
      conversation_id,
      sender_role,
      sender_user_id,
      content,
      created_at
    FROM messages
    WHERE conversation_id = $1
    ORDER BY created_at ASC
  `,

  /**
   * Insertion d'un message
   */
  insertMessage: `
    INSERT INTO messages (
      conversation_id,
      sender_role,
      sender_user_id,
      content
    )
    VALUES ($1, $2, $3, $4)
  `,

  /**
   * Mise à jour de la conversation après ajout d'un message
   */
  touchConversation: `
    UPDATE conversations
    SET
      last_message_at = now(),
      updated_at = now()
    WHERE id = $1
  `,
};

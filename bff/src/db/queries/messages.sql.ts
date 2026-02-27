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
      m.chunk_ids,
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
      chunk_ids,
      created_at
    FROM messages
    WHERE conversation_id = $1
    ORDER BY created_at ASC
  `,

  /**
   * Insertion d'un message avec chunk_ids
   */
  insertMessage: `
    INSERT INTO messages (
      conversation_id,
      sender_role,
      sender_user_id,
      content,
      chunk_ids
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, chunk_ids
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

  /**
   * Récupérer le dernier message BOT avec ses chunks
   */
  getLastBotMessage: `
    SELECT id, chunk_ids, created_at
    FROM messages
    WHERE conversation_id = $1
      AND sender_role = 'BOT'
      AND chunk_ids IS NOT NULL
      AND array_length(chunk_ids, 1) > 0
    ORDER BY created_at DESC
    LIMIT 1
  `,
};
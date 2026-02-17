export const ConversationsSQL = {
  // --- USER ---

  create: `
    INSERT INTO conversations (user_id, status)
    VALUES ($1, 'OPEN')
    RETURNING
      id, user_id, status, assigned_admin_id,
      last_message_at, created_at, updated_at;
  `,

  getForUser: `
    SELECT
      id, user_id, status, assigned_admin_id,
      last_message_at, created_at, updated_at
    FROM conversations
    WHERE id = $1 AND user_id = $2;
  `,

  listForUser: `
    SELECT
      id, user_id, status, assigned_admin_id,
      last_message_at, created_at, updated_at
    FROM conversations
    WHERE user_id = $1
    ORDER BY last_message_at DESC NULLS LAST, created_at DESC;
  `,

  // --- CARE / ADMIN ---

  getForCare: `
    SELECT
      c.id,
      c.user_id,
      u.email AS user_email,
      c.status,
      c.assigned_admin_id,
      c.last_message_at,
      c.created_at,
      c.updated_at
    FROM conversations c
    JOIN users u ON u.id = c.user_id
    WHERE c.id = $1;
  `,

  listForCare: `
    SELECT
      c.id,
      c.user_id,
      u.email AS user_email,
      c.status,
      c.assigned_admin_id,
      c.last_message_at,
      c.created_at,
      c.updated_at
    FROM conversations c
    JOIN users u ON u.id = c.user_id
    WHERE
      (
        $1 = 'ALL'
        OR ($1 = 'ESCALATED' AND c.status = 'ESCALATED')
        OR ($1 = 'NORMAL' AND c.status IN ('OPEN','CLOSED'))
      )
      AND
      (
        $2 = 'ALL'
        OR c.status = $2
      )
    ORDER BY
      CASE c.status
        WHEN 'ESCALATED' THEN 0
        WHEN 'OPEN' THEN 1
        WHEN 'CLOSED' THEN 2
        ELSE 3
      END,
      c.last_message_at DESC NULLS LAST,
      c.created_at DESC;
  `,

  setStatus: `
    UPDATE conversations
    SET status = $2,
        updated_at = now()
    WHERE id = $1
    RETURNING
      id, user_id, status, assigned_admin_id,
      last_message_at, created_at, updated_at;
  `,
} as const;

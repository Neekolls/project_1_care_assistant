// db/queries/documents.sql.ts

export const DocumentsSQL = {
  /**
   * Création d'un document
   * - visibility : ADMIN_ONLY | USER_SPECIFIC | PUBLIC
   * - owner_user_id :
   *    - NULL sauf si USER_SPECIFIC
   */
  insertDocument: `
    INSERT INTO documents (
      filename,
      mime_type,
      storage_path,
      visibility,
      owner_user_id
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING
      id,
      filename,
      mime_type,
      storage_path,
      visibility,
      owner_user_id,
      created_at,
      updated_at;
  `,

  /**
   * Récupération d'un document par id (care/admin)
   */
  getDocumentByIdCare: `
    SELECT
      id,
      filename,
      mime_type,
      storage_path,
      visibility,
      owner_user_id,
      created_at,
      updated_at
    FROM documents
    WHERE id = $1;
  `,

  /**
   * Récupération d'un document par id (user)
   * -> doit être PUBLIC ou USER_SPECIFIC appartenant au user
   */
  getDocumentByIdUser: `
    SELECT
      id,
      filename,
      mime_type,
      storage_path,
      visibility,
      owner_user_id,
      created_at,
      updated_at
    FROM documents
    WHERE id = $1
      AND (
        visibility = 'PUBLIC'
        OR (visibility = 'USER_SPECIFIC' AND owner_user_id = $2)
      );
  `,

  /**
   * Liste des documents accessibles pour un user
   */
  listDocumentsForUser: `
    SELECT
      id,
      filename,
      mime_type,
      visibility,
      created_at,
      updated_at
    FROM documents
    WHERE
      visibility = 'PUBLIC'
      OR (visibility = 'USER_SPECIFIC' AND owner_user_id = $1)
    ORDER BY created_at DESC;
  `,

  /**
   * Liste de tous les documents (care/admin)
   */
  listDocumentsForCare: `
    SELECT
      id,
      filename,
      mime_type,
      visibility,
      owner_user_id,
      created_at,
      updated_at
    FROM documents
    ORDER BY created_at DESC;
  `,

  /**
   * Suppression d'un document
   * (les chunks seront supprimés via ON DELETE CASCADE)
   */
  deleteDocument: `
    DELETE FROM documents
    WHERE id = $1;
  `,
};

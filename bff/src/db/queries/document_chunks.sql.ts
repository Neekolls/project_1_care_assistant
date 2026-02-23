// db/queries/document_chunks.sql.ts

export const DocumentChunksSQL = {
  /**
   * Insert en bulk.
   * On insère N chunks d'un document d'un coup.
   *
   * $1 = document_id (uuid)
   * $2 = chunk_index[] (int[])
   * $3 = page_number[] (int[]) (peut contenir des NULL)
   * $4 = content[] (text[])
   *
   * ON CONFLICT permet de reprocess un doc sans crash :
   * - si le chunk existe déjà (même document_id + chunk_index), on met à jour content/page_number.
   */
  upsertMany: `
    INSERT INTO document_chunks (document_id, chunk_index, page_number, content)
    SELECT
      $1::uuid,
      x.chunk_index,
      x.page_number,
      x.content
    FROM UNNEST(
      $2::int[],
      $3::int[],
      $4::text[]
    ) AS x(chunk_index, page_number, content)
    ON CONFLICT (document_id, chunk_index)
    DO UPDATE SET
      page_number = EXCLUDED.page_number,
      content = EXCLUDED.content
    RETURNING id, document_id, chunk_index, page_number, created_at;
  `,

  /**
   * Lister les chunks d'un document (debug/admin)
   */
  listByDocumentId: `
    SELECT
      id,
      document_id,
      chunk_index,
      page_number,
      content,
      created_at
    FROM document_chunks
    WHERE document_id = $1
    ORDER BY chunk_index ASC;
  `,

  /**
   * Récupérer des chunks par IDs (c'est typiquement ce que FAISS te renvoie)
   * - CARE : pas de filtre visibilité
   * (on JOIN documents pour remonter filename/visibility si tu veux afficher les sources)
   */
  getSourcesByChunkIdsCare: `
    SELECT
      dc.id AS chunk_id,
      dc.document_id,
      d.filename,
      d.visibility,
      d.owner_user_id,
      dc.chunk_index,
      dc.page_number,
      dc.content
    FROM document_chunks dc
    JOIN documents d ON d.id = dc.document_id
    WHERE dc.id = ANY($1::uuid[]);
  `,

  /**
   * Récupérer des chunks par IDs (FAISS) pour un USER
   * -> filtre accès via documents.visibility
   */
  getSourcesByChunkIdsUser: `
    SELECT
      dc.id AS chunk_id,
      dc.document_id,
      d.filename,
      d.visibility,
      dc.chunk_index,
      dc.page_number,
      dc.content
    FROM document_chunks dc
    JOIN documents d ON d.id = dc.document_id
    WHERE dc.id = ANY($1::uuid[])
      AND (
        d.visibility = 'PUBLIC'
        OR (d.visibility = 'USER_SPECIFIC' AND d.owner_user_id = $2)
      );
  `,

  /**
   * Delete tous les chunks d'un document (si tu reprocess)
   */
  deleteByDocumentId: `
    DELETE FROM document_chunks
    WHERE document_id = $1;
  `,
};

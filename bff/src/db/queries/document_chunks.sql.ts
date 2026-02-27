// db/queries/document_chunks.sql.ts - VERSION CORRIGÉE

export const DocumentChunksSQL = {
  /**
   * Insert en bulk avec ID cohérent
   * 
   * IMPORTANT : L'ID doit être "{document_id}_chunk_{chunk_index}"
   * pour matcher avec FAISS
   */
  upsertMany: `
    INSERT INTO document_chunks (id, document_id, chunk_index, page_number, content)
    SELECT
      $1::text || '_chunk_' || x.chunk_index::text,  -- ID cohérent avec FAISS
      $1::uuid,
      x.chunk_index,
      x.page_number,
      x.content
    FROM UNNEST(
      $2::int[],
      $3::int[],
      $4::text[]
    ) AS x(chunk_index, page_number, content)
    ON CONFLICT (id)
    DO UPDATE SET
      page_number = EXCLUDED.page_number,
      content = EXCLUDED.content
    RETURNING id, document_id, chunk_index, page_number, created_at;
  `,

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
    WHERE dc.id = ANY($1::text[]);  -- ✅ CORRIGÉ : text[] au lieu de uuid[]
  `,

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
    WHERE dc.id = ANY($1::text[])  -- ✅ CORRIGÉ : text[] au lieu de uuid[]
      AND (
        d.visibility = 'PUBLIC'
        OR (d.visibility = 'USER_SPECIFIC' AND d.owner_user_id = $2)
      );
  `,

  deleteByDocumentId: `
    DELETE FROM document_chunks
    WHERE document_id = $1;
  `,
};
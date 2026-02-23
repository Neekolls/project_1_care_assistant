// db/repos/document_chunks.repo.ts

import { pool } from "../../db";
import { DocumentChunksSQL } from "../queries/document_chunks.sql";

/**
 * Un chunk tel qu'on le reçoit après parsing/chunking PDF.
 * - chunk_index : ordre dans le document (0,1,2,... ou 1,2,... à toi de choisir, mais sois constant)
 * - page_number : page PDF (commence à 1), peut être null si inconnu
 * - content : texte du chunk (source RAG)
 */
export type NewChunk = {
  chunk_index: number;
  page_number: number | null;
  content: string;
};

/**
 * Upsert en bulk des chunks pour un document.
 * - utile quand tu (re)process un PDF :
 *   - si un chunk (document_id + chunk_index) existe déjà -> update content/page_number
 *   - sinon -> insert
 *
 * IMPORTANT: On utilise des tableaux + UNNEST côté SQL pour perf + simplicité.
 */
export async function upsertDocumentChunks(
  documentId: string,
  chunks: NewChunk[]
) {
  if (!chunks.length) return [];

  const chunkIndexes = chunks.map((c) => c.chunk_index);
  const pageNumbers = chunks.map((c) => c.page_number);
  const contents = chunks.map((c) => c.content);

  const r = await pool.query(DocumentChunksSQL.upsertMany, [
    documentId,
    chunkIndexes,
    pageNumbers,
    contents,
  ]);

  return r.rows;
}

/**
 * Liste tous les chunks d'un document (plutôt admin/debug).
 */
export async function listDocumentChunksByDocumentId(documentId: string) {
  const r = await pool.query(DocumentChunksSQL.listByDocumentId, [documentId]);
  return r.rows;
}

/**
 * Récupère les "sources" (chunks) à partir d'une liste d'IDs de chunks.
 * Cas d'usage :
 * - FAISS te renvoie des chunk_ids les plus similaires
 * - tu veux afficher les sources (filename/page/content)
 *
 * Version CARE/ADMIN : pas de filtrage de visibilité.
 */
export async function getChunkSourcesCare(chunkIds: string[]) {
  if (!chunkIds.length) return [];

  const r = await pool.query(DocumentChunksSQL.getSourcesByChunkIdsCare, [
    chunkIds,
  ]);
  return r.rows;
}

/**
 * Récupère les "sources" (chunks) pour un user.
 * Même idée que getChunkSourcesCare, mais on applique les règles d'accès :
 * - PUBLIC OK
 * - USER_SPECIFIC OK si owner_user_id = userId
 * - ADMIN_ONLY jamais
 */
export async function getChunkSourcesUser(chunkIds: string[], userId: string) {
  if (!chunkIds.length) return [];

  const r = await pool.query(DocumentChunksSQL.getSourcesByChunkIdsUser, [
    chunkIds,
    userId,
  ]);
  return r.rows;
}

/**
 * Supprime tous les chunks d'un document (utile pour reprocess un PDF).
 */
export async function deleteChunksByDocumentId(documentId: string) {
  await pool.query(DocumentChunksSQL.deleteByDocumentId, [documentId]);
}

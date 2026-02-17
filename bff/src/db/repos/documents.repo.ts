// db/repos/documents.repo.ts

import { pool } from "../../db";
import { DocumentsSQL } from "../queries/documents.sql";

/**
 * Création d'un document (care/admin)
 */
export async function createDocument(
  filename: string,
  mimeType: string,
  storagePath: string,
  visibility: "ADMIN_ONLY" | "USER_SPECIFIC" | "PUBLIC",
  ownerUserId: string | null
) {
  const r = await pool.query(DocumentsSQL.insertDocument, [
    filename,
    mimeType,
    storagePath,
    visibility,
    ownerUserId,
  ]);

  return r.rows[0];
}

/**
 * Récupération d'un document (care/admin)
 */
export async function getDocumentByIdCare(documentId: string) {
  const r = await pool.query(DocumentsSQL.getDocumentByIdCare, [documentId]);
  return r.rows[0] || null;
}

/**
 * Récupération d'un document (user)
 */
export async function getDocumentByIdUser(
  documentId: string,
  userId: string
) {
  const r = await pool.query(DocumentsSQL.getDocumentByIdUser, [
    documentId,
    userId,
  ]);
  return r.rows[0] || null;
}

/**
 * Liste des documents accessibles pour un user
 */
export async function listDocumentsForUser(userId: string) {
  const r = await pool.query(DocumentsSQL.listDocumentsForUser, [userId]);
  return r.rows;
}

/**
 * Liste de tous les documents (care/admin)
 */
export async function listDocumentsForCare() {
  const r = await pool.query(DocumentsSQL.listDocumentsForCare);
  return r.rows;
}

/**
 * Suppression d'un document
 */
export async function deleteDocument(documentId: string) {
  await pool.query(DocumentsSQL.deleteDocument, [documentId]);
}

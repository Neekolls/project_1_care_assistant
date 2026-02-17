import { pool } from "../../db";
import { UsersSQL } from "../queries/users.sql";

/**
 * Représentation d'un user "public"
 * (sans le password)
 */
export type UserRow = {
  id: string;
  email: string;
  role: "USER" | "ADMIN" | "CARE";
  created_at: string;
};

/**
 * Représentation d'un user avec son hash
 * (utilisé UNIQUEMENT pour le login)
 */
export type UserWithPasswordRow = UserRow & {
  password_hash: string;
};

/**
 * Crée un utilisateur en base.
 * Le hash du mot de passe est déjà calculé AVANT l'appel.
 */
export async function createUser(
  email: string,
  passwordHash: string,
  role: UserRow["role"]
): Promise<UserRow> {
  const r = await pool.query(UsersSQL.create, [
    email,
    passwordHash,
    role,
  ]);
  return r.rows[0];
}

/**
 * Trouve un user par email.
 * Utilisé lors du login.
 */
export async function findUserByEmail(
  email: string
): Promise<UserWithPasswordRow | null> {
  const r = await pool.query(UsersSQL.findByEmail, [email]);
  return r.rows[0] || null;
}

/**
 * Trouve un user par id.
 * Utilisé pour /me (session).
 */
export async function findUserById(
  id: string
): Promise<UserRow | null> {
  const r = await pool.query(UsersSQL.findById, [id]);
  return r.rows[0] || null;
}

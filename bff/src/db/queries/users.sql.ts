/**
 * users.sql.ts
 * ----------------
 * Ce fichier contient UNIQUEMENT des requêtes SQL liées à la table users.
 * Aucune logique applicative, aucun appel à pool ici.
 */

export const UsersSQL = {
  /**
   * Crée un utilisateur.
   * - id généré par Postgres (gen_random_uuid())
   * - role fourni par l'appelant (USER / ADMIN / CARE)
   */
  create: `
    INSERT INTO users (email, password_hash, role)
    VALUES ($1, $2, $3)
    RETURNING
      id,
      email,
      role,
      created_at;
  `,

  /**
   * Récupère un user par email.
   * Utilisé pour le login.
   */
  findByEmail: `
    SELECT
      id,
      email,
      password_hash,
      role,
      created_at
    FROM users
    WHERE email = $1;
  `,

  /**
   * Récupère un user par id.
   * Utilisé pour /me (session).
   */
  findById: `
    SELECT
      id,
      email,
      role,
      created_at
    FROM users
    WHERE id = $1;
  `,
} as const;

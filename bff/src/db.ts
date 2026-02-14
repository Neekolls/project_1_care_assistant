// On importe la classe Pool depuis la librairie "pg".
// "pg" est le client PostgreSQL pour Node.js.
// Il permet à ton backend (BFF) de parler à la base Postgres.
import { Pool } from "pg";

/**
 * Pool = gestionnaire de connexions à PostgreSQL.
 *
 * Pourquoi un Pool ?
 * - Ouvrir une connexion à Postgres coûte cher (réseau, ressources).
 * - Une API reçoit potentiellement plusieurs requêtes par seconde.
 * - On ne veut PAS ouvrir/fermer une connexion à chaque requête HTTP.
 *
 * Le Pool :
 * - ouvre quelques connexions au démarrage de l'app
 * - les garde en mémoire
 * - les réutilise pour chaque requête SQL
 *
 * C'est une bonne pratique standard en backend.
 */
export const pool = new Pool({
      /**
   * Host = adresse du serveur PostgreSQL.
   *
   * En développement :
   * - ton BFF tourne sur ta machine (Node)
   * - PostgreSQL tourne dans Docker
   * - Docker expose Postgres sur "localhost"
   *
   * process.env.DB_HOST permet de changer cette valeur
   * sans modifier le code (prod, CI, staging, etc.)
   */
  host: process.env.DB_HOST || "localhost",
    /**
   * Port d'écoute de PostgreSQL.
   *
   * Le port standard de Postgres est 5432.
   * Les variables d'environnement sont toujours des strings,
   * donc on force le cast en number avec Number(...).
   */
  port: Number(process.env.DB_PORT || 5432),
    /**
   * Utilisateur PostgreSQL.
   *
   * ATTENTION :
   * - ce n'est PAS un utilisateur de ton application
   * - c'est un compte PostgreSQL (niveau base de données)
   *
   * Il correspond à POSTGRES_USER dans docker-compose.yml.
   */
  user: process.env.DB_USER || "ca",
    /**
   * Mot de passe du compte PostgreSQL.
   *
   * En développement, on peut mettre une valeur par défaut.
   * En production, cette valeur doit toujours venir
   * d'une variable d'environnement sécurisée.
   */
  password: process.env.DB_PASSWORD || "ca",
  
  /**
   * Nom de la base de données PostgreSQL.
   *
   * Une même instance Postgres peut contenir plusieurs bases.
   * Ici, on se connecte à la base "care_assistant".
   */
  database: process.env.DB_NAME || "care_assistant",
});
console.log("[DB] host:", process.env.DB_HOST || "localhost",
  "| port:", process.env.DB_PORT || "5432",
  "| user:", process.env.DB_USER || "ca",
  "| db:", process.env.DB_NAME || "care_assistant",
  "| password length:", (process.env.DB_PASSWORD || "ca").length
);

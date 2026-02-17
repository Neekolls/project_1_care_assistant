import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import "dotenv/config";


// Nouveau: bcrypt pour hasher / vérifier les mots de passe
import bcrypt from "bcrypt";

import { createUser, findUserByEmail } from "./db/repos/users.repo";


/**
 * BFF = Backend For Frontend
 * => C'est LE serveur que ton frontend appelle.
 * => Il gère l'auth (register/login/logout/me)
 * => Plus tard, il pourra aussi "proxy" vers le backend Python (RAG/LLM).
 */

const app = express();

/**
 * Middleware Express :
 * - express.json() : parse le body JSON => req.body disponible
 * - cookieParser() : parse les cookies => req.cookies disponible
 */
app.use(express.json());
app.use(cookieParser());

/**
 * Secret JWT
 * - en prod: variable d'environnement OBLIGATOIRE
 * - en dev: valeur par défaut pour avancer
 */
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

/**
 * Nom du cookie où on stocke le JWT.
 * - httpOnly => le JS du navigateur ne peut pas lire le cookie (sécurité)
 */
const COOKIE_NAME = "ca_token";

/**
 * Petit type pratique: "ce qu'on met dans req.user"
 */
type AuthUser = { id: string; email: string; role: "USER" | "ADMIN" | "CARE" };

/**
 * sign(user)
 * Crée un JWT signé avec:
 * - sub (subject) = user.id (clé technique interne)
 * - email, role (utile pour l'UI et autorisations)
 */
function sign(user: AuthUser) {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, JWT_SECRET, {
    expiresIn: "7d",
  });
}

/**
 * Middleware auth
 * - lit le cookie
 * - vérifie le JWT
 * - injecte req.user si OK
 */
function auth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = req.cookies[COOKIE_NAME];

  // Pas de cookie => pas connecté
  if (!token) return res.status(401).json({ ok: false, error: "Not authenticated" });

  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;

    // On attache l'utilisateur à la requête (données issues du JWT)
    (req as any).user = { id: payload.sub, email: payload.email, role: payload.role } as AuthUser;

    return next();
  } catch {
    return res.status(401).json({ ok: false, error: "Invalid token" });
  }
}

/**
 * POST /api/auth/register
 * Crée un compte STANDARD (USER uniquement)
 *
 * Pourquoi USER uniquement ?
 * - éviter qu'un client se crée un ADMIN en se registrant
 * - les comptes ADMIN/CARE sont créés manuellement en SQL (comme tu veux)
 */
app.post("/api/auth/register", async (req, res) => {
  const { email, password } = req.body || {};

  // Validation minimale
  if (!email || !password) {
    return res.status(400).json({ detail: "email and password required" });
  }

  // 1) Vérifier si l'email existe déjà
  const existing = await findUserByEmail(email);
  if (existing) {
    return res.status(409).json({ detail: "Email already exists" });
  }

  // 2) Hash du mot de passe (jamais de password en clair en DB)
  const password_hash = await bcrypt.hash(password, 12);

  try {
    // 3) Créer l'utilisateur en DB (role USER uniquement)
    await createUser(email, password_hash, "USER");
    return res.json({ ok: true });
  } catch (e: any) {
    console.error("[REGISTER] createUser failed:", e);
    return res.status(500).json({ detail: "DB error" });
  }

});


/**
 * POST /api/auth/login
 * Reçoit { email, password }
 * - lit l'utilisateur en DB (par email)
 * - compare password avec password_hash via bcrypt
 * - si ok: pose un cookie httpOnly avec le JWT
 */
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) return res.status(400).json({ detail: "email and password required" });
  console.log("[REGISTER] trying:", email);

  const user = await findUserByEmail(email);

  
  if (!user) return res.status(401).json({ detail: "Bad credentials" });

  // 2) Compare le mot de passe (clair) avec le hash stocké
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ detail: "Bad credentials" });

  // 3) Crée le JWT (session)
  const token = sign({ id: user.id, email: user.email, role: user.role });

  // 4) Stocke le JWT dans un cookie httpOnly
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false, // dev => false ; prod => true (HTTPS obligatoire)
  });

  return res.json({ ok: true });
});

/**
 * POST /api/auth/logout
 * Supprime le cookie => déconnecte
 */
app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

/**
 * GET /api/me
 * Route protégée: renvoie le user connecté (depuis le JWT)
 *
 * Note: ici on ne requête pas Postgres.
 * - on fait confiance au JWT
 * - plus tard, tu pourrais revalider en DB si tu veux (revocation, etc.)
 */
app.get("/api/me", auth, (req, res) => {
  res.json({ ok: true, user: (req as any).user as AuthUser });
});

/**
 * Démarrage du serveur
 */
const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  console.log(`BFF listening on http://localhost:${port}`);
});

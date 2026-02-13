import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";

/**
 * BFF = Backend For Frontend
 * => C'est LE serveur que ton frontend appelle.
 * => Il gère l'auth (login/logout/me), puis plus tard il proxy vers le backend Python.
 */

const app = express();

/**
 * Middleware Express :
 * - express.json() : permet de lire le body JSON des requêtes (req.body)
 * - cookieParser() : permet de lire les cookies (req.cookies)
 */
app.use(express.json());
app.use(cookieParser());

/**
 * Secret JWT
 * - en prod: dans une variable d'environnement (env)
 * - ici: valeur dev pour simplifier
 */
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

/**
 * Nom du cookie dans lequel on met le JWT
 * - httpOnly => le JS du navigateur ne peut pas le lire (sécurité)
 */
const COOKIE_NAME = "ca_token";

/**
 * MVP: base users en dur.
 * Plus tard: on remplacera par PostgreSQL.
 */
const USERS = [
  { id: "1", email: "admin@test.com", password: "admin123", role: "ADMIN" },
  { id: "2", email: "user@test.com", password: "user123", role: "USER" },
] as const;

/**
 * sign(user)
 * Crée un JWT signé avec:
 * - sub (subject) = user.id
 * - email, role
 * Ce JWT sera mis dans un cookie.
 */
function sign(user: { id: string; email: string; role: string }) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" } // durée de validité du token
  );
}

/**
 * auth middleware
 * Vérifie si l'utilisateur est authentifié:
 * - lit le cookie ca_token
 * - vérifie le JWT
 * - injecte req.user si ok
 */
function auth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = req.cookies[COOKIE_NAME];

  // Pas de cookie => pas connecté
  if (!token) {
    return res.status(401).json({ ok: false, error: "Not authenticated" });
  }

  try {
    // Vérifie signature + expiration
    const payload = jwt.verify(token, JWT_SECRET) as any;

    // On attache l'utilisateur à la requête pour les routes suivantes
    (req as any).user = { id: payload.sub, email: payload.email, role: payload.role };

    return next();
  } catch {
    // Token invalide ou expiré
    return res.status(401).json({ ok: false, error: "Invalid token" });
  }
}

/**
 * POST /api/auth/login
 * Reçoit { email, password }
 * - si ok: pose un cookie httpOnly avec le JWT
 * - si pas ok: renvoie 401
 */
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body || {};

  const user = USERS.find((u) => u.email === email && u.password === password);

  if (!user) {
    return res.status(401).json({ detail: "Bad credentials" });
  }

  const token = sign(user);

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false, // en dev => false ; en prod => true avec HTTPS
  });

  return res.json({ ok: true });
});

/**
 * POST /api/auth/logout
 * Supprime le cookie, donc déconnecte.
 */
app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

/**
 * GET /api/me
 * Route protégée: renvoie le user connecté (id/email/role)
 */
app.get("/api/me", auth, (req, res) => {
  res.json({ ok: true, user: (req as any).user });
});

/**
 * Démarrage du serveur
 * Le frontend (via Vite proxy) va appeler http://localhost:3001
 */
const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  console.log(`BFF listening on http://localhost:${port}`);
});

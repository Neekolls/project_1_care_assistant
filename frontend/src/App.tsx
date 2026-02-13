import { useEffect, useState } from "react";

/**
 * TypeScript: on décrit la forme de la réponse attendue de /api/me
 * - ok: indique si l'appel a réussi
 * - user: présent seulement si connecté
 * - error: message éventuel en cas d'erreur
 */
type Me = {
  ok: boolean;
  user?: { id: string; email: string; role: string };
  error?: string;
};

export default function App() {
  /**
   * ÉTAT (state) React : ce sont des variables "réactives".
   * Quand elles changent (setEmail, setMe, etc.), React re-render le composant.
   */

  // Champs du formulaire (valeurs par défaut pour tester vite)
  const [email, setEmail] = useState("admin@test.com");
  const [password, setPassword] = useState("admin123");

  // Contiendra la réponse de /api/me (user connecté ou erreur)
  const [me, setMe] = useState<Me | null>(null);

  // Petit message d'erreur/feedback (ex: mauvais login)
  const [msg, setMsg] = useState<string>("");

  /**
   * refreshMe()
   * Objectif: demander au BFF "qui suis-je ?" via /api/me
   * - Si on a un cookie JWT valide => le BFF renvoie { ok:true, user:{...} }
   * - Sinon => { ok:false, error:"Not authenticated" } (selon notre BFF)
   */
  async function refreshMe() {
    // fetch("/api/me") passe par le proxy Vite (vite.config.ts)
    // et arrive en réalité sur http://localhost:3001/api/me (le BFF).
    //
    // credentials: "include" = SUPER IMPORTANT :
    // - autorise le navigateur à envoyer les cookies au serveur
    // - et à accepter les cookies renvoyés par le serveur
    // Sans ça: ton login ne "tiendra" pas car le cookie JWT ne sera pas utilisé.
    const r = await fetch("/api/me", { credentials: "include" });

    // On convertit la réponse HTTP en JSON
    const j = await r.json();

    // On stocke dans le state => ça met à jour l'affichage
    setMe(j);
  }

  /**
   * login()
   * Objectif: envoyer email+password au BFF
   * - Le BFF vérifie les identifiants
   * - S'ils sont bons, il crée un JWT et le met dans un cookie httpOnly
   * - Puis on appelle refreshMe() pour afficher la session
   */
  async function login() {
    // On reset un message d'erreur précédent
    setMsg("");

    const r = await fetch("/api/auth/login", {
      method: "POST", // login = on envoie des données => POST
      headers: { "Content-Type": "application/json" },
      credentials: "include", // pour accepter le cookie renvoyé par le BFF
      body: JSON.stringify({ email, password }), // payload JSON envoyé au BFF
    });

    const j = await r.json();

    // Si le status HTTP n'est pas OK (ex 401)
    // on affiche un message d'erreur (le BFF renvoie {detail:"Bad credentials"} dans notre exemple)
    if (!r.ok) setMsg(j?.detail || "Login failed");

    // Dans tous les cas, on tente de recharger /me
    // - Si login OK => /me renverra l'user
    // - Sinon => /me renverra "pas connecté"
    await refreshMe();
  }

  /**
   * logout()
   * Objectif: demander au BFF de supprimer le cookie de session
   * - Ensuite on refresh /me pour voir qu'on est déconnecté
   */
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    await refreshMe();
  }

  /**
   * useEffect(() => ..., [])
   * Ce bloc s'exécute 1 seule fois au "montage" du composant (quand la page s'affiche).
   * Ici, on veut: dès l'ouverture de l'app, vérifier si un cookie existe déjà.
   */
  useEffect(() => {
    refreshMe();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-xl p-6">
        <h1 className="text-2xl font-semibold">Care Assistant</h1>

        {/* Carte Login */}
        <div className="mt-6 rounded-2xl bg-white p-4 shadow">
          <div className="text-sm font-medium mb-2">Login</div>

          <div className="grid gap-2">
            {/* Input email: contrôlé par state */}
            <input
              className="rounded-lg border p-2"
              value={email} // valeur = state
              onChange={(e) => setEmail(e.target.value)} // update state quand on tape
              placeholder="email"
            />

            {/* Input password: contrôlé par state */}
            <input
              className="rounded-lg border p-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password"
              type="password"
            />

            {/* Boutons d'actions */}
            <div className="flex gap-2">
              <button
                className="rounded-lg bg-black px-3 py-2 text-white"
                onClick={login} // appelle la fonction login()
              >
                Login
              </button>

              <button
                className="rounded-lg border px-3 py-2"
                onClick={logout} // appelle logout()
              >
                Logout
              </button>

              <button
                className="rounded-lg border px-3 py-2"
                onClick={refreshMe} // re-check /me à la demande
              >
                Refresh /me
              </button>
            </div>

            {/* Si msg n'est pas vide => on l'affiche en rouge */}
            {msg && <div className="text-sm text-red-600">{msg}</div>}
          </div>
        </div>

        {/* Carte Session: on affiche le JSON retourné par /api/me */}
        <div className="mt-4 rounded-2xl bg-white p-4 shadow">
          <div className="text-sm font-medium mb-2">Session</div>
          <pre className="text-xs overflow-auto">
            {JSON.stringify(me, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}

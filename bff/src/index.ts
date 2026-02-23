// bff/src/index.ts
import express from "express";
import cookieParser from "cookie-parser";
import "dotenv/config";

import { buildAuthRouter, buildMeRouter } from "./routes/auth.routes";
import { buildConversationsRouter } from "./routes/conversations.routes";
import { buildMessagesRouter } from "./routes/messages.routes";
import { buildEscalationsRouter } from "./routes/escalations.routes";
import {buildDocumentsRouter,buildCareDocumentsRouter,} from "./routes/documents.routes";
import { buildDocumentChunksRouter } from "./routes/document_chunks.routes";
import { buildRagRouter } from "./routes/rag.routes";



/**
 * BFF = Backend For Frontend
 * => serveur appelé par le frontend
 */
const app = express();

app.use(express.json());
app.use(cookieParser());

/**
 * Config JWT + cookie
 */
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const COOKIE_NAME = "ca_token";

/**
 * Brancher les routes
 * - /api/auth/* : register/login/logout
 * - /api/me : session info
 */
app.use("/api/auth", buildAuthRouter({ jwtSecret: JWT_SECRET, cookieName: COOKIE_NAME }));
app.use("/api", buildMeRouter({ jwtSecret: JWT_SECRET, cookieName: COOKIE_NAME }));
app.use("/api/conversations", buildConversationsRouter({jwtSecret: JWT_SECRET, cookieName: COOKIE_NAME,}));
app.use("/api/messages", buildMessagesRouter({jwtSecret: JWT_SECRET, cookieName: COOKIE_NAME,}));
app.use("/api/escalations", buildEscalationsRouter({jwtSecret: JWT_SECRET, cookieName: COOKIE_NAME,}));
app.use("/api/documents",buildDocumentsRouter({jwtSecret: JWT_SECRET,cookieName: COOKIE_NAME,}));
app.use("/api/care/documents",buildCareDocumentsRouter({jwtSecret: JWT_SECRET,cookieName: COOKIE_NAME,}));
app.use("/api/care",buildDocumentChunksRouter({ jwtSecret: JWT_SECRET, cookieName: COOKIE_NAME }));
app.use("/api",buildRagRouter({ jwtSecret: JWT_SECRET, cookieName: COOKIE_NAME }));




/**
 * Start server
 */
const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, () => {
  console.log(`BFF listening on http://localhost:${PORT}`);
});

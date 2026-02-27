// bff/src/index.ts
import express from "express";
import cookieParser from "cookie-parser";
import "dotenv/config";

import { buildAuthRouter, buildMeRouter } from "./routes/auth.routes";
import { 
  buildUserConversationsRouter,
  buildCareConversationsRouter 
} from "./routes/conversations.routes";
import { 
  buildUserMessagesRouter,
  buildCareMessagesRouter 
} from "./routes/messages.routes";
import { buildUserEscalationsRouter } from "./routes/escalations.routes";
import {
  buildUserDocumentsRouter,
  buildCareDocumentsRouter,
} from "./routes/documents.routes";

import { 
  buildUserRagRouter,
  buildCareRagRouter 
} from "./routes/rag.routes";
import { buildChatRouter } from "./routes/chat.routes";



/**
 * BFF = Backend For Frontend
 * => serveur appelé par le frontend
 */
const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

/**
 * Config JWT + cookie
 */
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const COOKIE_NAME = "ca_token";

const routeOpts = { jwtSecret: JWT_SECRET, cookieName: COOKIE_NAME };

/**
 * ==========================================
 * ROUTES PUBLIQUES (sans auth)
 * ==========================================
 */
app.use("/api/auth", buildAuthRouter(routeOpts));

/**
 * ==========================================
 * ROUTES USER (avec auth USER)
 * ==========================================
 */
app.use("/api", buildMeRouter(routeOpts));
app.use("/api/conversations", buildUserConversationsRouter(routeOpts));
app.use("/api/messages", buildUserMessagesRouter(routeOpts));
app.use("/api/escalations", buildUserEscalationsRouter(routeOpts));
app.use("/api/documents", buildUserDocumentsRouter(routeOpts));
app.use("/api", buildUserRagRouter(routeOpts)); // POST /api/sources
app.use("/api/chat", buildChatRouter({ jwtSecret: JWT_SECRET, cookieName: COOKIE_NAME }));


/**
 * ==========================================
 * ROUTES CARE/ADMIN (avec auth CARE/ADMIN)
 * ==========================================
 */
app.use("/api/care/conversations", buildCareConversationsRouter(routeOpts));
app.use("/api/care/messages", buildCareMessagesRouter(routeOpts));
app.use("/api/care/documents", buildCareDocumentsRouter(routeOpts));
app.use("/api/care", buildCareRagRouter(routeOpts)); // POST /api/care/sources

/**
 * Start server
 */
const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, () => {
  console.log(`🚀 BFF listening on http://localhost:${PORT}`);
  console.log(`📝 USER routes: /api/*`);
  console.log(`👨‍💼 CARE routes: /api/care/*`);
});
import { ERROR_CODE, fail } from "@lex/shared";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { type Variables } from "./lib/context";
import { env } from "./lib/env";
import { authMiddleware, localeMiddleware } from "./middleware";
import { approvalRoutes } from "./routes/approvals";
import { auditRoutes } from "./routes/audit";
import { authRoutes } from "./routes/auth";
import { chatRoutes } from "./routes/chat";
import { didoxNotifyRoutes } from "./routes/didox-notify";
import { paymentRoutes, paymentWebhookRoutes } from "./routes/payment";
import { debtorPortalRoutes } from "./routes/debtor-portal";
import { merchantRoutes } from "./routes/merchant";
import { platformRoutes } from "./routes/platform";
import { studioRoutes } from "./routes/studio";
import { agentChatRoutes } from "./routes/agent-chat";
import { companyRoutes } from "./routes/companies";
import { contractRoutes } from "./routes/contracts";
import { courtRoutes } from "./routes/court";
import { dashboardRoutes } from "./routes/dashboard";
import { documentRoutes } from "./routes/documents";
import { miscRoutes } from "./routes/misc";
import { oneIdRoutes } from "./routes/oneid";
import { overdueRoutes } from "./routes/overdue";
import { receivableRoutes } from "./routes/receivables";
import { agentConsoleRoutes } from "./routes/agent-console";
import { agentAutopilotRoutes } from "./routes/agent-autopilot";
import { reminderRoutes } from "./routes/reminders";
import { reportRoutes } from "./routes/reports";
import { syncRoutes } from "./routes/sync";
import { settingsRoutes } from "./routes/settings";
import { commandCenterRoutes } from "./routes/command-center";
import { v2DebtRoutes } from "./routes/v2/debts";

export function createApp() {
  const app = new Hono<{ Variables: Variables }>();

  app.use("*", cors({ origin: [env.webUrl], credentials: true, allowHeaders: ["Content-Type", "Authorization", "X-Lang"] }));
  app.use("*", localeMiddleware);
  // Katta so'rov tanasi (masalan cheksiz base64 fayl) resurs tugashiga sabab bo'lmasin —
  // eng katta ruxsat etilgan yuklama (hujjat/rasm extract endpointlari) atrofida, xavfsiz zaxira bilan.
  app.use("*", bodyLimit({ maxSize: 15 * 1024 * 1024, onError: (c) => c.json(fail(ERROR_CODE.VALIDATION_FAILED, "common.validation_failed", c.get("locale") ?? "uz"), 413) }));

  app.get("/health", (c) => c.json({ status: "ok", service: "lex-api" }));

  // Ochiq (auth talab qilmaydigan) yo'llar.
  app.route("/api/auth", authRoutes);
  // One-ID (SSO) callback ro'yxatdan o'tgan redirect_uri bilan mos bo'lishi uchun
  // `/auth/oneid/callback` yo'lida (api.tijoraat.uz), `/api` prefiksisiz.
  app.route("/auth", oneIdRoutes);
  // Click to'lov webhook'lari — kabinetdagi /click/prepare, /click/complete (ochiq, imzo bilan).
  app.route("/", paymentWebhookRoutes);
  app.route("/", debtorPortalRoutes);

  // Himoyalangan yo'llar.
  const api = new Hono<{ Variables: Variables }>();
  api.use("*", authMiddleware);
  api.route("/", dashboardRoutes);
  api.route("/", agentConsoleRoutes);
  api.route("/", agentAutopilotRoutes);
  api.route("/", merchantRoutes);
  api.route("/", companyRoutes);
  api.route("/", chatRoutes);
  api.route("/", studioRoutes);
  api.route("/", didoxNotifyRoutes);
  api.route("/", platformRoutes);
  api.route("/", paymentRoutes);
  api.route("/", agentChatRoutes);
  api.route("/", contractRoutes);
  api.route("/", courtRoutes);
  api.route("/", receivableRoutes);
  api.route("/", overdueRoutes);
  api.route("/", reportRoutes);
  api.route("/", documentRoutes);
  api.route("/", reminderRoutes);
  api.route("/", syncRoutes);
  api.route("/", auditRoutes);
  api.route("/approvals", approvalRoutes);
  api.route("/settings", settingsRoutes);
  api.route("/", miscRoutes);
  api.route("/v2", v2DebtRoutes);
  api.route("/", commandCenterRoutes);
  app.route("/api", api);

  // Global xato ishlovchi — hamma javob envelope formatida.
  app.onError((err, c) => {
    console.error("[api:error]", err);
    return c.json(fail(ERROR_CODE.INTERNAL, "common.internal_error", c.get("locale") ?? "uz"), 500);
  });

  app.notFound((c) => c.json(fail(ERROR_CODE.NOT_FOUND, "common.not_found", c.get("locale") ?? "uz"), 404));

  return app;
}

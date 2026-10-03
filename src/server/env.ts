import "server-only";

/**
 * Central place to read server env. Every external service is optional: when its keys are
 * missing, the mock adapter is used (see src/server/adapters/*). Nothing here throws at import.
 */
export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProd: process.env.NODE_ENV === "production" && process.env.MUBAZZAR_E2E !== "1",
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  authSecret: process.env.AUTH_SECRET ?? "dev-only-insecure-secret-change-me-in-production-please",
  cronSecret: process.env.CRON_SECRET ?? "",
  ipHashSalt: process.env.IP_HASH_SALT ?? "dev-salt",
  mockOtpCode: process.env.MOCK_OTP_CODE ?? "",

  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",

  metaPixelId: process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "",
  metaCapiToken: process.env.META_CAPI_ACCESS_TOKEN ?? "",
  metaTestEventCode: process.env.META_TEST_EVENT_CODE ?? "",

  termiiApiKey: process.env.TERMII_API_KEY ?? "",
  termiiSenderId: process.env.TERMII_SENDER_ID ?? "MUBAZZAR",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "MUBAZZAR <orders@mubazzar.ng>",
  waCloudToken: process.env.WHATSAPP_CLOUD_TOKEN ?? "",
  waCloudPhoneId: process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID ?? "",
};

export const services = {
  supabaseAuth: Boolean(env.supabaseUrl && env.supabaseAnonKey && env.supabaseServiceKey),
  supabaseStorage: Boolean(env.supabaseUrl && env.supabaseServiceKey),
  metaCapi: Boolean(env.metaPixelId && env.metaCapiToken),
  sms: Boolean(env.termiiApiKey),
  email: Boolean(env.resendApiKey),
  whatsappCloud: Boolean(env.waCloudToken && env.waCloudPhoneId),
};

if (env.isProd && env.authSecret.startsWith("dev-only")) {
  console.warn("[mubazzar] AUTH_SECRET is not set — sessions are signed with an insecure development secret.");
}

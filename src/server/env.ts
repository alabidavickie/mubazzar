import "server-only";

import { siteUrl } from "@/lib/site";

const isProd = process.env.NODE_ENV === "production";
/** Local E2E server only (scripts/e2e-server.mjs). Never true on Vercel, whatever env vars are set. */
const testHooks = process.env.MUBAZZAR_E2E === "1" && !process.env.VERCEL && !process.env.VERCEL_ENV;

/**
 * A secret that must be strong in production. Checked lazily (at first use, not at import) so
 * `next build` works without runtime secrets; a production server refuses to sign sessions or hash
 * IPs with a missing/short secret instead of silently falling back to a value that is in the repo.
 */
function requiredSecret(name: string, value: string | undefined, minLength: number, devFallback: string): () => string {
  return () => {
    if (value && value.length >= minLength) return value;
    if (isProd) throw new Error(`${name} must be set to a random value of at least ${minLength} characters in production`);
    return devFallback;
  };
}

/**
 * Central place to read server env. Every external service is optional: when its keys are
 * missing, the mock adapter is used (see src/server/adapters/*). Nothing here throws at import.
 */
export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProd,
  testHooks,
  siteUrl: siteUrl(),
  authSecret: requiredSecret("AUTH_SECRET", process.env.AUTH_SECRET, 32, "dev-only-insecure-secret-change-me-in-production-please"),
  cronSecret: process.env.CRON_SECRET ?? "",
  ipHashSalt: requiredSecret("IP_HASH_SALT", process.env.IP_HASH_SALT, 16, "dev-only-ip-hash-salt"),
  /** Fixed OTP for development and the local E2E server only — ignored in production deployments. */
  mockOtpCode: !isProd || testHooks ? (process.env.MOCK_OTP_CODE ?? "") : "",

  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",

  metaPixelId: process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "",
  metaCapiToken: process.env.META_CAPI_ACCESS_TOKEN ?? "",
  metaTestEventCode: process.env.META_TEST_EVENT_CODE ?? "",

  resendApiKey: process.env.RESEND_API_KEY ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "MUBAZZAR <orders@mubazzar.ng>",
  waCloudToken: process.env.WHATSAPP_CLOUD_TOKEN ?? "",
  waCloudPhoneId: process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID ?? "",
};

export const services = {
  supabaseAuth: Boolean(env.supabaseUrl && env.supabaseAnonKey && env.supabaseServiceKey),
  supabaseStorage: Boolean(env.supabaseUrl && env.supabaseServiceKey),
  metaCapi: Boolean(env.metaPixelId && env.metaCapiToken),
  email: Boolean(env.resendApiKey),
  whatsappCloud: Boolean(env.waCloudToken && env.waCloudPhoneId),
};

if (env.isProd && env.siteUrl.startsWith("http://localhost")) {
  console.warn("[mubazzar] NEXT_PUBLIC_SITE_URL is not set — canonical URLs, the sitemap and SMS tracking links will point at localhost.");
}

/**
 * Plain-language reason shown when Supabase refuses to send a login code. GoTrue answers with an `error_code`
 * (https://supabase.com/docs/guides/auth/debugging/error-codes); the exact code is also logged server-side so the
 * owner can diagnose it in the Vercel logs, but customers only ever see these sentences.
 */
export function otpRequestError(status: number, errorCode?: string | null): string {
  switch (errorCode) {
    case "phone_provider_disabled":
    case "sms_send_failed":
      return "Phone codes aren't switched on yet. Please use your email address instead.";
    case "over_sms_send_rate_limit":
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many codes requested. Please wait a few minutes and try again.";
    default:
      return status === 429 ? "Too many codes requested. Please wait a few minutes and try again." : "Could not send the code. Try again shortly.";
  }
}

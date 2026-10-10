import { describe, expect, it } from "vitest";
import { otpRequestError } from "./otp-errors";

describe("otpRequestError", () => {
  it("tells customers to use email when phone codes are not enabled", () => {
    expect(otpRequestError(400, "phone_provider_disabled")).toMatch(/use your email/i);
    expect(otpRequestError(400, "sms_send_failed")).toMatch(/use your email/i);
  });
  it("asks for patience on rate limits, by code or by HTTP 429", () => {
    for (const code of ["over_sms_send_rate_limit", "over_email_send_rate_limit", "over_request_rate_limit"]) {
      expect(otpRequestError(429, code)).toMatch(/wait a few minutes/i);
    }
    expect(otpRequestError(429, null)).toMatch(/wait a few minutes/i);
  });
  it("never leaks the provider's internal wording for anything else", () => {
    expect(otpRequestError(400, "email_address_not_authorized")).toBe("Could not send the code. Try again shortly.");
    expect(otpRequestError(500, undefined)).toBe("Could not send the code. Try again shortly.");
  });
});

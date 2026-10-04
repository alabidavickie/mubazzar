import { describe, expect, it } from "vitest";
import { buildTimeline } from "./order-timeline";

const states = (status: string, events = []) => buildTimeline(status, events).map((s) => `${s.key}:${s.state}`);

describe("buildTimeline", () => {
  it("new order: placed is current, the rest upcoming", () => {
    expect(states("awaiting_chat")).toEqual([
      "awaiting_chat:current",
      "in_chat:upcoming",
      "confirmed:upcoming",
      "dispatched:upcoming",
      "delivered:upcoming",
    ]);
  });

  it("dispatched: earlier steps done", () => {
    expect(states("dispatched")).toEqual([
      "awaiting_chat:done",
      "in_chat:done",
      "confirmed:done",
      "dispatched:current",
      "delivered:upcoming",
    ]);
  });

  it("cancelled straight from awaiting_chat (auto-cancel) shows no upcoming steps", () => {
    expect(states("cancelled")).toEqual(["awaiting_chat:done", "cancelled:problem"]);
  });

  it("cancelled after confirmation keeps the history", () => {
    const events = [
      { kind: "created", created_at: "2026-10-01T10:00:00Z" },
      { kind: "status_changed", to_status: "in_chat", created_at: "2026-10-01T10:05:00Z" },
      { kind: "status_changed", to_status: "confirmed", created_at: "2026-10-01T10:10:00Z" },
      { kind: "status_changed", to_status: "cancelled", created_at: "2026-10-01T11:00:00Z" },
    ];
    const t = buildTimeline("cancelled", events);
    expect(t.map((s) => `${s.key}:${s.state}`)).toEqual([
      "awaiting_chat:done",
      "in_chat:done",
      "confirmed:done",
      "cancelled:problem",
    ]);
    expect(t[0]!.at).toBe("2026-10-01T10:00:00Z");
    expect(t[3]!.at).toBe("2026-10-01T11:00:00Z");
  });

  it("failed delivery implies it was dispatched", () => {
    expect(states("failed_delivery")).toEqual([
      "awaiting_chat:done",
      "in_chat:done",
      "confirmed:done",
      "dispatched:done",
      "failed_delivery:problem",
    ]);
  });

  it("delivered marks the final step current; unknown status falls back to placed", () => {
    expect(states("delivered").at(-1)).toBe("delivered:current");
    expect(states("weird")[0]).toBe("awaiting_chat:current");
  });
});

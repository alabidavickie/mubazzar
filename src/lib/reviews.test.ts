import { describe, expect, it } from "vitest";
import { allSampleReviews, reviewsHeading } from "./reviews";

describe("reviewsHeading", () => {
  it("labels a section made only of sample reviews", () => {
    expect(reviewsHeading([{ isSample: true }, { isSample: true }], "What Buyers Say")).toBe("Sample reviews (demo data)");
  });
  it("keeps the heading when any real review is shown, or none at all", () => {
    expect(reviewsHeading([{ isSample: true }, { isSample: false }], "What Buyers Say")).toBe("What Buyers Say");
    expect(reviewsHeading([], "What Buyers Say")).toBe("What Buyers Say");
    expect(allSampleReviews([])).toBe(false);
  });
});

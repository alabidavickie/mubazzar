/** True when there is at least one review and every one shown is seeded sample data. */
export function allSampleReviews(reviews: { isSample: boolean }[]): boolean {
  return reviews.length > 0 && reviews.every((r) => r.isSample);
}

/** Section heading: honest "Sample reviews (demo data)" when only sample reviews are on show. */
export function reviewsHeading(reviews: { isSample: boolean }[], heading: string): string {
  return allSampleReviews(reviews) ? "Sample reviews (demo data)" : heading;
}

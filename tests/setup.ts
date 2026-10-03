export {};

// Global test setup. jest-dom matchers are only needed for component tests (jsdom).
if (typeof window !== "undefined") {
  await import("@testing-library/jest-dom/vitest");
}

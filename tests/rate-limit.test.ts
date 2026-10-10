import { it, expect } from "vitest";
import { allowAIRequest } from "../lib/rate-limit";
it("limits calls within an instance and resets the minute window", () => {
  const now = 1_000_000_000;
  for (let i = 0; i < 20; i++) expect(allowAIRequest(now)).toBe(true);
  expect(allowAIRequest(now)).toBe(false);
  expect(allowAIRequest(now + 60000)).toBe(true);
});

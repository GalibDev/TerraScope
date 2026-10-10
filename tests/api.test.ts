import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as vegetation } from "../app/api/vegetation/route";
import { GET as climate } from "../app/api/climate/route";
import { POST as scientist } from "../app/api/scientist/route";
import { datasetSchema } from "../lib/dataset";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
beforeEach(() => {
  vi.stubEnv("VEGETATION_DATA_URL", "");
  vi.stubEnv("VEGETATION_DATA_PATH", "");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("API states with mocked providers", () => {
  it("handles unavailable remote dataset storage without inventing observations", async () => {
    vi.stubEnv("VEGETATION_DATA_URL", "https://example.test/vegetation.json");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 })),
    );
    expect((await vegetation()).status).toBe(503);
  });
  it("never accepts browser-provided scientific statistics", async () => {
    vi.stubEnv("AI_PROVIDER_API_KEY", "");
    const r = await scientist(
      new Request("http://localhost/api/scientist", {
        method: "POST",
        body: JSON.stringify({
          question: "Explain my trend",
          demo: true,
          slope: 999,
          interval: [998, 1000],
        }),
      }),
    );
    const data = await r.json();
    expect(data.answer).toContain("No validated vegetation");
    expect(data.answer).not.toContain("999");
  });
  it("loads operator-provided observations with scaling and QA filtering", async () => {
    const path = join(tmpdir(), `terrascope-test-${crypto.randomUUID()}.json`);
    const fixture = {
      source: "MOD13Q1.061",
      provenance: {
        taskId: "SYNTHETIC-TEST-ONLY",
        retrievedAt: "2024-01-01T00:00:00Z",
        processingNotes:
          "Synthetic test fixture only, never live observations.",
      },
      series: [
        {
          region: "bangladesh",
          index: "NDVI",
          scaled: false,
          observations: [
            { date: "2020-01-01", value: 6000, qa: 0 },
            { date: "2020-01-17", value: 7000, qa: 1 },
          ],
        },
      ],
    };
    await writeFile(path, JSON.stringify(fixture));
    vi.stubEnv("VEGETATION_DATA_PATH", path);
    try {
      const r = await vegetation();
      const body = await r.json();
      expect(body.status).toBe("available");
      expect(body.series[0].observations).toEqual([
        { date: "2020-01-01", value: 0.6 },
      ]);
    } finally {
      await unlink(path);
    }
  });
  it("reports setup required without inventing observations", async () => {
    vi.spyOn(process, "cwd").mockReturnValue(join(tmpdir(), crypto.randomUUID()));
    vi.stubEnv("VEGETATION_DATA_PATH", "");
    const r = await vegetation();
    expect((await r.json()).status).toBe("setup-required");
  });
  it("reports invalid configured datasets safely", async () => {
    vi.stubEnv("VEGETATION_DATA_PATH", "not-a-real-dataset.json");
    const r = await vegetation();
    expect(r.status).toBe(503);
    expect((await r.json()).message).not.toContain("not-a-real");
  });
  it("rejects arbitrary regions", async () => {
    expect(
      (
        await climate(
          new NextRequest("http://localhost/api/climate?region=evil"),
        )
      ).status,
    ).toBe(400);
  });
  it("handles provider failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("rate limited", { status: 429 })),
    );
    expect(
      (
        await climate(
          new NextRequest(
            "http://localhost/api/climate?region=bangladesh&year=2023",
          ),
        )
      ).status,
    ).toBe(502);
  });
  it("rejects malformed external climate response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ properties: {} })),
    );
    expect(
      (
        await climate(
          new NextRequest(
            "http://localhost/api/climate?region=bangladesh&year=2023",
          ),
        )
      ).status,
    ).toBe(502);
  });
  it("validates source provenance and raw records", () => {
    expect(
      datasetSchema.safeParse({ source: "random", series: [] }).success,
    ).toBe(false);
    expect(
      datasetSchema.safeParse({
        source: "MOD13Q1.061",
        provenance: {
          taskId: "test-only",
          retrievedAt: "2024-01-01T00:00:00Z",
          processingNotes:
            "Synthetic test fixture only, never live observations",
        },
        series: [
          {
            region: "bangladesh",
            index: "NDVI",
            scaled: false,
            observations: [{ date: "2020-01-01", value: 6000, qa: 0 }],
          },
        ],
      }).success,
    ).toBe(true);
  });
  it("provides an honest scientist fallback without a key", async () => {
    vi.spyOn(process, "cwd").mockReturnValue(join(tmpdir(), crypto.randomUUID()));
    vi.stubEnv("AI_PROVIDER_API_KEY", "");
    vi.stubEnv("VEGETATION_DATA_PATH", "");
    const r = await scientist(
      new Request("http://localhost/api/scientist", {
        method: "POST",
        body: JSON.stringify({ question: "Is Bangladesh greening?" }),
      }),
    );
    expect((await r.json()).answer).toContain("No validated vegetation");
  });
  it("rejects malformed scientist requests", async () => {
    const r = await scientist(
      new Request("http://localhost/api/scientist", {
        method: "POST",
        body: "{bad",
      }),
    );
    expect(r.status).toBe(400);
  });
});

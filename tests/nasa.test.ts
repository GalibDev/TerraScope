import { describe, it, expect, vi, afterEach } from "vitest";
import {
  appeearsToken,
  submitPoint,
  taskStatus,
  bundle,
  downloadFile,
} from "../lib/nasa";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("Documented AppEEARS lifecycle (mocked, not authenticated verification)", () => {
  it("requires server credentials and validates login response", async () => {
    vi.stubEnv("NASA_EARTHDATA_USERNAME", "");
    vi.stubEnv("NASA_EARTHDATA_PASSWORD", "");
    await expect(appeearsToken()).rejects.toThrow("setup required");
    vi.stubEnv("NASA_EARTHDATA_USERNAME", "synthetic-test");
    vi.stubEnv("NASA_EARTHDATA_PASSWORD", "test-only");
    const mock = vi
      .fn()
      .mockResolvedValue(
        Response.json({
          token: "test-token",
          expiration: "2026-10-12T00:00:00Z",
        }),
      );
    vi.stubGlobal("fetch", mock);
    expect(await appeearsToken()).toBe("test-token");
    expect(mock.mock.calls[0][0]).toBe(
      "https://appeears.earthdatacloud.nasa.gov/api/login",
    );
    expect(mock.mock.calls[0][1].method).toBe("POST");
  });
  it("verifies live layer metadata before submitting a point task", async () => {
    const meta = Object.fromEntries(
      [
        "_250m_16_days_NDVI",
        "_250m_16_days_EVI",
        "_250m_16_days_VI_Quality",
      ].map((k) => [k, { Available: true }]),
    );
    const mock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(meta))
      .mockResolvedValueOnce(
        Response.json({ task_id: "test-task", status: "pending" }),
      );
    vi.stubGlobal("fetch", mock);
    expect(
      (
        await submitPoint(
          "test-token",
          90.3563,
          23.685,
          "01-01-2001",
          "12-31-2024",
        )
      ).status,
    ).toBe("pending");
    const request = JSON.parse(mock.mock.calls[1][1].body);
    expect(request.params.dates[0].startDate).toBe("01-01-2001");
    expect(request.params.coordinates[0].longitude).toBe(90.3563);
    expect(request.params.layers).toHaveLength(3);
  });
  it("does not submit unavailable products", async () => {
    const mock = vi.fn().mockResolvedValue(Response.json({}));
    vi.stubGlobal("fetch", mock);
    await expect(
      submitPoint("test", 90, 23, "01-01-2020", "12-31-2020"),
    ).rejects.toThrow("layer unavailable");
    expect(mock).toHaveBeenCalledTimes(1);
  });
  it("rejects path traversal in task IDs before making requests", async () => {
    const mock = vi.fn();
    vi.stubGlobal("fetch", mock);
    await expect(taskStatus("test", "../login")).rejects.toThrow("Invalid");
    await expect(bundle("test", "../task")).rejects.toThrow("Invalid");
    await expect(downloadFile("test", "safe", "../bad")).rejects.toThrow(
      "Invalid",
    );
    expect(mock).not.toHaveBeenCalled();
  });
  it("downloads file bytes through the documented bundle endpoint", async () => {
    const mock = vi
      .fn()
      .mockResolvedValue(new Response("synthetic CSV content"));
    vi.stubGlobal("fetch", mock);
    expect((await downloadFile("test", "task-id", "file-id")).toString()).toBe(
      "synthetic CSV content",
    );
    expect(mock.mock.calls[0][0]).toContain("/bundle/task-id/file-id");
  });
});

import { NextResponse } from "next/server";
import { loadDataset } from "@/lib/dataset";
export async function GET() {
  try {
    const dataset = await loadDataset();
    if (dataset) return NextResponse.json({ status: "available", ...dataset });
    return NextResponse.json({
      status: "setup-required",
      source: "MOD13Q1.061",
      series: [],
      message:
        "Earthdata extraction and validated observation import required. No measured vegetation results available.",
    });
  } catch {
    return NextResponse.json(
      {
        status: "error",
        series: [],
        message:
          "Configured vegetation dataset failed validation. Check server dataset and provenance.",
      },
      { status: 503 },
    );
  }
}

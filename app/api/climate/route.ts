import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { regions } from "@/lib/regions";
import { nasaFetch } from "@/lib/nasa";
export async function GET(req: NextRequest) {
  const r = regions.find(
    (r) => r.id === req.nextUrl.searchParams.get("region"),
  );
  const year = z.coerce
    .number()
    .int()
    .min(2001)
    .max(2024)
    .safeParse(req.nextUrl.searchParams.get("year") || 2023);
  if (!r || !year.success)
    return NextResponse.json(
      { error: "Invalid region or year" },
      { status: 400 },
    );
  try {
    const url = `https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=T2M,PRECTOTCORR&community=AG&longitude=${r.center[0]}&latitude=${r.center[1]}&start=${year.data}&end=${year.data}&format=JSON`;
    const data = z
      .object({
        properties: z.object({
          parameter: z.record(z.string(), z.record(z.string(), z.number())),
        }),
        parameters: z.record(
          z.string(),
          z.object({ units: z.string(), longname: z.string() }),
        ),
      })
      .parse(
        await (await nasaFetch(url, { next: { revalidate: 86400 } })).json(),
      );
    return NextResponse.json({
      source: "NASA POWER",
      year: year.data,
      location: r.name,
      ...data,
    });
  } catch {
    return NextResponse.json(
      { error: "NASA POWER unavailable. Retry shortly." },
      { status: 502 },
    );
  }
}

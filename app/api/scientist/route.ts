import { NextResponse } from "next/server";
import { z } from "zod";
import { allowAIRequest } from "@/lib/rate-limit";
import {loadDataset} from '@/lib/dataset';
import {monthly,trend} from '@/lib/analysis';
import {regions} from '@/lib/regions';
export async function POST(req: Request) {
  if (!allowAIRequest())
    return NextResponse.json(
      { error: "Request limit reached. Please wait a minute." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  const text = await req.text();
  if (text.length > 4000)
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  const body = z.object({ question: z.string().min(1).max(600),region:z.enum(['bangladesh','assam','chiang-mai','riyadh']).default('bangladesh'),index:z.enum(['NDVI','EVI']).default('NDVI'),start:z.number().int().min(2001).max(2024).default(2001),end:z.number().int().min(2001).max(2024).default(2024),demo:z.boolean().default(false) }).safeParse(
    (() => {
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    })(),
  );
  if (!body.success)
    return NextResponse.json(
      { error: "Enter a question under 600 characters." },
      { status: 400 },
    );
  let evidence='No validated vegetation observations are connected for this selection.';
  if(!body.data.demo){try{const dataset=await loadDataset();const series=dataset?.series.find(s=>s.region===body.data.region&&s.index===body.data.index);const observations=series?.observations.filter(r=>+r.date.slice(0,4)>=body.data.start&&+r.date.slice(0,4)<=body.data.end)||[];if(observations.length){const result=trend(monthly(observations));evidence=`Operator-provided MOD13Q1.061 ${body.data.index} series for ${regions.find(r=>r.id===body.data.region)?.name}, ${body.data.start}–${body.data.end}: ${observations.length} valid observations, descriptive slope ${result.slope??'unavailable'} index units/year over ${result.n} complete years. Confidence interval and significance are not established. Representative study point, not country mean.`;}}catch{evidence='Configured dataset failed validation; no measured interpretation is available.';}}
  const fallback = evidence+' Demo curves are synthetic and cannot establish a Bangladesh trend. NDVI measures relative spectral greenness, not deforestation or its cause. MOD13Q1.061 provides 250 m, 16-day composites; quality filtering and comparable seasonal coverage are essential. Trend uncertainty must account for temporal dependence.';
  if (!process.env.AI_PROVIDER_API_KEY)
    return NextResponse.json({
      answer: fallback,
      mode: "Scientific reference · no LLM configured",
    });
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.AI_PROVIDER_API_KEY}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        model: process.env.AI_PROVIDER_MODEL || "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content: `You explain TerraScope. Validated context: ${fallback} Distinguish measurements, hypotheses and unknowns. Never invent statistics. Do not infer significance. Answer concisely.`,
          },
          { role: "user", content: body.data.question },
        ],
        max_tokens: 350,
      }),
    });
    if (!r.ok) throw Error();
    const data = await r.json();
    return NextResponse.json({
      answer: data.choices?.[0]?.message?.content || fallback,
      mode: "AI explanation",
    });
  } catch {
    return NextResponse.json({
      answer: fallback,
      mode: "Provider unavailable · reference explanation",
    });
  }
}

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const apiKey = process.env.INGEST_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "INGEST_API_KEY not configured" }, { status: 500 });
  }

  const provided =
    request.headers.get("x-api-key") ??
    request.nextUrl.searchParams.get("key");
  if (provided !== apiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { runAllSources } = await import("@/lib/ingestion/pipeline");
    const results = await runAllSources();
    return NextResponse.json({ results });
  } catch (error) {
    console.error("Ingestion error:", error);
    return NextResponse.json(
      { error: "Ingestion failed", details: String(error) },
      { status: 500 }
    );
  }
}

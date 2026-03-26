import { NextRequest, NextResponse } from "next/server";
import { searchItems } from "@/lib/db/queries";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const query = params.get("q");

  if (!query) {
    return NextResponse.json({ error: "Query required" }, { status: 400 });
  }

  try {
    const results = await searchItems(query, {
      category: params.get("category") || undefined,
      company: params.get("company") || undefined,
      limit: params.get("limit") ? Number(params.get("limit")) : 30,
    });
    return NextResponse.json({ items: results, count: results.length });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}

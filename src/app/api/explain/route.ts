import { NextRequest, NextResponse } from "next/server";
import { getItemById } from "@/lib/db/queries";
import { generateExplanation } from "@/lib/ranking/explain";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const item = getItemById(id);
  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  // If we already have a cached explanation, return it
  if (item.implications) {
    return NextResponse.json({ explanation: item.implications, cached: true });
  }

  // Generate on the fly and cache it
  const explanation = generateExplanation({
    title: item.title,
    content: item.content,
    category: item.category,
    company: item.company,
    importanceScore: item.importanceScore,
    isOpenSource: item.isOpenSource,
  });

  const full = `What is this?\n${explanation.whatIsThis}\n\nWhy it matters:\n${explanation.whyItMatters}\n\nWho should care:\n${explanation.whoShouldCare}`;

  // Cache for next time
  db.update(schema.items)
    .set({
      implications: full,
      whyItMatters: item.whyItMatters || explanation.whyItMatters,
      whoShouldCare: item.whoShouldCare || explanation.whoShouldCare,
    })
    .where(eq(schema.items.id, id))
    .run();

  return NextResponse.json({ explanation: full, cached: false });
}

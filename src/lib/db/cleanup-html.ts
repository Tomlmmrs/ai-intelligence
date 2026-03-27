// Run with: npx tsx src/lib/db/cleanup-html.ts
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { eq } from "drizzle-orm";
import { db, schema } from "./index";

function cleanText(text: string | null | undefined): string | null {
  if (!text) return text ?? null;
  let result = text
    // Strip HTML tags (including img tags)
    .replace(/<[^>]+>/g, "")
    // Strip markdown images: ![alt](url)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    // Decode numeric HTML entities
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    // Named entities
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&hellip;/g, "…")
    .replace(/&lsquo;/g, "\u2018")
    .replace(/&rsquo;/g, "\u2019")
    .replace(/&ldquo;/g, "\u201C")
    .replace(/&rdquo;/g, "\u201D")
    // Collapse leftover whitespace
    .replace(/\s+/g, " ")
    .trim();

  // Strip arXiv preamble: "arXiv:XXXX Announce Type: ... Abstract: actual text"
  const abstractMatch = /abstract:\s*/i.exec(result);
  if (abstractMatch && /arxiv:|announce type:/i.test(result.slice(0, abstractMatch.index))) {
    result = "Abstract: " + result.slice(abstractMatch.index + abstractMatch[0].length).trim();
  }

  return result || null;
}

function isDirty(text: string | null | undefined): boolean {
  if (!text) return false;
  return (
    /<[^>]+>/.test(text) ||
    /!\[[^\]]*\]\([^)]*\)/.test(text) ||
    /&#\d+;|&#x[0-9a-fA-F]+;|&amp;|&lt;|&gt;|&quot;|&nbsp;|&mdash;|&ndash;|&hellip;|&[lr][sd]quo;/.test(text) ||
    /arxiv:\S+.*announce type:/i.test(text)
  );
}

async function main() {
  console.log("Scanning for items to clean...");

  const rows = await db.select({
    id: schema.items.id,
    title: schema.items.title,
    summary: schema.items.summary,
    aiSummary: schema.items.aiSummary,
    whyItMatters: schema.items.whyItMatters,
    whoShouldCare: schema.items.whoShouldCare,
    implications: schema.items.implications,
  }).from(schema.items).all();

  let fixed = 0;

  for (const row of rows) {
    const fields = {
      title: row.title,
      summary: row.summary ?? null,
      aiSummary: row.aiSummary ?? null,
      whyItMatters: row.whyItMatters ?? null,
      whoShouldCare: row.whoShouldCare ?? null,
      implications: row.implications ?? null,
    };

    if (!Object.values(fields).some(isDirty)) continue;

    await db.update(schema.items).set({
      title: cleanText(fields.title) ?? row.title,
      summary: cleanText(fields.summary),
      aiSummary: cleanText(fields.aiSummary),
      whyItMatters: cleanText(fields.whyItMatters),
      whoShouldCare: cleanText(fields.whoShouldCare),
      implications: cleanText(fields.implications),
    }).where(eq(schema.items.id, row.id)).run();

    fixed++;
    if (fixed % 50 === 0) console.log(`  Fixed ${fixed} items...`);
  }

  console.log(`Done. Fixed ${fixed} of ${rows.length} items.`);
}

main().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});

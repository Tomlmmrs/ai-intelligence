import { randomUUID } from "crypto";
import { db, schema } from "../db";
import { eq, sql, and, like } from "drizzle-orm";
import type { NewItem } from "../db/schema";
import type { SourceAdapter, RawItem, PipelineResult } from "./types";
import type { Category, SourceType, DateConfidence } from "../types";
import { getEnabledAdapters } from "./sources";
import {
  parseAndValidateDate,
  computeFreshnessScore,
  isLikelyAIContent,
  normalizeUrl,
  titleSimilarity,
  contentQualityMultiplier,
} from "../utils/validate";
import { scorePaper, rewritePaperSummary } from "../ranking/paper-filter";
import { generateExplanation } from "../ranking/explain";
import { scoreRealWorldRelevance, assignItemLabel, assignImpactTag } from "../ranking/relevance";

// ─── Category Detection ──────────────────────────────────────────────
const CATEGORY_KEYWORDS: Record<Category, string[]> = {
  model: [
    "model", "llm", "gpt", "claude", "gemini", "llama", "mistral", "falcon",
    "parameter", "fine-tune", "finetune", "checkpoint", "weights", "foundation model",
    "language model", "multimodal", "vision model", "diffusion",
  ],
  tool: [
    "tool", "framework", "library", "sdk", "api", "plugin", "extension",
    "platform", "app", "application", "chatbot", "assistant", "copilot",
    "langchain", "llamaindex", "autogen", "crewai",
  ],
  research: [
    "paper", "arxiv", "research", "study", "findings", "benchmark", "evaluation",
    "dataset", "experiment", "novel approach", "state-of-the-art", "sota",
    "transformer", "attention", "architecture", "preprint",
  ],
  company: [
    "startup", "funding", "acquisition", "hire", "valuation", "series",
    "raised", "founded", "ceo", "partnership",
  ],
  opensource: [
    "open source", "open-source", "opensource", "github", "hugging face",
    "huggingface", "apache", "mit license", "repository", "repo", "fork",
    "contributor", "community",
  ],
  policy: [
    "regulation", "policy", "law", "government", "eu", "congress", "senate",
    "safety", "alignment", "ethics", "bias", "responsible", "governance",
    "executive order", "legislation", "compliance",
  ],
  market: [
    "market", "revenue", "growth", "investment", "ipo", "stock",
    "enterprise", "adoption", "industry", "forecast", "billion", "million",
    "deal", "contract",
  ],
};

// ─── Company Extraction ──────────────────────────────────────────────
const KNOWN_COMPANIES = [
  "OpenAI", "Anthropic", "Google", "DeepMind", "Meta", "Microsoft", "NVIDIA",
  "Apple", "Amazon", "Hugging Face", "Mistral", "Cohere", "Stability AI",
  "Inflection", "Databricks", "Snowflake", "xAI", "Perplexity", "Midjourney",
  "Adobe", "Salesforce", "Baidu", "Alibaba", "ByteDance", "Samsung",
];

// ─── Open Source Detection ───────────────────────────────────────────
const OPEN_SOURCE_KEYWORDS = [
  "open source", "open-source", "opensource", "apache license", "mit license",
  "gpl", "cc-by", "public domain", "github.com", "huggingface.co/models",
  "weights released", "model weights", "open weights",
];

// ─── Primary source types (official announcements) ─────
const PRIMARY_SOURCE_TYPES = ["blog", "api"];

// ─── Scoring keywords ───────────────────────────────────────────────
const HIGH_IMPORTANCE_KEYWORDS = [
  "breakthrough", "state-of-the-art", "sota", "outperforms", "surpasses",
  "revolutionary", "first", "largest", "fastest", "billion", "launch",
  "release", "announce", "gpt-5", "gpt-4", "claude", "gemini",
];

const HIGH_NOVELTY_KEYWORDS = [
  "novel", "new approach", "first-ever", "unprecedented", "never before",
  "introduces", "proposes", "invention", "paradigm", "emergent",
];

// ─── Helpers ─────────────────────────────────────────────────────────

function detectCategory(title: string, content: string): Category {
  const text = `${title} ${content}`.toLowerCase();
  let bestCategory: Category = "tool";
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (text.includes(kw)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category as Category;
    }
  }

  return bestCategory;
}

function extractCompany(title: string, content: string): string | null {
  const text = `${title} ${content}`;
  for (const company of KNOWN_COMPANIES) {
    if (text.toLowerCase().includes(company.toLowerCase())) {
      return company;
    }
  }
  return null;
}

function detectOpenSource(title: string, content: string, url: string): boolean {
  const text = `${title} ${content} ${url}`.toLowerCase();
  return OPEN_SOURCE_KEYWORDS.some((kw) => text.includes(kw));
}

function extractTags(title: string): string[] {
  const stopWords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "to", "of", "in", "for",
    "on", "with", "at", "by", "from", "as", "into", "through", "during",
    "before", "after", "above", "below", "between", "and", "but", "or",
    "not", "no", "nor", "so", "yet", "both", "either", "neither", "each",
    "every", "all", "any", "few", "more", "most", "other", "some", "such",
    "than", "too", "very", "just", "about", "its", "it", "this", "that",
    "these", "those", "new", "how", "what", "why", "when", "where", "who",
  ]);

  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w))
    .slice(0, 8);
}

function estimateImportance(title: string, content: string): number {
  const text = `${title} ${content}`.toLowerCase();
  let score = 50;
  for (const kw of HIGH_IMPORTANCE_KEYWORDS) {
    if (text.includes(kw)) score += 5;
  }
  const majorCompanies = ["openai", "anthropic", "google", "meta", "deepmind"];
  if (majorCompanies.some((c) => text.includes(c))) score += 8;
  return Math.min(100, Math.max(0, score));
}

function estimateNovelty(title: string, content: string): number {
  const text = `${title} ${content}`.toLowerCase();
  let score = 50;
  for (const kw of HIGH_NOVELTY_KEYWORDS) {
    if (text.includes(kw)) score += 6;
  }
  return Math.min(100, Math.max(0, score));
}

// ─── Composite Score ───────────────────────────────────────────────

function calculateComposite(scores: {
  importance: number;
  novelty: number;
  credibility: number;
  impact: number;
  practical: number;
  freshness: number;
  realWorldRelevance: number;
  qualityMultiplier: number;
}): number {
  const raw =
    scores.importance * 0.14 +
    scores.novelty * 0.08 +
    scores.credibility * 0.08 +
    scores.impact * 0.12 +
    scores.practical * 0.05 +
    scores.freshness * 0.30 +
    scores.realWorldRelevance * 0.23; // Real-world relevance: 23% weight

  return raw * scores.qualityMultiplier;
}

// ─── Get source credibility from DB ─────────────────────────────────

async function getSourceCredibility(sourceId: string): Promise<number> {
  const source = await db
    .select({ credibilityBase: schema.sources.credibilityBase })
    .from(schema.sources)
    .where(eq(schema.sources.id, sourceId))
    .get();
  return source?.credibilityBase ?? 65;
}

// ─── Title-based deduplication ──────────────────────────────────────

async function findSimilarItem(title: string, url: string): Promise<string | null> {
  // First check normalized URL
  const normalizedUrl = normalizeUrl(url);
  const urlMatch = await db
    .select({ id: schema.items.id })
    .from(schema.items)
    .where(eq(schema.items.url, normalizedUrl))
    .get();
  if (urlMatch) return urlMatch.id;

  // Check canonical URL
  const canonicalMatch = await db
    .select({ id: schema.items.id })
    .from(schema.items)
    .where(eq(schema.items.canonicalUrl, normalizedUrl))
    .get();
  if (canonicalMatch) return canonicalMatch.id;

  // Check title similarity against recent items (last 7 days)
  const recentItems = await db
    .select({ id: schema.items.id, title: schema.items.title })
    .from(schema.items)
    .where(
      sql`COALESCE(${schema.items.publishedAt}, ${schema.items.discoveredAt}) >= datetime('now', '-7 days')`
    )
    .all();

  for (const existing of recentItems) {
    const similarity = titleSimilarity(title, existing.title);
    if (similarity > 0.75) {
      return existing.id;
    }
  }

  return null;
}

// ─── Normalize ───────────────────────────────────────────────────────

async function normalize(raw: RawItem, adapter: SourceAdapter): Promise<NewItem> {
  const now = new Date().toISOString();
  const content = raw.content ?? "";
  const category = detectCategory(raw.title, content);
  const company = extractCompany(raw.title, content);
  const isOpenSource = detectOpenSource(raw.title, content, raw.url);
  const tags = extractTags(raw.title);

  // Validate and parse the publish date
  const parsedDate = parseAndValidateDate(raw.publishedAt);
  const publishedAt = parsedDate?.iso ?? null;
  const dateConfidence: DateConfidence = raw.dateConfidence
    ?? parsedDate?.confidence
    ?? "unknown";

  if (!publishedAt && raw.publishedAt) {
    console.warn(`[pipeline] Rejected invalid date "${raw.publishedAt}" for "${raw.title}" from ${adapter.id}`);
  }

  const importance = estimateImportance(raw.title, content);
  const novelty = estimateNovelty(raw.title, content);
  const credibility = await getSourceCredibility(adapter.id);
  const impact = Math.round((importance + novelty) / 2);
  const practical = 50;
  const freshness = computeFreshnessScore(publishedAt, dateConfidence);
  const qualityMultiplier = contentQualityMultiplier(raw.title);

  const isPrimarySource = PRIMARY_SOURCE_TYPES.includes(adapter.type);
  const normalizedUrl = normalizeUrl(raw.url);

  // Real-world relevance scoring
  const realWorldRelevance = scoreRealWorldRelevance(
    raw.title, content, category, adapter.id, importance, isOpenSource,
  );
  const itemLabel = assignItemLabel(raw.title, category, isOpenSource);

  const composite = calculateComposite({
    importance,
    novelty,
    credibility,
    impact,
    practical,
    freshness,
    realWorldRelevance,
    qualityMultiplier,
  });

  // Paper-specific scoring for research items
  let paperFields: {
    paperBroadRelevance?: number;
    paperComposite?: number;
    paperDepth?: string;
    paperInclusionReason?: string;
    showInMainFeed?: boolean;
    showInResearchFeed?: boolean;
    whyItMatters?: string;
    whoShouldCare?: string;
    aiSummary?: string;
  } = {};

  // For arXiv items in ANY category, set showInMainFeed based on real-world relevance
  const isArxivSource = adapter.id.startsWith("arxiv");
  if (isArxivSource && category !== "research") {
    paperFields.showInMainFeed = realWorldRelevance >= 50;
    paperFields.showInResearchFeed = true;
  }

  if (category === "research") {
    const ps = scorePaper(raw.title, content, adapter.id, company);
    paperFields = {
      paperBroadRelevance: ps.broadRelevance,
      paperComposite: ps.composite,
      paperDepth: ps.depth,
      paperInclusionReason: ps.inclusionReason,
      showInMainFeed: ps.showInMainFeed,
      showInResearchFeed: ps.showInResearchFeed,
    };

    // Rewrite paper summary for accessible presentation
    if (content && ps.showInResearchFeed) {
      const rewritten = rewritePaperSummary(raw.title, content, ps);
      paperFields.whyItMatters = rewritten.whyItMatters;
      paperFields.whoShouldCare = rewritten.whoShouldCare;
      paperFields.aiSummary = rewritten.summary;
    }
  }

  // Generate "Why this matters" for ALL items
  let explainFields: { whyItMatters?: string; whoShouldCare?: string; implications?: string } = {};

  if (paperFields.whyItMatters) {
    // Research items already have whyItMatters from paper scoring — build full explanation
    const who = company ? `Researchers at ${company}` : "Researchers";
    let whatIsThis: string;
    if (/breakthrough|first|state.of.the.art|sota/i.test(raw.title)) {
      whatIsThis = `${who} have achieved a significant technical breakthrough that could shape future AI systems.`;
    } else if (/safety|alignment|harm|bias/i.test(raw.title)) {
      whatIsThis = `${who} have published important findings about making AI systems safer and more reliable.`;
    } else {
      whatIsThis = `${who} have published findings that could influence the next generation of AI systems.`;
    }
    explainFields.implications = `What is this?\n${whatIsThis}\n\nWhy it matters:\n${paperFields.whyItMatters}\n\nWho should care:\n${paperFields.whoShouldCare ?? "AI researchers and practitioners"}`;
  } else {
    const explanation = generateExplanation({
      title: raw.title,
      content,
      category,
      company,
      importanceScore: importance,
      isOpenSource,
    });
    explainFields = {
      whyItMatters: explanation.whyItMatters,
      whoShouldCare: explanation.whoShouldCare,
      implications: `What is this?\n${explanation.whatIsThis}\n\nWhy it matters:\n${explanation.whyItMatters}\n\nWho should care:\n${explanation.whoShouldCare}`,
    };
  }

  return {
    id: randomUUID(),
    title: raw.title.trim(),
    url: normalizedUrl,
    canonicalUrl: normalizedUrl !== raw.url.trim() ? normalizedUrl : null,
    source: adapter.id,
    sourceType: adapter.type as SourceType,
    publishedAt,
    discoveredAt: now,
    firstSeenAt: now,
    updatedAt: raw.updatedAt ?? null,
    dateConfidence,
    category,
    content,
    imageUrl: raw.imageUrl ?? null,
    summary: content.length > 200 ? content.slice(0, 200) + "..." : content || null,
    importanceScore: importance,
    noveltyScore: novelty,
    credibilityScore: credibility,
    impactScore: impact,
    practicalScore: practical,
    freshnessScore: freshness,
    compositeScore: Math.round(composite * 100) / 100,
    realWorldRelevance,
    itemLabel,
    impactTag: assignImpactTag(importance, Math.round(composite), novelty, realWorldRelevance),
    company,
    isOpenSource,
    isPrimarySource,
    isOriginalSource: isPrimarySource,
    isDemo: false,
    ingestionStatus: "ok",
    tags: JSON.stringify(tags),
    entities: JSON.stringify(company ? [company] : []),
    ...paperFields,
    ...explainFields,
  };
}

// ─── Pipeline ────────────────────────────────────────────────────────

export async function runPipeline(adapter: SourceAdapter): Promise<PipelineResult> {
  const startTime = Date.now();
  const result: PipelineResult = {
    source: adapter.id,
    fetched: 0,
    new: 0,
    updated: 0,
    skipped: 0,
    duplicates: 0,
    errors: [],
    durationMs: 0,
  };

  console.log(`[pipeline] Starting fetch for source: ${adapter.id} (${adapter.name})`);

  // 1. Fetch raw items with retry
  let rawItems: RawItem[];
  try {
    rawItems = await fetchWithRetry(adapter, 2);
    result.fetched = rawItems.length;
    console.log(`[pipeline] Fetched ${rawItems.length} items from ${adapter.id}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result.errors.push(`Fetch failed: ${message}`);
    console.error(`[pipeline] Fetch failed for ${adapter.id}: ${message}`);

    // Record failure
    await recordSourceFailure(adapter.id, message);
    result.durationMs = Date.now() - startTime;
    await logFetch(adapter.id, result, "error", message);
    return result;
  }

  // 2. Process each item
  for (const raw of rawItems) {
    try {
      // Skip non-AI content from general feeds
      if (!isLikelyAIContent(raw.title, raw.content)) {
        result.skipped++;
        continue;
      }

      // Check for URL duplicate
      const normalizedUrl = normalizeUrl(raw.url);
      const existingByUrl = await db
        .select({ id: schema.items.id })
        .from(schema.items)
        .where(eq(schema.items.url, normalizedUrl))
        .get();

      if (existingByUrl) {
        // Update freshness and validation on existing items
        const parsedDate = parseAndValidateDate(raw.publishedAt);
        const freshness = computeFreshnessScore(
          parsedDate?.iso,
          raw.dateConfidence ?? parsedDate?.confidence
        );
        await db.update(schema.items)
          .set({
            freshnessScore: freshness,
            lastValidatedAt: new Date().toISOString(),
          })
          .where(eq(schema.items.id, existingByUrl.id))
          .run();
        result.updated++;
        continue;
      }

      // Check for title-based duplicate
      const similarItemId = await findSimilarItem(raw.title, raw.url);
      const item = await normalize(raw, adapter);

      if (similarItemId) {
        // Insert but mark as duplicate
        item.duplicateOf = similarItemId;
        result.duplicates++;
      }

      await db.insert(schema.items).values(item).run();
      if (!similarItemId) {
        result.new++;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Skip UNIQUE constraint errors silently (race condition)
      if (message.includes("UNIQUE constraint")) {
        result.updated++;
        continue;
      }
      result.errors.push(`Item "${raw.title}": ${message}`);
      console.error(`[pipeline] Error processing item "${raw.title}": ${message}`);
    }
  }

  // 3. Update source health
  result.durationMs = Date.now() - startTime;
  await recordSourceSuccess(adapter.id, result);
  await logFetch(adapter.id, result, result.errors.length > 0 ? "partial" : "ok");

  console.log(
    `[pipeline] Completed ${adapter.id}: ${result.new} new, ${result.updated} updated, ${result.duplicates} dupes, ${result.skipped} skipped, ${result.errors.length} errors (${result.durationMs}ms)`
  );

  return result;
}

async function fetchWithRetry(adapter: SourceAdapter, maxRetries: number): Promise<RawItem[]> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await adapter.fetch();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
        console.warn(`[pipeline] Retry ${attempt + 1}/${maxRetries} for ${adapter.id} in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError!;
}

async function recordSourceFailure(sourceId: string, errorMsg: string) {
  try {
    await db.update(schema.sources)
      .set({
        lastFetched: new Date().toISOString(),
        lastError: errorMsg,
        lastErrorAt: new Date().toISOString(),
        consecutiveFailures: sql`COALESCE(${schema.sources.consecutiveFailures}, 0) + 1`,
        totalErrors: sql`COALESCE(${schema.sources.totalErrors}, 0) + 1`,
        totalFetches: sql`COALESCE(${schema.sources.totalFetches}, 0) + 1`,
      })
      .where(eq(schema.sources.id, sourceId))
      .run();
  } catch {
    // Ignore DB errors during error recording
  }
}

async function recordSourceSuccess(sourceId: string, result: PipelineResult) {
  try {
    await db.update(schema.sources)
      .set({
        lastFetched: new Date().toISOString(),
        lastSuccessAt: new Date().toISOString(),
        lastError: result.errors.length > 0 ? result.errors.join("; ") : null,
        consecutiveFailures: 0,
        totalFetches: sql`COALESCE(${schema.sources.totalFetches}, 0) + 1`,
        totalErrors: result.errors.length > 0
          ? sql`COALESCE(${schema.sources.totalErrors}, 0) + ${result.errors.length}`
          : schema.sources.totalErrors,
        avgFetchDurationMs: result.durationMs,
        lastItemCount: result.fetched,
      })
      .where(eq(schema.sources.id, sourceId))
      .run();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[pipeline] Failed to update source health: ${message}`);
  }
}

async function logFetch(sourceId: string, result: PipelineResult, status: string, errorMsg?: string) {
  try {
    await db.insert(schema.sourceFetchLog).values({
      id: randomUUID(),
      sourceId,
      fetchedAt: new Date().toISOString(),
      durationMs: result.durationMs,
      itemsFetched: result.fetched,
      itemsNew: result.new,
      itemsSkipped: result.skipped,
      status,
      errorMessage: errorMsg ?? (result.errors.length > 0 ? result.errors.join("; ") : null),
    }).run();
  } catch {
    // Non-critical — don't fail the pipeline
  }
}

export async function runAllSources(): Promise<PipelineResult[]> {
  console.log("[pipeline] Starting full ingestion run...");

  const adapters = await getEnabledAdapters();
  console.log(`[pipeline] Found ${adapters.length} enabled source(s)`);

  const results: PipelineResult[] = [];

  for (const adapter of adapters) {
    const pipelineResult = await runPipeline(adapter);
    results.push(pipelineResult);
  }

  const totalNew = results.reduce((sum, r) => sum + r.new, 0);
  const totalUpdated = results.reduce((sum, r) => sum + r.updated, 0);
  const totalDupes = results.reduce((sum, r) => sum + r.duplicates, 0);
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
  const totalDuration = results.reduce((sum, r) => sum + r.durationMs, 0);

  console.log(
    `[pipeline] Full run complete: ${totalNew} new, ${totalUpdated} updated, ${totalDupes} dupes, ${totalErrors} errors across ${results.length} sources (${totalDuration}ms total)`
  );

  return results;
}

/**
 * Real-world relevance scoring.
 *
 * Answers: "Does this affect what people are actually building or using?"
 *
 * High scores: model releases, API updates, new tools, open-source projects, product launches
 * Low scores: purely theoretical research, niche academic papers, incremental studies
 */

import type { Category } from "../types";

// ─── Category base weights ──────────────────────────────────────────
// How much each category inherently affects the real world

const CATEGORY_BASE_RELEVANCE: Record<Category, number> = {
  model: 75,
  tool: 80,
  company: 65,
  opensource: 75,
  market: 55,
  policy: 50,
  research: 25, // Low base — must prove relevance via signals
};

// ─── Real-world signal patterns ──────────────────────────────────────

const PRODUCT_SIGNALS: { pattern: RegExp; boost: number }[] = [
  // Direct product/release signals
  { pattern: /\b(releas|launch|ship|deploy|available|live|ga|general availability)\b/i, boost: 20 },
  { pattern: /\b(api|sdk|endpoint|webhook|integration)\b/i, boost: 15 },
  { pattern: /\b(v\d+\.\d+|version \d|update|upgrade|changelog)\b/i, boost: 12 },
  { pattern: /\b(pricing|free tier|waitlist|beta access|early access)\b/i, boost: 12 },
  { pattern: /\b(developer|platform|dashboard|console|playground)\b/i, boost: 10 },

  // Open-source momentum
  { pattern: /\b(open.?source|open.?weight|github|hugging.?face|model.?hub)\b/i, boost: 15 },
  { pattern: /\b(apache|mit license|permissive|weights.?released)\b/i, boost: 12 },
  { pattern: /\b(star|fork|contributor|community|ecosystem)\b/i, boost: 8 },

  // Model capabilities that matter for builders
  { pattern: /\b(gpt|claude|gemini|llama|mistral|phi|command|grok)\b/i, boost: 12 },
  { pattern: /\b(agent|function.?call|tool.?use|code.?gen|code.?assist)\b/i, boost: 15 },
  { pattern: /\b(context.?window|128k|256k|1m.?token|long.?context)\b/i, boost: 10 },
  { pattern: /\b(multimodal|vision|image|video|audio|voice)\b/i, boost: 8 },
  { pattern: /\b(rag|retrieval|vector|embedding|search)\b/i, boost: 10 },
  { pattern: /\b(fine.?tun|lora|custom|adapt)\b/i, boost: 8 },

  // Business/adoption signals
  { pattern: /\b(enterprise|production|scale|customer|adoption)\b/i, boost: 10 },
  { pattern: /\b(billion|million|raised|funding|acquisition)\b/i, boost: 8 },
  { pattern: /\b(partnership|collab|integrat)\b/i, boost: 8 },
];

const ACADEMIC_SIGNALS: { pattern: RegExp; penalty: number }[] = [
  // Pure academic signals that reduce real-world relevance
  { pattern: /\b(theorem|proof|lemma|corollary|proposition)\b/i, penalty: 20 },
  { pattern: /\b(convergence|regret bound|sample complexity|pac learn)\b/i, penalty: 15 },
  { pattern: /\b(ablation|hyperparameter|grid search|architecture search)\b/i, penalty: 10 },
  { pattern: /\b(survey|review|taxonomy|systematic review)\b/i, penalty: 12 },
  { pattern: /\b(we propose|we introduce|we present|in this paper)\b/i, penalty: 8 },
  { pattern: /\b(novel approach|framework for|method for|technique for)\b/i, penalty: 5 },
];

// ─── Item label assignment ───────────────────────────────────────────

export function assignItemLabel(
  title: string,
  category: Category,
  isOpenSource: boolean,
): string {
  const t = title.toLowerCase();

  if (category === "research") {
    if (/safety|alignment|bias|harm/i.test(t)) return "Safety Research";
    return "Research";
  }
  if (category === "model") {
    if (/releas|launch|announc|introduc/i.test(t)) return "Model Release";
    if (/update|v\d|upgrad/i.test(t)) return "Model Update";
    if (/benchmark|evaluat|compar|leaderboard/i.test(t)) return "Benchmark";
    return "AI Model";
  }
  if (category === "tool") {
    if (/api|sdk|endpoint/i.test(t)) return "API Update";
    if (/plugin|extension|integrat/i.test(t)) return "Integration";
    if (isOpenSource) return "Open Source Tool";
    return "New Tool";
  }
  if (category === "company") {
    if (/funding|raised|series|valuation/i.test(t)) return "Funding";
    if (/acqui|merger|partner/i.test(t)) return "Deal";
    if (/hire|team|ceo|leadership/i.test(t)) return "Leadership";
    return "Industry Move";
  }
  if (category === "opensource") return "Open Source";
  if (category === "policy") {
    if (/regulat|law|legislat/i.test(t)) return "Regulation";
    return "Policy";
  }
  if (category === "market") return "Market";

  return category;
}

// ─── Impact tag assignment ───────────────────────────────────────────

export function assignImpactTag(
  importanceScore: number,
  compositeScore: number,
  noveltyScore: number,
  realWorldRelevance: number,
  paperDepth?: string | null,
): string | null {
  if (realWorldRelevance >= 80 && importanceScore >= 70) return "High Impact";
  if (importanceScore >= 75 || compositeScore >= 80) return "High Impact";
  if (realWorldRelevance >= 65 && importanceScore >= 55) return "Worth Watching";
  if (importanceScore >= 60 || compositeScore >= 65) return "Worth Watching";
  if (noveltyScore >= 75 && realWorldRelevance >= 40) return "Early Signal";
  if (paperDepth === "advanced" || (realWorldRelevance < 30 && compositeScore < 40)) return "Experimental";
  return null;
}

// ─── Main scoring function ───────────────────────────────────────────

export function scoreRealWorldRelevance(
  title: string,
  content: string,
  category: Category,
  source: string,
  importanceScore: number,
  isOpenSource: boolean,
): number {
  const text = `${title} ${content}`.toLowerCase();

  // Start with category base
  let score = CATEGORY_BASE_RELEVANCE[category] ?? 50;

  // Apply product/release boosts
  for (const { pattern, boost } of PRODUCT_SIGNALS) {
    if (pattern.test(text)) {
      score += boost;
    }
  }

  // Apply academic penalties (mainly affects research)
  for (const { pattern, penalty } of ACADEMIC_SIGNALS) {
    if (pattern.test(text)) {
      score -= penalty;
    }
  }

  // Source-based adjustments
  if (/blog|official/i.test(source)) score += 10; // Official blogs = real-world signal
  if (/arxiv/i.test(source)) score -= 15; // Raw arXiv = academic default
  if (/hf_papers/i.test(source)) score -= 5; // HF papers = curated but still academic

  // Open-source boost
  if (isOpenSource) score += 10;

  // High importance items in non-research categories get a boost
  if (category !== "research" && importanceScore >= 70) score += 10;

  // Research items need to overcome a high bar
  if (category === "research") {
    // Only give credit if there are strong product signals
    const hasProductSignal = PRODUCT_SIGNALS.some(({ pattern }) => pattern.test(text));
    if (!hasProductSignal) score -= 10;
  }

  return Math.round(Math.min(100, Math.max(0, score)));
}

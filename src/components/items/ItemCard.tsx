"use client";

import { useState } from "react";
import {
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Code2,
  Shield,
  Clock,
  HelpCircle,
  Loader2,
  Lightbulb,
} from "lucide-react";
import type { Item } from "@/lib/db/schema";
import { formatTimestamp } from "@/lib/utils/format";

// ─── Label mappings ──────────────────────────────────────────────────

const categoryColors: Record<string, string> = {
  model: "bg-cat-model/20 text-cat-model",
  tool: "bg-cat-tool/20 text-cat-tool",
  research: "bg-cat-research/20 text-cat-research",
  company: "bg-cat-company/20 text-cat-company",
  opensource: "bg-cat-opensource/20 text-cat-opensource",
  policy: "bg-cat-policy/20 text-cat-policy",
  market: "bg-cat-market/20 text-cat-market",
};

const itemTypeLabels: Record<string, string> = {
  model: "Model Release",
  tool: "New Tool",
  research: "Research",
  company: "Industry Move",
  opensource: "Open Source",
  policy: "Policy",
  market: "Market",
};

const paperDepthLabels: Record<string, { label: string; color: string }> = {
  general: { label: "Important Research", color: "bg-amber-500/20 text-amber-600" },
  intermediate: { label: "Notable Research", color: "bg-blue-500/20 text-blue-500" },
  advanced: { label: "Deep Research", color: "bg-purple-500/20 text-purple-500" },
};

const inclusionReasonLabels: Record<string, string> = {
  major_lab: "Major Lab",
  capability_shift: "Breakthrough",
  product_relevant: "Product Relevant",
  open_source_impact: "Open Source Impact",
  safety_alignment: "Safety & Alignment",
  community_attention: "Trending",
  efficiency_breakthrough: "Efficiency Gain",
  benchmark_record: "New Benchmark",
  agent_tool_use: "Agents & Tools",
  multimodal_advance: "Multimodal",
};

// ─── Impact tag logic ────────────────────────────────────────────────

const impactTagColors: Record<string, string> = {
  "High Impact": "bg-red-500/15 text-red-500",
  "Worth Watching": "bg-orange-500/15 text-orange-500",
  "Early Signal": "bg-yellow-500/15 text-yellow-600",
  "Experimental": "bg-gray-500/15 text-gray-400",
};

function getImpactTag(item: Item): { label: string; color: string } | null {
  // Use stored impact tag from DB if available
  const stored = (item as any).impactTag;
  if (stored && impactTagColors[stored]) {
    return { label: stored, color: impactTagColors[stored] };
  }

  // Fallback computation
  const importance = item.importanceScore ?? 50;
  const score = item.compositeScore ?? 50;
  if (importance >= 75 || score >= 80) return { label: "High Impact", color: impactTagColors["High Impact"] };
  if (importance >= 60 || score >= 65) return { label: "Worth Watching", color: impactTagColors["Worth Watching"] };
  return null;
}

// ─── Sub-components ──────────────────────────────────────────────────

function TimestampBadge({ dateStr, dateConfidence }: { dateStr: string | null | undefined; dateConfidence?: string | null }) {
  const ts = formatTimestamp(dateStr, dateConfidence);

  if (ts.unknown) {
    return (
      <span className="flex items-center gap-0.5 text-muted/60 italic" title="No publish date available">
        <HelpCircle className="h-2.5 w-2.5" />
        {ts.text}
      </span>
    );
  }

  if (ts.stale) {
    return (
      <span className="flex items-center gap-0.5 text-muted/40" title="Content is older than 2 weeks">
        <Clock className="h-2.5 w-2.5" />
        {ts.text}
      </span>
    );
  }

  if (ts.dateConfidence === "estimated") {
    return (
      <span className="text-muted" title="Publish date is estimated">
        ~{ts.text}
      </span>
    );
  }

  return <span>{ts.text}</span>;
}

// ─── Why Explanation Panel ───────────────────────────────────────────

function WhyPanel({ item }: { item: Item }) {
  // If we have the full structured explanation cached in implications
  if (item.implications) {
    const lines = item.implications.split("\n").filter(Boolean);
    return (
      <div className="mt-2.5 pt-2.5 border-t border-border-subtle space-y-1.5">
        {lines.map((line, i) => {
          if (line === "What is this?" || line === "Why it matters:" || line === "Who should care:") {
            return (
              <p key={i} className="text-[10px] font-semibold text-accent uppercase tracking-wide mt-1">
                {line}
              </p>
            );
          }
          return (
            <p key={i} className="text-xs text-muted-foreground leading-relaxed">
              {line}
            </p>
          );
        })}
      </div>
    );
  }

  // Fallback to whyItMatters only
  if (item.whyItMatters) {
    return (
      <div className="mt-2.5 pt-2.5 border-t border-border-subtle">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground">Why it matters: </span>
          {item.whyItMatters}
        </p>
      </div>
    );
  }

  return null;
}

// ─── Main Card ───────────────────────────────────────────────────────

export default function ItemCard({ item }: { item: Item }) {
  const [bookmarked, setBookmarked] = useState(item.isBookmarked ?? false);
  const [showWhy, setShowWhy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(item.implications ?? null);

  const tags: string[] = item.tags ? JSON.parse(item.tags) : [];
  const impactTag = getImpactTag(item);

  const handleBookmark = async () => {
    const next = !bookmarked;
    setBookmarked(next);
    try {
      await fetch(`/api/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, action: "bookmark" }),
      });
    } catch {
      setBookmarked(!next);
    }
  };

  const handleWhy = async () => {
    if (showWhy) {
      setShowWhy(false);
      return;
    }
    setShowWhy(true);

    // If we don't have an explanation cached, fetch it
    if (!explanation && !item.implications && !item.whyItMatters) {
      setLoading(true);
      try {
        const res = await fetch(`/api/explain?id=${item.id}`);
        const data = await res.json();
        if (data.explanation) {
          setExplanation(data.explanation);
          item.implications = data.explanation; // cache locally
        }
      } catch {
        // Silently fail — the panel will show nothing
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <article className="group p-3.5 bg-card border border-border-subtle rounded-lg hover:border-border hover:bg-card-hover transition-colors">
      {/* Top row: type label + badges + source + time */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${
              categoryColors[item.category] ?? "bg-muted/20 text-muted-foreground"
            }`}
          >
            {(item as any).itemLabel || itemTypeLabels[item.category] || item.category}
          </span>
          {(item as any).paperDepth && paperDepthLabels[(item as any).paperDepth] && (
            <span
              className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ${paperDepthLabels[(item as any).paperDepth].color}`}
            >
              {paperDepthLabels[(item as any).paperDepth].label}
            </span>
          )}
          {(item as any).paperInclusionReason && (item as any).paperInclusionReason !== "none" && inclusionReasonLabels[(item as any).paperInclusionReason] && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-accent/15 text-accent">
              {inclusionReasonLabels[(item as any).paperInclusionReason]}
            </span>
          )}
          {impactTag && (
            <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ${impactTag.color}`}>
              {impactTag.label}
            </span>
          )}
          {item.isOpenSource && (
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-cat-opensource/15 text-cat-opensource">
              <Code2 className="h-2.5 w-2.5" />
              OSS
            </span>
          )}
          {item.company && (
            <span className="text-[10px] text-muted-foreground">{item.company}</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted shrink-0">
          {item.isPrimarySource && (
            <span className="flex items-center gap-0.5 text-emerald-500" title="Primary/official source">
              <Shield className="h-2.5 w-2.5" />
            </span>
          )}
          <span>{item.source}</span>
          <TimestampBadge
            dateStr={item.publishedAt ?? item.discoveredAt}
            dateConfidence={(item as any).dateConfidence}
          />
        </div>
      </div>

      {/* Title */}
      <h3 className="mb-1.5">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-semibold text-foreground hover:text-accent transition-colors inline-flex items-center gap-1"
        >
          {item.title}
          <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
        </a>
      </h3>

      {/* Summary */}
      {(item.aiSummary || item.summary) && (
        <p className="text-xs text-muted-foreground leading-relaxed mb-2.5 line-clamp-2">
          {item.aiSummary || item.summary}
        </p>
      )}

      {/* Tags + actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 flex-wrap">
          {tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="px-1.5 py-0.5 text-[10px] bg-border/50 text-muted-foreground rounded"
            >
              {tag}
            </span>
          ))}
          {tags.length > 4 && (
            <span className="text-[10px] text-muted">+{tags.length - 4}</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleWhy}
            className={`flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded transition-colors ${
              showWhy
                ? "bg-accent/15 text-accent"
                : "text-muted-foreground hover:text-foreground hover:bg-card-hover"
            }`}
            title="Why this matters"
          >
            <Lightbulb className="h-3 w-3" />
            Why?
            {showWhy ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>
          <button
            onClick={handleBookmark}
            className="p-1 rounded hover:bg-border/50 transition-colors"
            title={bookmarked ? "Remove bookmark" : "Bookmark"}
          >
            {bookmarked ? (
              <BookmarkCheck className="h-3.5 w-3.5 text-accent" />
            ) : (
              <Bookmark className="h-3.5 w-3.5 text-muted" />
            )}
          </button>
        </div>
      </div>

      {/* Why this matters - expandable */}
      {showWhy && (
        loading ? (
          <div className="mt-2.5 pt-2.5 border-t border-border-subtle flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Generating explanation...
          </div>
        ) : (
          <WhyPanel item={{ ...item, implications: explanation ?? item.implications ?? null } as Item} />
        )
      )}
    </article>
  );
}

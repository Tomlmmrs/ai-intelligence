"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { usePrefetchedNavigation } from "@/components/layout/usePrefetchedNavigation";

const depths = [
  { key: "all", label: "All Research" },
  { key: "general", label: "Important" },
  { key: "intermediate", label: "Notable" },
  { key: "advanced", label: "Deep / Niche" },
] as const;

export default function ResearchDepthFilter() {
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const { isPending, navigate, prefetch } = usePrefetchedNavigation();
  const currentDepth = searchParams.get("depth") ?? "all";
  const [pendingDepth, setPendingDepth] = useState<string | null>(null);
  const activeDepth = pendingDepth ?? currentDepth;

  useEffect(() => {
    setPendingDepth(null);
  }, [searchKey]);

  const getHref = (key: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (key === "all") {
      params.delete("depth");
    } else {
      params.set("depth", key);
    }
    return `/?${params.toString()}`;
  };

  const handleSelect = (key: string) => {
    const href = getHref(key);
    setPendingDepth(key);
    prefetch(href);
    navigate(href);
  };

  return (
    <div className="space-y-2">
      <span className="block text-[10px] font-semibold uppercase tracking-[0.28em] text-muted">
        Research Depth
      </span>
      <div className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 pb-1 scrollbar-none">
      {depths.map((d) => {
        const isActive = activeDepth === d.key || (!searchParams.has("depth") && d.key === "all");
        return (
          <button
            key={d.key}
            type="button"
            onClick={() => handleSelect(d.key)}
            onMouseEnter={() => prefetch(getHref(d.key))}
            onFocus={() => prefetch(getHref(d.key))}
            onTouchStart={() => prefetch(getHref(d.key))}
            className={`rounded-full px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
              isActive
                ? "bg-accent/15 text-accent shadow-[inset_0_0_0_1px_rgba(59,130,246,0.22)]"
                : "bg-background/60 text-muted-foreground hover:bg-card-hover hover:text-foreground"
            }`}
            aria-busy={isPending && isActive}
          >
            <span className="inline-flex items-center gap-1.5">
              <span>{d.label}</span>
              {isPending && isActive && <Loader2 className="h-3 w-3 animate-spin" />}
            </span>
          </button>
        );
      })}
      </div>
    </div>
  );
}

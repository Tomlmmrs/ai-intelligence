"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { usePrefetchedNavigation } from "@/components/layout/usePrefetchedNavigation";

const categories = [
  { key: "all", label: "All", color: "bg-muted/20 text-muted-foreground" },
  { key: "model", label: "AI Models", color: "bg-cat-model/20 text-cat-model" },
  { key: "tool", label: "AI Tools", color: "bg-cat-tool/20 text-cat-tool" },
  { key: "research", label: "Research", color: "bg-cat-research/20 text-cat-research" },
  { key: "company", label: "Companies", color: "bg-cat-company/20 text-cat-company" },
  { key: "opensource", label: "Open Source", color: "bg-cat-opensource/20 text-cat-opensource" },
  { key: "policy", label: "Policy", color: "bg-cat-policy/20 text-cat-policy" },
  { key: "market", label: "Market", color: "bg-cat-market/20 text-cat-market" },
] as const;

export default function CategoryFilter() {
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const { isPending, navigate, prefetch } = usePrefetchedNavigation();
  const currentCategory = searchParams.get("category") ?? "all";
  const [pendingCategory, setPendingCategory] = useState<string | null>(null);
  const activeCategory = pendingCategory ?? currentCategory;

  useEffect(() => {
    setPendingCategory(null);
  }, [searchKey]);

  const getHref = (key: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (key === "all") {
      params.delete("category");
    } else {
      params.set("category", key);
    }
    return `/?${params.toString()}`;
  };

  const handleSelect = (key: string) => {
    const href = getHref(key);
    setPendingCategory(key);
    prefetch(href);
    navigate(href);
  };

  return (
    <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-none">
      {categories.map((cat) => {
        const isActive =
          (cat.key === "all" && activeCategory === "all") || activeCategory === cat.key;
        return (
          <button
            key={cat.key}
            type="button"
            onClick={() => handleSelect(cat.key)}
            onMouseEnter={() => prefetch(getHref(cat.key))}
            onFocus={() => prefetch(getHref(cat.key))}
            onTouchStart={() => prefetch(getHref(cat.key))}
            className={`rounded-full px-3 py-2 text-xs font-medium whitespace-nowrap transition-all ${
              isActive
                ? `${cat.color} ring-1 ring-current/20`
                : "border border-border-subtle bg-background/60 text-muted-foreground hover:text-foreground"
            }`}
            aria-busy={isPending && isActive}
          >
            <span className="inline-flex items-center gap-1.5">
              <span>{cat.label}</span>
              {isPending && isActive && <Loader2 className="h-3 w-3 animate-spin" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { usePrefetchedNavigation } from "@/components/layout/usePrefetchedNavigation";

const modes = [
  { key: "latest", label: "Latest" },
  { key: "important", label: "Most Important" },
  { key: "novel", label: "Most Novel" },
  { key: "impactful", label: "Most Impactful" },
  { key: "underrated", label: "Underrated" },
  { key: "opensource", label: "Open Source" },
  { key: "research", label: "Research" },
] as const;

export default function RankModeSelector() {
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const { isPending, navigate, prefetch } = usePrefetchedNavigation();
  const currentMode = searchParams.get("view") ?? "latest";
  const [pendingMode, setPendingMode] = useState<string | null>(null);
  const activeMode = pendingMode ?? currentMode;

  useEffect(() => {
    setPendingMode(null);
  }, [searchKey]);

  const getHref = (key: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", key);
    params.delete("feature");
    return `/?${params.toString()}`;
  };

  const handleSelect = (key: string) => {
    const href = getHref(key);
    setPendingMode(key);
    prefetch(href);
    navigate(href);
  };

  return (
    <div className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 pb-1 scrollbar-none">
      {modes.map((mode) => {
        const isActive = activeMode === mode.key;
        return (
          <button
            key={mode.key}
            type="button"
            onClick={() => handleSelect(mode.key)}
            onMouseEnter={() => prefetch(getHref(mode.key))}
            onFocus={() => prefetch(getHref(mode.key))}
            onTouchStart={() => prefetch(getHref(mode.key))}
            className={`rounded-full px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
              isActive
                ? "bg-accent/15 text-accent shadow-[inset_0_0_0_1px_rgba(59,130,246,0.22)]"
                : "bg-background/60 text-muted-foreground hover:bg-card-hover hover:text-foreground"
            }`}
            aria-busy={isPending && isActive}
          >
            <span className="inline-flex items-center gap-1.5">
              <span>{mode.label}</span>
              {isPending && isActive && <Loader2 className="h-3 w-3 animate-spin" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

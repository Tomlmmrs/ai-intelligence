"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { usePrefetchedNavigation } from "@/components/layout/usePrefetchedNavigation";

const windows = [
  { key: "24h", label: "24h" },
  { key: "3d", label: "3 days" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "all", label: "All time" },
] as const;

export default function TimeWindowFilter() {
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const { isPending, navigate, prefetch } = usePrefetchedNavigation();
  const currentWindow = searchParams.get("t") ?? "3d";
  const [pendingWindow, setPendingWindow] = useState<string | null>(null);
  const activeWindow = pendingWindow ?? currentWindow;

  useEffect(() => {
    setPendingWindow(null);
  }, [searchKey]);

  const getHref = (key: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (key === "3d") {
      params.delete("t");
    } else {
      params.set("t", key);
    }
    return `/?${params.toString()}`;
  };

  const handleSelect = (key: string) => {
    const href = getHref(key);
    setPendingWindow(key);
    prefetch(href);
    navigate(href);
  };

  return (
    <div className="space-y-2">
      <span className="block text-[10px] font-semibold uppercase tracking-[0.28em] text-muted">
        Time Window
      </span>
      <div className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 pb-1 scrollbar-none">
      {windows.map((w) => {
        const isActive = activeWindow === w.key || (!searchParams.has("t") && w.key === "3d");
        return (
          <button
            key={w.key}
            type="button"
            onClick={() => handleSelect(w.key)}
            onMouseEnter={() => prefetch(getHref(w.key))}
            onFocus={() => prefetch(getHref(w.key))}
            onTouchStart={() => prefetch(getHref(w.key))}
            className={`rounded-full px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
              isActive
                ? "bg-accent/15 text-accent shadow-[inset_0_0_0_1px_rgba(59,130,246,0.22)]"
                : "bg-background/60 text-muted-foreground hover:bg-card-hover hover:text-foreground"
            }`}
            aria-busy={isPending && isActive}
          >
            <span className="inline-flex items-center gap-1.5">
              <span>{w.label}</span>
              {isPending && isActive && <Loader2 className="h-3 w-3 animate-spin" />}
            </span>
          </button>
        );
      })}
      </div>
    </div>
  );
}

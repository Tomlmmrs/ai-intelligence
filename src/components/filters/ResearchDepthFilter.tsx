"use client";

import { useRouter, useSearchParams } from "next/navigation";

const depths = [
  { key: "all", label: "All Research" },
  { key: "general", label: "Important" },
  { key: "intermediate", label: "Notable" },
  { key: "advanced", label: "Deep / Niche" },
] as const;

export default function ResearchDepthFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeDepth = searchParams.get("depth") ?? "all";

  const handleSelect = (key: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (key === "all") {
      params.delete("depth");
    } else {
      params.set("depth", key);
    }
    router.push(`/?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-muted-foreground mr-1">Depth:</span>
      {depths.map((d) => {
        const isActive = activeDepth === d.key || (!searchParams.has("depth") && d.key === "all");
        return (
          <button
            key={d.key}
            onClick={() => handleSelect(d.key)}
            className={`px-2 py-0.5 text-[10px] font-medium rounded whitespace-nowrap transition-colors ${
              isActive
                ? "bg-accent/15 text-accent"
                : "text-muted-foreground hover:text-foreground hover:bg-card-hover"
            }`}
          >
            {d.label}
          </button>
        );
      })}
    </div>
  );
}

import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import StatsBar from "@/components/dashboard/StatsBar";
import ItemList from "@/components/items/ItemList";
import SignalsPanel from "@/components/dashboard/SignalsPanel";
import TrendingPanel from "@/components/dashboard/TrendingPanel";
import TopEntities from "@/components/dashboard/TopEntities";
import RankModeSelector from "@/components/filters/RankModeSelector";
import CategoryFilter from "@/components/filters/CategoryFilter";
import TimeWindowFilter from "@/components/filters/TimeWindowFilter";
import ResearchDepthFilter from "@/components/filters/ResearchDepthFilter";
import { getDashboardStats, getItems, getFeedSections, getActiveSignals, getTrendingClusters, getTopEntities } from "@/lib/db/queries";
import type { RankMode, Category, TimeWindow } from "@/lib/types";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    mode?: string;
    category?: string;
    company?: string;
    q?: string;
    view?: string;
    t?: string;
    depth?: string;
  }>;
}

// ─── Feed Section Component ──────────────────────────────────────────

function FeedSection({
  title,
  items,
  emptyMessage,
}: {
  title: string;
  items: any[];
  emptyMessage?: string;
}) {
  if (items.length === 0) {
    if (!emptyMessage) return null;
    return (
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-muted-foreground mb-2">{title}</h2>
        <p className="text-xs text-muted">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        {title}
        <span className="text-[10px] text-muted-foreground font-normal">({items.length})</span>
      </h2>
      <ItemList items={items} />
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────

export default async function DashboardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const mode = (params.view || params.mode || "latest") as RankMode;
  const category = params.category as Category | undefined;
  const company = params.company || undefined;
  const search = params.q || undefined;
  const timeWindow = (params.t || "3d") as TimeWindow;
  const paperDepth = params.depth as "general" | "intermediate" | "advanced" | undefined;

  // Determine if we should show sectioned view (default) or flat filtered view
  const isFilteredView = !!(category || company || search || mode === "research" || mode === "opensource" || mode === "novel" || mode === "impactful" || mode === "underrated");

  let stats: any, signalsList: any, trending: any, topEntitiesList: any;
  let sections: any = null;
  let items: any[] = [];

  try {
    stats = getDashboardStats();
    signalsList = getActiveSignals(8);
    trending = getTrendingClusters(8);
    topEntitiesList = getTopEntities(undefined, 12);

    if (isFilteredView) {
      items = getItems({ mode, category, company, search, limit: 40, timeWindow, paperDepth });
    } else {
      // Default sectioned view
      sections = getFeedSections(timeWindow);
    }
  } catch {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="max-w-lg rounded-xl border border-border bg-card p-8 text-center">
          <h1 className="mb-4 text-2xl font-bold text-foreground">AI Intelligence</h1>
          <p className="mb-6 text-muted">
            Database not initialized. Run the setup command:
          </p>
          <code className="block rounded-lg bg-background px-4 py-3 text-sm text-accent">
            npm run db:seed
          </code>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header unreadCount={stats.unreadAlerts} />
      <div className="flex flex-1 pt-14">
        <Sidebar />
        <main className="flex-1 overflow-auto pl-60">
          <div className="mx-auto max-w-7xl px-6 py-6">
            <StatsBar stats={stats} />

            <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
              <div>
                <div className="flex items-center justify-between gap-4">
                  <RankModeSelector />
                  <TimeWindowFilter />
                </div>

                {isFilteredView && (
                  <div className="mt-3 flex items-center gap-4">
                    <CategoryFilter />
                    {mode === "research" && <ResearchDepthFilter />}
                  </div>
                )}

                {search && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm">
                    <span className="text-muted">Results for:</span>
                    <span className="font-medium text-foreground">&quot;{search}&quot;</span>
                    <span className="text-muted">({items.length} found)</span>
                  </div>
                )}

                {/* Sectioned view (default homepage) */}
                {sections && (
                  <div className="mt-5">
                    <FeedSection
                      title="Major AI Releases"
                      items={sections.releases}
                    />
                    <FeedSection
                      title="Important Developments"
                      items={sections.developments}
                    />
                    <FeedSection
                      title="New Tools & Products"
                      items={sections.tools}
                    />
                    <FeedSection
                      title="Open Source Momentum"
                      items={sections.opensource}
                    />
                    <FeedSection
                      title="Early Signals"
                      items={sections.signals}
                    />
                    <FeedSection
                      title="Important Research"
                      items={sections.research}
                    />

                    {Object.values(sections).every((s: any) => s.length === 0) && (
                      <div className="mt-6 rounded-lg border border-border bg-card p-8 text-center">
                        <p className="text-muted-foreground">
                          No items found in this time window. Try expanding the time range or run ingestion:
                        </p>
                        <code className="mt-3 block rounded-lg bg-background px-4 py-2 text-sm text-accent">
                          npm run ingest
                        </code>
                      </div>
                    )}
                  </div>
                )}

                {/* Flat filtered view (when using filters/modes) */}
                {isFilteredView && (
                  <div className="mt-4">
                    {items.length === 0 && !search ? (
                      <div className="mt-6 rounded-lg border border-border bg-card p-8 text-center">
                        <p className="text-muted-foreground">
                          No items found in this time window. Try expanding the time range or run ingestion.
                        </p>
                      </div>
                    ) : (
                      <ItemList items={items} />
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <SignalsPanel signals={signalsList} />
                <TrendingPanel clusters={trending} />
                <TopEntities entities={topEntitiesList} />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
